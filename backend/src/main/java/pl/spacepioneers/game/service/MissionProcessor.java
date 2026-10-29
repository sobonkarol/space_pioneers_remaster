package pl.spacepioneers.game.service;

import pl.spacepioneers.engine.Rules;
import pl.spacepioneers.engine.combat.CombatResult;
import pl.spacepioneers.engine.combat.Combatant;
import pl.spacepioneers.engine.combat.Espionage;
import pl.spacepioneers.engine.common.Coordinates;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.data.UnitDef;
import pl.spacepioneers.engine.economy.PlanetGenerator;
import pl.spacepioneers.engine.fleet.FleetMath;
import pl.spacepioneers.game.model.DebrisField;
import pl.spacepioneers.game.model.Fleet;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.store.GameStore;
import pl.spacepioneers.game.store.Json;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;

/** Obsluga przylotow i powrotow flot - realizacja misji. */
public final class MissionProcessor {

    private final GameContext ctx;
    private final World world;
    private final Mailer mailer;

    public MissionProcessor(GameContext ctx, World world, Mailer mailer) {
        this.ctx = ctx;
        this.world = world;
        this.mailer = mailer;
        world.setMissions(this);
    }

    void handle(long fleetId, Instant at) {
        Fleet fleet = ctx.store().fleet(fleetId).orElseThrow();
        if (fleet.getStatus() == Fleet.Status.RETURNING) {
            handleReturn(fleet, at);
            return;
        }
        switch (fleet.getMission()) {
            case TRANSPORT -> transport(fleet, at);
            case DEPLOY -> deploy(fleet, at);
            case ATTACK -> attack(fleet, at);
            case ESPIONAGE -> espionage(fleet, at);
            case COLONIZE -> colonize(fleet, at);
            case RECYCLE -> recycle(fleet, at);
        }
    }

    // --- powrot

    private void handleReturn(Fleet fleet, Instant at) {
        GameStore store = ctx.store();
        Planet home = store.planet(fleet.getOriginPlanetId())
                .filter(p -> p.getOwnerId() == fleet.getOwnerId())
                .orElseGet(() -> {
                    Player owner = ctx.requirePlayer(fleet.getOwnerId());
                    return store.planet(owner.getHomePlanetId()).orElseThrow();
                });
        world.advance(home, at);
        fleet.getShips().forEach(home::addUnits);
        home.setResources(home.getResources().plus(fleet.getCargo()));
        store.save(home);
        store.deleteFleet(fleet.getId());
        mailer.system(fleet.getOwnerId(), Message.Type.FLEET, "Powrót floty",
                "Flota powróciła z [" + fleet.getTarget() + "] na planetę " + home.getName() + " [" + home.coordinates() + "]. "
                        + "Ładunek: " + describe(fleet.getCargo()) + ".", at);
    }

    private void sendBack(Fleet fleet, Instant at) {
        Duration flight = Duration.between(fleet.getDepartAt(), fleet.getArriveAt());
        fleet.setStatus(Fleet.Status.RETURNING);
        fleet.setReturnAt(at.plus(flight));
        ctx.store().save(fleet);
    }

    // --- transport i stacjonowanie

    private void transport(Fleet fleet, Instant at) {
        GameStore store = ctx.store();
        Optional<Planet> target = store.planetAt(fleet.getTarget());
        if (target.isEmpty()) {
            mailer.system(fleet.getOwnerId(), Message.Type.FLEET, "Transport nieudany",
                    "Na pozycji [" + fleet.getTarget() + "] nie ma już planety. Flota zawraca.", at);
            sendBack(fleet, at);
            return;
        }
        Planet planet = world.advance(target.get(), at);
        planet.setResources(planet.getResources().plus(fleet.getCargo()));
        store.save(planet);
        String body = "Flota dotarła na planetę " + planet.getName() + " [" + planet.coordinates() + "] i dostarczyła: "
                + describe(fleet.getCargo()) + ".";
        mailer.system(fleet.getOwnerId(), Message.Type.FLEET, "Dostarczono surowce", body, at);
        if (planet.getOwnerId() != fleet.getOwnerId()) {
            Player sender = ctx.requirePlayer(fleet.getOwnerId());
            mailer.system(planet.getOwnerId(), Message.Type.FLEET, "Otrzymano surowce",
                    "Gracz " + sender.getUsername() + " dostarczył na planetę " + planet.getName() + " ["
                            + planet.coordinates() + "]: " + describe(fleet.getCargo()) + ".", at);
        }
        fleet.setCargo(Resources.ZERO);
        sendBack(fleet, at);
    }

