package pl.spacepioneers.game.service;

import pl.spacepioneers.engine.Rules;
import pl.spacepioneers.engine.common.Branch;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.data.BuildingDef;
import pl.spacepioneers.engine.data.GrowthFormula;
import pl.spacepioneers.engine.economy.Economy;
import pl.spacepioneers.engine.economy.PlanetSnapshot;
import pl.spacepioneers.engine.economy.ProductionReport;
import pl.spacepioneers.engine.economy.RequirementChecker;
import pl.spacepioneers.engine.economy.TechLevels;
import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.BuildOrder;
import pl.spacepioneers.game.model.Fleet;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.ResearchJob;
import pl.spacepioneers.game.store.GameStore;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** Planety: przeglad, budynki, kolejka budowy, ustawienia produkcji. */
public final class PlanetService extends ServiceBase {

    public static final int MAX_BUILD_QUEUE = 5;
    public static final double DEMOLISH_COST_FACTOR = 0.5;
    private static final Pattern PLANET_NAME = Pattern.compile("^[\\p{L}\\p{N} ._-]{1,20}$");

    public PlanetService(GameContext ctx, World world) {
        super(ctx, world);
    }

    // --- widoki

    public Views.Overview overview(long playerId, long planetId) {
        return tx(now -> {
            GameStore store = ctx.store();
            Player player = ctx.requirePlayer(playerId);
            Planet planet = ownPlanet(playerId, planetId, now);
            store.save(planet);
            PlanetSnapshot snap = planet.snapshot();
            TechLevels tech = new TechLevels(player.getResearch());
            ProductionReport prod = ctx.economy().production(snap, tech);
            Resources cap = ctx.economy().storageCapacity(snap);

            List<Views.FleetMovement> fleets = new ArrayList<>();
            for (Fleet f : store.fleetsOf(playerId)) {
                fleets.add(movement(f, true, player.getUsername()));
            }
            for (Fleet f : store.fleetsTargeting(playerId)) {
                String owner = store.player(f.getOwnerId()).map(Player::getUsername).orElse("?");
                fleets.add(movement(f, false, owner));
            }
            fleets.sort(Comparator.comparing(Views.FleetMovement::nextAt));

            ResearchJob job = player.getResearchJob();
            int playerCount = store.rankedPlayerCount();
            return new Views.Overview(now, playerId, player.getUsername(), ref(planet), planetRefs(playerId),
                    Economy.usedFields(snap), ctx.economy().maxFields(snap),
                    planet.getTemperatureMin(), planet.getTemperatureMax(),
                    new Views.ResourceState(planet.getResources().floor(), prod.perHour(), cap,
                            prod.energyProduced(), prod.energyUsed(), prod.efficiency()),
                    planet.getBuildQueue().stream().map(PlanetService::queueItem).toList(),
                    planet.getShipyardQueue().stream().map(o -> new Views.ShipyardItem(o.id(), o.unit(), o.count(),
                            o.done(), o.secondsPerUnit(), o.progressStart(), o.finishAt())).toList(),
                    job == null ? null : new Views.ResearchInProgress(job.research(), job.level(), job.planetId(),
                            job.start(), job.end()),
                    fleets,
                    Math.floor(player.getScore().total()), player.getRank(), playerCount,
                    store.unreadCount(playerId), player.getBranch().name(),
                    player.getBranch() == Branch.NONE && player.getScore().total() >= Rules.BRANCH_MIN_POINTS,
                    player.inVacation(), forumUnread(player));
        });
    }

    /** Zestawienie wszystkich planet gracza (widok "Imperium"). */
    public List<Views.EmpirePlanet> empire(long playerId) {
        return tx(now -> {
            Player player = ctx.requirePlayer(playerId);
            TechLevels tech = new TechLevels(player.getResearch());
            List<Views.EmpirePlanet> out = new ArrayList<>();
            List<Planet> planets = new ArrayList<>(ctx.store().planetsOf(playerId));
            planets.sort(Comparator.comparing((Planet p) -> !p.isHomeworld()).thenComparingLong(Planet::getId));
            for (Planet planet : planets) {
                world.advance(planet, player, now);
                ctx.store().save(planet);
                PlanetSnapshot snap = planet.snapshot();
                ProductionReport prod = ctx.economy().production(snap, tech);
                out.add(new Views.EmpirePlanet(ref(planet), Economy.usedFields(snap), ctx.economy().maxFields(snap),
                        planet.getResources().floor(), prod.perHour(), prod.energyBalance(),
                        Map.copyOf(planet.getBuildings()), Map.copyOf(planet.getUnits())));
            }
            return out;
        });
    }

    public List<Views.PlanetRef> planets(long playerId) {
        return tx(now -> planetRefs(playerId));
    }

