package pl.spacepioneers.game.service;

import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.data.BuildingDef;
import pl.spacepioneers.engine.economy.Economy;
import pl.spacepioneers.engine.economy.TechLevels;
import pl.spacepioneers.game.model.BuildOrder;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.ResearchJob;
import pl.spacepioneers.game.model.ShipyardOrder;
import pl.spacepioneers.game.store.DueEvent;
import pl.spacepioneers.game.store.GameStore;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Uplyw czasu w grze. Stan jest aktualizowany leniwie: przed kazda operacja swiat jest
 * "doganiany" do biezacej chwili - zdarzenia (koniec budowy, badania, przylot floty)
 * obslugiwane sa w kolejnosci chronologicznej, a planety naliczaja produkcje do chwili zdarzenia.
 */
public final class World {

    private static final int MAX_EVENTS_PER_CATCHUP = 100_000;

    private final GameContext ctx;
    private MissionProcessor missions;

    public World(GameContext ctx) {
        this.ctx = ctx;
    }

    void setMissions(MissionProcessor missions) {
        this.missions = missions;
    }

    /** Obsluguje wszystkie zdarzenia do chwili {@code now}. Wywolywac wewnatrz transakcji. */
    public void catchUp(Instant now) {
        GameStore store = ctx.store();
        for (int i = 0; i < MAX_EVENTS_PER_CATCHUP; i++) {
            Optional<DueEvent> next = store.nextDueEvent(now);
            if (next.isEmpty()) {
                return;
            }
            DueEvent e = next.get();
            switch (e.type()) {
                case BUILDING -> completeBuilding(e.id(), e.at());
                case RESEARCH -> completeResearch(e.id(), e.at());
                case FLEET -> missions.handle(e.id(), e.at());
            }
        }
        throw new IllegalStateException("Przekroczono limit zdarzen w jednym przebiegu");
    }

    public void catchUp() {
        catchUp(ctx.now());
    }

    /** Nalicza produkcje i postep stoczni do chwili {@code t}. Nie zapisuje planety. */
    public Planet advance(Planet planet, Instant t) {
        Player owner = ctx.requirePlayer(planet.getOwnerId());
        return advance(planet, owner, t);
    }

    public Planet advance(Planet planet, Player owner, Instant t) {
        Instant from = planet.getLastUpdate();
        if (from == null) {
            planet.setLastUpdate(t);
            return planet;
        }
        if (!t.isAfter(from)) {
            return planet;
        }
        if (!owner.inVacation()) {
            Economy economy = ctx.economy();
            TechLevels tech = new TechLevels(owner.getResearch());
            Resources perHour = economy.production(planet.snapshot(), tech).perHour();
            Resources cap = economy.storageCapacity(planet.snapshot());
            double seconds = Duration.between(from, t).toMillis() / 1000.0;
            planet.setResources(Economy.accrue(planet.getResources(), perHour, cap, seconds));
        }
        advanceShipyard(planet, t);
        planet.setLastUpdate(t);
        return planet;
    }

    private void advanceShipyard(Planet planet, Instant t) {
        List<ShipyardOrder> queue = new ArrayList<>(planet.getShipyardQueue());
        boolean changed = false;
        while (!queue.isEmpty()) {
            ShipyardOrder head = queue.get(0);
            Instant start = head.progressStart();
            if (start == null) {
                // poprzednie zlecenie zakonczylo sie wczesniej - nie powinno sie zdarzyc, ale zabezpieczenie
                head = new ShipyardOrder(head.id(), head.unit(), head.count(), head.done(), head.secondsPerUnit(), t);
                queue.set(0, head);
                changed = true;
                break;
            }
            long elapsed = Duration.between(start, t).getSeconds();
            if (elapsed < head.secondsPerUnit()) {
                break;
            }
            long finished = Math.min(head.remaining(), elapsed / head.secondsPerUnit());
            planet.addUnits(head.unit(), finished);
            Instant newStart = start.plusSeconds(finished * head.secondsPerUnit());
            changed = true;
            if (finished == head.remaining()) {
                queue.remove(0);
                if (!queue.isEmpty()) {
                    ShipyardOrder n = queue.get(0);
                    queue.set(0, new ShipyardOrder(n.id(), n.unit(), n.count(), n.done(), n.secondsPerUnit(), newStart));
                }
            } else {
                queue.set(0, new ShipyardOrder(head.id(), head.unit(), head.count(), head.done() + finished,
                        head.secondsPerUnit(), newStart));
                break;
            }
        }
        if (changed) {
            planet.setShipyardQueue(queue);
        }
    }

    // --- budynki

    void completeBuilding(long planetId, Instant at) {
        GameStore store = ctx.store();
        Planet planet = store.planet(planetId).orElseThrow();
        Player owner = ctx.requirePlayer(planet.getOwnerId());
        advance(planet, owner, at);
        List<BuildOrder> queue = new ArrayList<>(planet.getBuildQueue());
        BuildOrder done = queue.remove(0);
        if (done.level() <= 0) {
            planet.getBuildings().remove(done.building());
        } else {
            planet.getBuildings().put(done.building(), done.level());
        }
        planet.setBuildQueue(queue);
        startNextBuild(planet, owner, at);
        store.save(planet);
    }

    /**
     * Rozpoczyna pierwsza oczekujaca pozycje kolejki. Pozycje, ktorych nie da sie juz rozpoczac
     * (np. laboratorium w trakcie badan), sa usuwane z pelnym zwrotem kosztu.
     */
    void startNextBuild(Planet planet, Player owner, Instant at) {
        List<BuildOrder> queue = new ArrayList<>(planet.getBuildQueue());
        while (!queue.isEmpty() && !queue.get(0).started()) {
            BuildOrder next = queue.get(0);
            String blocker = buildBlocker(planet, owner, next.building());
            if (blocker != null) {
                queue.remove(0);
                planet.setResources(planet.getResources().plus(next.cost()));
                continue;
            }
            BuildingDef def = ctx.data().building(next.building());
            Resources timeBase = next.demolish() ? def.costForLevel(next.level() + 1) : next.cost();
            long seconds = ctx.timing().buildingSeconds(timeBase, planet.snapshot());
            if (next.demolish()) seconds = Math.max(1, seconds / 2);
            queue.set(0, next.startAt(at, seconds));
        }
        planet.setBuildQueue(queue);
    }

    /** Powod, dla ktorego budynku nie mozna teraz rozbudowywac (null = mozna). */
    String buildBlocker(Planet planet, Player owner, String building) {
        if ("research_lab".equals(building)) {
            ResearchJob job = owner.getResearchJob();
            if (job != null && job.planetId() == planet.getId()) {
                return "lab_busy";
            }
        }
        if (("shipyard".equals(building) || "nanite_factory".equals(building)) && !planet.getShipyardQueue().isEmpty()) {
            return "shipyard_busy";
        }
        return null;
    }

    // --- badania

    void completeResearch(long playerId, Instant at) {
        GameStore store = ctx.store();
        Player player = ctx.requirePlayer(playerId);
        ResearchJob job = player.getResearchJob();
        // Zakonczenie badania zmienia produkcje (technologia energetyczna), wiec planety gracza
        // musza naliczyc produkcje do tej chwili ze starym poziomem.
        for (Planet p : store.planetsOf(playerId)) {
            advance(p, player, at);
            store.save(p);
        }
        player.getResearch().put(job.research(), job.level());
        player.setResearchJob(null);
        store.save(player);
    }
}