    private void deploy(Fleet fleet, Instant at) {
        GameStore store = ctx.store();
        Optional<Planet> target = store.planetAt(fleet.getTarget()).filter(p -> p.getOwnerId() == fleet.getOwnerId());
        if (target.isEmpty()) {
            mailer.system(fleet.getOwnerId(), Message.Type.FLEET, "Stacjonowanie nieudane",
                    "Planeta docelowa [" + fleet.getTarget() + "] nie należy już do ciebie. Flota zawraca.", at);
            sendBack(fleet, at);
            return;
        }
        Planet planet = world.advance(target.get(), at);
        fleet.getShips().forEach(planet::addUnits);
        planet.setResources(planet.getResources().plus(fleet.getCargo()));
        store.save(planet);
        store.deleteFleet(fleet.getId());
        mailer.system(fleet.getOwnerId(), Message.Type.FLEET, "Flota stacjonuje",
                "Flota dotarła na planetę " + planet.getName() + " [" + planet.coordinates() + "] i pozostaje tam. "
                        + "Ładunek: " + describe(fleet.getCargo()) + ".", at);
    }

    // --- atak

    private void attack(Fleet fleet, Instant at) {
        GameStore store = ctx.store();
        Optional<Planet> target = store.planetAt(fleet.getTarget());
        if (target.isEmpty()) {
            mailer.system(fleet.getOwnerId(), Message.Type.FLEET, "Atak nieudany",
                    "Na pozycji [" + fleet.getTarget() + "] nie ma już planety. Flota zawraca.", at);
            sendBack(fleet, at);
            return;
        }
        Player attacker = ctx.requirePlayer(fleet.getOwnerId());
        Player defender = ctx.requirePlayer(target.get().getOwnerId());
        if (defender.inVacation() || defender.getId() == attacker.getId()) {
            mailer.system(fleet.getOwnerId(), Message.Type.FLEET, "Atak nieudany",
                    "Cel [" + fleet.getTarget() + "] nie może zostać zaatakowany. Flota zawraca.", at);
            sendBack(fleet, at);
            return;
        }
        Planet planet = world.advance(target.get(), defender, at);

        Combatant att = new Combatant(attacker.getId(), fleet.getShips(),
                attacker.researchLevel("weapons_tech"), attacker.researchLevel("shielding_tech"),
                attacker.researchLevel("armour_tech"), Rules.attackBonus(attacker.getBranch(), warAcademy(attacker)));
        Combatant def = new Combatant(defender.getId(), planet.getUnits(),
                defender.researchLevel("weapons_tech"), defender.researchLevel("shielding_tech"),
                defender.researchLevel("armour_tech"), Rules.attackBonus(defender.getBranch(), warAcademy(defender)));
        CombatResult result = ctx.combat().simulate(List.of(att), List.of(def), ctx.seed());

        // stan po walce
        Map<String, Long> defenderAfter = new HashMap<>(result.defenderSurvivors().get(0));
        result.defenseRebuilt().forEach((k, v) -> defenderAfter.merge(k, v, Long::sum));
        planet.setUnits(defenderAfter);

        Map<String, Long> survivors = result.attackerSurvivors().get(0);
        Resources loot = Resources.ZERO;
        if (result.outcome() == CombatResult.Outcome.ATTACKER && !survivors.isEmpty()) {
            long capacity = ctx.fleetMath().cargoCapacity(survivors, attacker.getBranch());
            long free = Math.max(0, capacity - (long) fleet.getCargo().total());
            loot = FleetMath.plunder(planet.getResources(), free, ctx.config().lootRatio());
            planet.setResources(planet.getResources().minus(loot));
        }
        store.save(planet);

        if (!result.debris().isZero()) {
            DebrisField existing = store.debris(planet.coordinates())
                    .orElse(new DebrisField(planet.coordinates(), Resources.ZERO));
            store.save(new DebrisField(planet.coordinates(), existing.resources().plus(result.debris())));
        }

        Reports.CombatReport report = combatReport(result, fleet, attacker, defender, planet, loot, at);
        String payload = Json.write(report);
        String subject = "Raport z walki [" + planet.coordinates() + "]";
        String summary = summary(result, loot);
        mailer.send(attacker.getId(), null, null, Message.Type.COMBAT, subject, summary, payload, at);
        mailer.send(defender.getId(), null, null, Message.Type.COMBAT, subject, summary, payload, at);

        if (survivors.isEmpty()) {
            store.deleteFleet(fleet.getId());
            return;
        }
        fleet.setShips(survivors);
        fleet.setCargo(fleet.getCargo().plus(loot));
        sendBack(fleet, at);
    }

    private int warAcademy(Player p) {
        int best = 0;
        for (Planet planet : ctx.store().planetsOf(p.getId())) {
            best = Math.max(best, planet.level("war_academy"));
        }
        return best;
    }