    private List<Views.PlanetRef> planetRefs(long playerId) {
        return ctx.store().planetsOf(playerId).stream()
                .sorted(Comparator.comparing((Planet p) -> !p.isHomeworld()).thenComparing(Planet::coordinates,
                        Comparator.comparingInt(pl.spacepioneers.engine.common.Coordinates::galaxy)
                                .thenComparingInt(pl.spacepioneers.engine.common.Coordinates::system)
                                .thenComparingInt(pl.spacepioneers.engine.common.Coordinates::position))
                        .thenComparing(Planet::isMoon))
                .map(PlanetService::ref).toList();
    }

    static Views.PlanetRef ref(Planet p) {
        return new Views.PlanetRef(p.getId(), p.getName(), p.coordinates().toString(), p.getPlanetType(),
                p.getImageVariant(), p.isHomeworld(), p.isMoon());
    }

    static Views.BuildQueueItem queueItem(BuildOrder o) {
        return new Views.BuildQueueItem(o.id(), o.building(), o.level(), o.demolish(), o.cost(), o.start(), o.end());
    }

    private int forumUnread(Player p) {
        if (p.getAllianceId() == null) return 0;
        return (int) ctx.store().threads(p.getAllianceId()).stream()
                .filter(t -> {
                    var seen = p.getForumRead().get(t.id());
                    return seen == null || seen < t.lastPostId();
                }).count();
    }

    static Views.FleetMovement movement(Fleet f, boolean own, String ownerName) {
        return new Views.FleetMovement(f.getId(), f.getMission().name(), f.getStatus().name(), own, ownerName,
                f.getOrigin().toString(), f.getTarget().toString(), f.isTargetMoon(), own ? f.getUnionId() : null,
                f.getDepartAt(), f.getArriveAt(), f.getHoldUntil(), own ? f.getReturnAt() : null,
                own ? f.getShips() : Map.of(), own ? f.getCargo() : null);
    }

    public List<Views.UpgradeOption> buildings(long playerId, long planetId) {
        return tx(now -> {
            Player player = ctx.requirePlayer(playerId);
            Planet planet = ownPlanet(playerId, planetId, now);
            PlanetSnapshot planned = plannedSnapshot(planet);
            TechLevels tech = new TechLevels(player.getResearch());
            List<Views.UpgradeOption> out = new ArrayList<>();
            for (BuildingDef def : ctx.data().buildings()) {
                if (!def.allowedOn(planet.isMoon())) continue;
                int level = planet.level(def.key());
                int next = planet.plannedLevel(def.key()) + 1;
                Resources cost = next <= def.maxLevelOrDefault() ? def.costForLevel(next) : Resources.ZERO;
                long seconds = ctx.timing().buildingSeconds(cost, planned);
                List<String> missing = RequirementChecker.missing(def.requirements(), planned, tech);
                String blocker = buildBlocker(planet, player, def, next, planned);
                out.add(new Views.UpgradeOption(def.key(), def.category(), level, next, cost, seconds, missing,
                        blocker, planet.getResources().covers(cost), def.branch().name(), energyDelta(def, next)));
            }
            return out;
        });
    }

    private static Double energyDelta(BuildingDef def, int nextLevel) {
        GrowthFormula use = def.energyUse();
        GrowthFormula prod = def.energyProduction();
        if (use != null) {
            return -(use.valueAt(nextLevel, 0) - use.valueAt(nextLevel - 1, 0));
        }
        if (prod != null) {
            return prod.valueAt(nextLevel, 0) - prod.valueAt(nextLevel - 1, 0);
        }
        return null;
    }

    /** Stan planety po wykonaniu calej kolejki budowy (do sprawdzania wymagan i pol). */
    private PlanetSnapshot plannedSnapshot(Planet planet) {
        Map<String, Integer> levels = new HashMap<>(planet.getBuildings());
        for (BuildOrder o : planet.getBuildQueue()) {
            levels.put(o.building(), o.level());
        }
        return new PlanetSnapshot(levels, planet.getUnits(), planet.getTemperatureMax(), planet.getFields(),
                planet.getProductionPercent(), planet.isMoon());
    }

    private String buildBlocker(Planet planet, Player player, BuildingDef def, int next, PlanetSnapshot planned) {
        if (!RequirementChecker.branchAllows(def.branch(), player.getBranch())) return "branch_locked";
        if (next > def.maxLevelOrDefault()) return "max_level";
        if (planet.getBuildQueue().size() >= MAX_BUILD_QUEUE) return "queue_full";
        if (Economy.usedFields(planned) >= ctx.economy().maxFields(planned)) return "no_fields";
        if (planet.getBuildQueue().isEmpty()) {
            return world.buildBlocker(planet, player, def.key());
        }
        return null;
    }