    private Reports.CombatReport combatReport(CombatResult r, Fleet fleet, Player attacker, Player defender,
                                              Planet planet, Resources loot, Instant at) {
        List<Reports.RoundView> rounds = r.rounds().stream().map(x -> new Reports.RoundView(x.number(),
                x.attackerShots(), Math.round(x.attackerDamage()), Math.round(x.absorbedByDefender()),
                x.defenderShots(), Math.round(x.defenderDamage()), Math.round(x.absorbedByAttacker()),
                x.attackersAfter().get(0), x.defendersAfter().get(0))).toList();
        return new Reports.CombatReport(at, planet.coordinates().toString(), planet.getName(),
                new Reports.Side(attacker.getId(), attacker.getUsername(), fleet.getOrigin().toString(),
                        attacker.researchLevel("weapons_tech"), attacker.researchLevel("shielding_tech"),
                        attacker.researchLevel("armour_tech")),
                new Reports.Side(defender.getId(), defender.getUsername(), planet.coordinates().toString(),
                        defender.researchLevel("weapons_tech"), defender.researchLevel("shielding_tech"),
                        defender.researchLevel("armour_tech")),
                r.attackerInitial().get(0), r.defenderInitial().get(0), rounds, r.outcome().name(),
                r.attackerLosses().get(0), r.defenderLosses().get(0), r.defenseRebuilt(), loot, r.debris(),
                r.attackerLostValue(), r.defenderLostValue());
    }

    private static String summary(CombatResult r, Resources loot) {
        String outcome = switch (r.outcome()) {
            case ATTACKER -> "Atakujący wygrał bitwę.";
            case DEFENDER -> "Obrońca wygrał bitwę.";
            case DRAW -> "Bitwa zakończyła się remisem.";
        };
        return outcome + " Straty atakującego: " + fmt(r.attackerLostValue().total())
                + ", straty obrońcy: " + fmt(r.defenderLostValue().total())
                + ". Zrabowano: " + describe(loot)
                + ". Pole zniszczeń: " + fmt(r.debris().metal()) + " metalu, " + fmt(r.debris().crystal()) + " kryształu.";
    }

    // --- szpiegostwo

    private void espionage(Fleet fleet, Instant at) {
        GameStore store = ctx.store();
        Optional<Planet> target = store.planetAt(fleet.getTarget());
        if (target.isEmpty()) {
            sendBack(fleet, at);
            return;
        }
        Player spy = ctx.requirePlayer(fleet.getOwnerId());
        Player owner = ctx.requirePlayer(target.get().getOwnerId());
        Planet planet = world.advance(target.get(), owner, at);
        store.save(planet);

        long probes = fleet.getShips().getOrDefault("espionage_probe", 0L);
        int spyTech = spy.researchLevel("espionage_tech");
        int ownerTech = owner.researchLevel("espionage_tech");
        Set<Espionage.Section> sections = Espionage.visibleSections(probes, spyTech, ownerTech);

        Map<String, Long> fleetOnPlanet = new LinkedHashMap<>();
        Map<String, Long> defense = new LinkedHashMap<>();
        long defenderShips = 0;
        for (var e : planet.getUnits().entrySet()) {
            UnitDef def = ctx.data().unit(e.getKey());
            if (def.isShip()) {
                fleetOnPlanet.put(e.getKey(), e.getValue());
                defenderShips += e.getValue();
            } else {
                defense.put(e.getKey(), e.getValue());
            }
        }
        double chance = Espionage.counterEspionageChance(probes, defenderShips, spyTech, ownerTech);
        Random rnd = ctx.random();
        boolean detected = Espionage.detected(chance, rnd);

        Reports.EspionageReport report = new Reports.EspionageReport(at, planet.coordinates().toString(),
                planet.getName(), owner.getId(), owner.getUsername(),
                planet.getResources().floor(),
                sections.contains(Espionage.Section.FLEET) ? fleetOnPlanet : null,
                sections.contains(Espionage.Section.DEFENSE) ? defense : null,
                sections.contains(Espionage.Section.BUILDINGS) ? Map.copyOf(planet.getBuildings()) : null,
                sections.contains(Espionage.Section.RESEARCH) ? Map.copyOf(owner.getResearch()) : null,
                (int) Math.round(chance * 100), detected);
        mailer.send(spy.getId(), null, null, Message.Type.ESPIONAGE,
                "Raport szpiegowski " + planet.getName() + " [" + planet.coordinates() + "]",
                "Surowce: " + describe(planet.getResources()) + ". Szansa na kontrwywiad: " + Math.round(chance * 100) + "%.",
                Json.write(report), at);
        mailer.system(owner.getId(), Message.Type.ESPIONAGE, "Aktywność szpiegowska",
                "Obca flota z planety [" + fleet.getOrigin() + "] (gracz " + spy.getUsername()
                        + ") została zauważona w pobliżu planety " + planet.getName() + " [" + planet.coordinates() + "]."
                        + (detected ? " Sondy zostały zestrzelone." : ""), at);

        if (detected) {
            // sondy nie maja ataku ani oslon - zostaja zniszczone, a ich szczatki trafiaja do pola zniszczen
            UnitDef probe = ctx.data().unit("espionage_probe");
            Resources debris = Resources.of(probe.cost().metal(), probe.cost().crystal(), 0)
                    .times(probes * ctx.config().debrisRatio()).floor();
            if (!debris.isZero()) {
                DebrisField existing = store.debris(planet.coordinates())
                        .orElse(new DebrisField(planet.coordinates(), Resources.ZERO));
                store.save(new DebrisField(planet.coordinates(), existing.resources().plus(debris)));
            }
            store.deleteFleet(fleet.getId());
            return;
        }
        sendBack(fleet, at);
    }