    // --- kolejka budowy

    public Views.BuildQueueItem enqueue(long playerId, long planetId, String key) {
        return tx(now -> {
            Player player = ctx.requirePlayer(playerId);
            requireActive(player);
            Planet planet = ownPlanet(playerId, planetId, now);
            BuildingDef def = ctx.data().findBuilding(key)
                    .orElseThrow(() -> GameException.notFound("budynek " + key));
            if (!def.allowedOn(planet.isMoon())) {
                throw new GameException("wrong_location", planet.isMoon() ? "Tego budynku nie można postawić na księżycu."
                        : "Ten budynek można postawić tylko na księżycu.");
            }
            PlanetSnapshot planned = plannedSnapshot(planet);
            int next = planet.plannedLevel(key) + 1;
            String blocker = buildBlocker(planet, player, def, next, planned);
            if (blocker != null) {
                throw new GameException(blocker, blockerMessage(blocker));
            }
            List<String> missing = RequirementChecker.missing(def.requirements(), planned,
                    new TechLevels(player.getResearch()));
            if (!missing.isEmpty()) {
                throw new GameException("requirements", "Niespełnione wymagania: " + String.join(", ", missing));
            }
            Resources cost = def.costForLevel(next);
            pay(planet, cost);
            BuildOrder order = new BuildOrder(ctx.store().nextId("build"), key, next, false, cost, null, null);
            planet.getBuildQueue().add(order);
            world.startNextBuild(planet, player, now);
            ctx.store().save(planet);
            return planet.getBuildQueue().stream().filter(o -> o.id() == order.id()).findFirst()
                    .map(PlanetService::queueItem).orElseThrow();
        });
    }

    public Views.BuildQueueItem demolish(long playerId, long planetId, String key) {
        return tx(now -> {
            Player player = ctx.requirePlayer(playerId);
            requireActive(player);
            Planet planet = ownPlanet(playerId, planetId, now);
            BuildingDef def = ctx.data().findBuilding(key)
                    .orElseThrow(() -> GameException.notFound("budynek " + key));
            int current = planet.plannedLevel(key);
            if (current < 1) {
                throw new GameException("nothing_to_demolish", "Ten budynek nie istnieje na planecie.");
            }
            if (planet.getBuildQueue().size() >= MAX_BUILD_QUEUE) {
                throw new GameException("queue_full", blockerMessage("queue_full"));
            }
            if (planet.getBuildQueue().isEmpty()) {
                String b = world.buildBlocker(planet, player, key);
                if (b != null) throw new GameException(b, blockerMessage(b));
            }
            Resources cost = def.costForLevel(current).times(DEMOLISH_COST_FACTOR).floor();
            pay(planet, cost);
            BuildOrder order = new BuildOrder(ctx.store().nextId("build"), key, current - 1, true, cost, null, null);
            planet.getBuildQueue().add(order);
            world.startNextBuild(planet, player, now);
            ctx.store().save(planet);
            return planet.getBuildQueue().stream().filter(o -> o.id() == order.id()).findFirst()
                    .map(PlanetService::queueItem).orElseThrow();
        });
    }

    /**
     * Anuluje pozycje kolejki wraz z pozniejszymi pozycjami tego samego budynku (ktore od niej zaleza).
     * Koszt zwracany jest w calosci.
     */
    public void cancelBuild(long playerId, long planetId, long orderId) {
        txRun(now -> {
            Player player = ctx.requirePlayer(playerId);
            Planet planet = ownPlanet(playerId, planetId, now);
            List<BuildOrder> queue = new ArrayList<>(planet.getBuildQueue());
            int idx = -1;
            for (int i = 0; i < queue.size(); i++) {
                if (queue.get(i).id() == orderId) idx = i;
            }
            if (idx < 0) {
                throw GameException.notFound("pozycja kolejki " + orderId);
            }
            String building = queue.get(idx).building();
            Resources refund = Resources.ZERO;
            List<BuildOrder> kept = new ArrayList<>();
            for (int i = 0; i < queue.size(); i++) {
                BuildOrder o = queue.get(i);
                if (i >= idx && o.building().equals(building)) {
                    refund = refund.plus(o.cost());
                } else {
                    kept.add(o);
                }
            }
            planet.setResources(planet.getResources().plus(refund));
            planet.setBuildQueue(kept);
            world.startNextBuild(planet, player, now);
            ctx.store().save(planet);
        });
    }