    // --- kolonizacja

    private void colonize(Fleet fleet, Instant at) {
        GameStore store = ctx.store();
        Player owner = ctx.requirePlayer(fleet.getOwnerId());
        Coordinates c = fleet.getTarget();
        String failure = null;
        if (store.planetAt(c).isPresent()) {
            failure = "Pozycja [" + c + "] jest już zajęta.";
        } else if (store.planetsOf(owner.getId()).size() >= Rules.maxPlanets(owner.researchLevel("astrophysics"))) {
            failure = "Osiągnięto limit planet. Rozwiń astrofizykę, aby założyć kolejną kolonię.";
        }
        if (failure != null) {
            mailer.system(owner.getId(), Message.Type.FLEET, "Kolonizacja nieudana", failure + " Flota zawraca.", at);
            sendBack(fleet, at);
            return;
        }
        PlanetGenerator.PlanetTraits traits = PlanetGenerator.colony(c.position(), ctx.random());
        Planet colony = new Planet();
        colony.setId(store.nextId("planet"));
        colony.setOwnerId(owner.getId());
        colony.setName("Kolonia");
        colony.setCoordinates(c);
        colony.setFields(traits.fields());
        colony.setTemperatureMin(traits.temperatureMin());
        colony.setTemperatureMax(traits.temperatureMax());
        colony.setPlanetType(PlanetGenerator.planetType(c.position()));
        colony.setImageVariant(traits.imageVariant());
        colony.setCreatedAt(at);
        colony.setLastUpdate(at);
        colony.setResources(fleet.getCargo());
        Map<String, Long> ships = new HashMap<>(fleet.getShips());
        ships.merge("colony_ship", -1L, Long::sum);
        ships.forEach((k, v) -> {
            if (v > 0) colony.addUnits(k, v);
        });
        store.save(colony);
        store.deleteFleet(fleet.getId());
        mailer.system(owner.getId(), Message.Type.FLEET, "Nowa kolonia",
                "Statek kolonizacyjny założył kolonię na pozycji [" + c + "]. Planeta ma " + traits.fields()
                        + " pól zabudowy.", at);
    }

    // --- recykling

    private void recycle(Fleet fleet, Instant at) {
        GameStore store = ctx.store();
        Optional<DebrisField> field = store.debris(fleet.getTarget());
        long recyclers = fleet.getShips().getOrDefault("recycler", 0L);
        long capacity = recyclers * ctx.data().unit("recycler").cargo();
        long free = Math.max(0, capacity - (long) fleet.getCargo().total());
        Resources got = Resources.ZERO;
        if (field.isPresent()) {
            got = FleetMath.harvest(field.get().resources(), free);
            DebrisField rest = new DebrisField(fleet.getTarget(), field.get().resources().minus(got));
            if (rest.isEmpty()) store.deleteDebris(fleet.getTarget());
            else store.save(rest);
        }
        fleet.setCargo(fleet.getCargo().plus(got));
        mailer.system(fleet.getOwnerId(), Message.Type.FLEET, "Raport recyklera",
                "Recyklery (" + recyclers + ") zebrały z pola zniszczeń [" + fleet.getTarget() + "]: "
                        + describe(got) + ".", at);
        sendBack(fleet, at);
    }

    // --- pomocnicze

    static String describe(Resources r) {
        return fmt(r.metal()) + " metalu, " + fmt(r.crystal()) + " kryształu, " + fmt(r.tritium()) + " trytu";
    }

    static String fmt(double v) {
        return String.format(java.util.Locale.GERMANY, "%,d", (long) Math.floor(v));
    }
}