    static String blockerMessage(String code) {
        return switch (code) {
            case "branch_locked" -> "Ten budynek jest dostępny tylko dla innej specjalizacji.";
            case "max_level" -> "Osiągnięto maksymalny poziom.";
            case "queue_full" -> "Kolejka budowy jest pełna.";
            case "no_fields" -> "Brak wolnych pól zabudowy na planecie.";
            case "lab_busy" -> "Laboratorium jest zajęte prowadzonym badaniem.";
            case "shipyard_busy" -> "Stocznia pracuje - poczekaj na zakończenie produkcji.";
            case "lab_upgrading" -> "Laboratorium jest rozbudowywane.";
            case "shipyard_upgrading" -> "Stocznia jest rozbudowywana.";
            case "research_running" -> "Trwa już inne badanie.";
            default -> code;
        };
    }

    // --- surowce i produkcja

    public Views.ResourcesView resources(long playerId, long planetId) {
        return tx(now -> {
            Player player = ctx.requirePlayer(playerId);
            Planet planet = ownPlanet(playerId, planetId, now);
            ctx.store().save(planet);
            PlanetSnapshot snap = planet.snapshot();
            ProductionReport prod = ctx.economy().production(snap, new TechLevels(player.getResearch()));
            List<Views.ProductionLine> lines = new ArrayList<>();
            lines.add(new Views.ProductionLine("base", 0, null, prod.perSource().get("base"), null));
            for (BuildingDef def : ctx.data().buildings()) {
                int level = planet.level(def.key());
                if (level <= 0) continue;
                boolean relevant = def.production() != null || def.energyProduction() != null
                        || def.energyUse() != null || def.tritiumUse() != null;
                if (!relevant) continue;
                lines.add(new Views.ProductionLine(def.key(), level, (int) Math.round(snap.percent(def.key()) * 100),
                        prod.perSource().getOrDefault(def.key(), Resources.ZERO),
                        prod.energyPerSource().get(def.key())));
            }
            long sats = planet.count(Economy.SOLAR_SATELLITE);
            if (sats > 0) {
                lines.add(new Views.ProductionLine(Economy.SOLAR_SATELLITE, (int) sats,
                        (int) Math.round(snap.percent(Economy.SOLAR_SATELLITE) * 100), Resources.ZERO,
                        prod.energyPerSource().get(Economy.SOLAR_SATELLITE)));
            }
            return new Views.ResourcesView(ref(planet), planet.getResources().floor(),
                    ctx.economy().storageCapacity(snap), prod.perHour(), prod.energyProduced(), prod.energyUsed(),
                    prod.efficiency(), lines);
        });
    }

    public void setProduction(long playerId, long planetId, String key, int percent) {
        txRun(now -> {
            if (percent < 0 || percent > 100 || percent % 10 != 0) {
                throw new GameException("invalid_percent", "Dozwolone wartości: 0-100% co 10%.");
            }
            boolean valid = Economy.SOLAR_SATELLITE.equals(key) || ctx.data().findBuilding(key)
                    .map(d -> d.production() != null || d.energyProduction() != null || d.energyUse() != null)
                    .orElse(false);
            if (!valid) {
                throw new GameException("invalid_source", "Tego źródła nie można regulować.");
            }
            Planet planet = ownPlanet(playerId, planetId, now);
            planet.getProductionPercent().put(key, percent);
            ctx.store().save(planet);
        });
    }

    // --- zarzadzanie planeta

    public void rename(long playerId, long planetId, String name) {
        txRun(now -> {
            String trimmed = name == null ? "" : name.trim();
            if (!PLANET_NAME.matcher(trimmed).matches()) {
                throw new GameException("invalid_name", "Nazwa planety: 1-20 znaków (litery, cyfry, spacja, . _ -).");
            }
            Planet planet = ownPlanet(playerId, planetId, now);
            planet.setName(trimmed);
            ctx.store().save(planet);
        });
    }

    public void abandon(long playerId, long planetId) {
        txRun(now -> {
            Player player = ctx.requirePlayer(playerId);
            Planet planet = ownPlanet(playerId, planetId, now);
            if (planet.isHomeworld()) {
                throw new GameException("homeworld", "Nie można porzucić planety macierzystej.");
            }
            boolean fleetsInvolved = ctx.store().allFleets().stream().anyMatch(f ->
                    f.getOrigin().equals(planet.coordinates()) || f.getTarget().equals(planet.coordinates()));
            if (fleetsInvolved) {
                throw new GameException("fleets_in_flight", "Do lub z tej planety lecą floty.");
            }
            ResearchJob job = player.getResearchJob();
            if (job != null && job.planetId() == planetId) {
                throw new GameException("research_running", "Na tej planecie trwa badanie.");
            }
            ctx.store().deletePlanet(planetId);
            if (!planet.isMoon()) {
                ctx.store().moonAt(planet.coordinates()).ifPresent(m -> ctx.store().deletePlanet(m.getId()));
            }
        });
    }
}
