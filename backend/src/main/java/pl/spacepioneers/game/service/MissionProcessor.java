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
import pl.spacepioneers.engine.special.Expedition;
import pl.spacepioneers.engine.special.MissileStrike;
import pl.spacepioneers.engine.special.Moons;
import pl.spacepioneers.game.model.DebrisField;
import pl.spacepioneers.game.model.Fleet;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.store.GameStore;
import pl.spacepioneers.game.store.Json;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;

/** Obsluga przylotow, postojow i powrotow flot - realizacja misji. */
public final class MissionProcessor {

    /** Identyfikator uzywany w raportach dla piratow napotkanych podczas ekspedycji. */
    public static final long PIRATES_ID = 0;

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
        switch (fleet.getStatus()) {
            case RETURNING -> handleReturn(fleet, at);
            case HOLDING -> {
                if (fleet.getMission() == Fleet.Mission.EXPEDITION) expeditionResult(fleet, at);
                else holdEnded(fleet, at);
            }
            case OUTBOUND -> {
                switch (fleet.getMission()) {
                    case TRANSPORT -> transport(fleet, at);
                    case DEPLOY -> deploy(fleet, at);
                    case ATTACK -> attack(fleet, at);
                    case ESPIONAGE -> espionage(fleet, at);
                    case COLONIZE -> colonize(fleet, at);
                    case RECYCLE -> recycle(fleet, at);
                    case HOLD -> beginHold(fleet, at);
                    case EXPEDITION -> beginExpedition(fleet, at);
                    case MISSILE -> missileImpact(fleet, at);
                }
            }
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
                "Flota powróciła z [" + fleet.getTarget() + "] na " + bodyName(home) + " [" + home.coordinates() + "]. "
                        + "Ładunek: " + describe(fleet.getCargo()) + ".", at);
    }

    void sendBack(Fleet fleet, Instant at) {
        sendBack(fleet, at, 1.0);
    }

    private void sendBack(Fleet fleet, Instant at, double timeFactor) {
        long seconds = Math.max(1, Math.round(fleet.flightDuration().getSeconds() * timeFactor));
        fleet.setStatus(Fleet.Status.RETURNING);
        fleet.setUnionId(null);
        fleet.setReturnAt(at.plusSeconds(seconds));
        ctx.store().save(fleet);
    }

    private static String bodyName(Planet p) {
        return (p.isMoon() ? "księżyc " : "planetę ") + p.getName();
    }

    // --- transport i stacjonowanie

    private void transport(Fleet fleet, Instant at) {
        GameStore store = ctx.store();
        Optional<Planet> target = store.bodyAt(fleet.getTarget(), fleet.isTargetMoon());
        if (target.isEmpty()) {
            mailer.system(fleet.getOwnerId(), Message.Type.FLEET, "Transport nieudany",
                    "Na pozycji [" + fleet.getTarget() + "] nie ma już celu. Flota zawraca.", at);
            sendBack(fleet, at);
            return;
        }
        Planet planet = world.advance(target.get(), at);
        planet.setResources(planet.getResources().plus(fleet.getCargo()));
        store.save(planet);
        mailer.system(fleet.getOwnerId(), Message.Type.FLEET, "Dostarczono surowce",
                "Flota dotarła na " + bodyName(planet) + " [" + planet.coordinates() + "] i dostarczyła: "
                        + describe(fleet.getCargo()) + ".", at);
        if (planet.getOwnerId() != fleet.getOwnerId()) {
            Player sender = ctx.requirePlayer(fleet.getOwnerId());
            mailer.system(planet.getOwnerId(), Message.Type.FLEET, "Otrzymano surowce",
                    "Gracz " + sender.getUsername() + " dostarczył na " + bodyName(planet) + " ["
                            + planet.coordinates() + "]: " + describe(fleet.getCargo()) + ".", at);
        }
        fleet.setCargo(Resources.ZERO);
        sendBack(fleet, at);
    }

    private void deploy(Fleet fleet, Instant at) {
        GameStore store = ctx.store();
        Optional<Planet> target = store.bodyAt(fleet.getTarget(), fleet.isTargetMoon())
                .filter(p -> p.getOwnerId() == fleet.getOwnerId());
        if (target.isEmpty()) {
            mailer.system(fleet.getOwnerId(), Message.Type.FLEET, "Stacjonowanie nieudane",
                    "Cel [" + fleet.getTarget() + "] nie należy już do ciebie. Flota zawraca.", at);
            sendBack(fleet, at);
            return;
        }
        Planet planet = world.advance(target.get(), at);
        fleet.getShips().forEach(planet::addUnits);
        planet.setResources(planet.getResources().plus(fleet.getCargo()));
        store.save(planet);
        store.deleteFleet(fleet.getId());
        mailer.system(fleet.getOwnerId(), Message.Type.FLEET, "Flota stacjonuje",
                "Flota dotarła na " + bodyName(planet) + " [" + planet.coordinates() + "] i pozostaje tam. "
                        + "Ładunek: " + describe(fleet.getCargo()) + ".", at);
    }

    // --- obrona sojusznicza

    private void beginHold(Fleet fleet, Instant at) {
        GameStore store = ctx.store();
        Optional<Planet> target = store.bodyAt(fleet.getTarget(), fleet.isTargetMoon());
        Player owner = ctx.requirePlayer(fleet.getOwnerId());
        if (target.isEmpty() || !Diplomacy.allied(ctx, owner, ctx.requirePlayer(target.get().getOwnerId()))) {
            mailer.system(fleet.getOwnerId(), Message.Type.FLEET, "Obrona sojusznicza przerwana",
                    "Nie można stacjonować przy celu [" + fleet.getTarget() + "]. Flota zawraca.", at);
            sendBack(fleet, at);
            return;
        }
        fleet.setStatus(Fleet.Status.HOLDING);
        fleet.setHoldUntil(at.plusSeconds(Math.max(1, fleet.getHoldSeconds())));
        store.save(fleet);
        Planet host = target.get();
        mailer.system(fleet.getOwnerId(), Message.Type.FLEET, "Obrona sojusznicza",
                "Flota broni celu " + host.getName() + " [" + host.coordinates() + "] do "
                        + fleet.getHoldUntil() + ".", at);
        mailer.system(host.getOwnerId(), Message.Type.FLEET, "Przybyła flota sojusznika",
                "Flota gracza " + owner.getUsername() + " broni " + bodyName(host) + " [" + host.coordinates() + "].", at);
    }

    private void holdEnded(Fleet fleet, Instant at) {
        sendBack(fleet, at);
    }

    // --- atak (rowniez sojuszniczy)

    private void attack(Fleet fleet, Instant at) {
        GameStore store = ctx.store();
        List<Fleet> attackers = new ArrayList<>();
        if (fleet.getUnionId() != null) {
            for (Fleet f : store.fleetsInUnion(fleet.getUnionId())) {
                if (f.getStatus() == Fleet.Status.OUTBOUND && f.getMission() == Fleet.Mission.ATTACK
                        && !f.getArriveAt().isAfter(at)) {
                    attackers.add(f);
                }
            }
            store.deleteUnion(fleet.getUnionId());
        }
        if (attackers.isEmpty()) attackers.add(fleet);

        Optional<Planet> target = store.bodyAt(fleet.getTarget(), fleet.isTargetMoon());
        if (target.isEmpty()) {
            for (Fleet f : attackers) {
                mailer.system(f.getOwnerId(), Message.Type.FLEET, "Atak nieudany",
                        "Na pozycji [" + f.getTarget() + "] nie ma już celu. Flota zawraca.", at);
                sendBack(f, at);
            }
            return;
        }
        Player defender = ctx.requirePlayer(target.get().getOwnerId());
        if (defender.inVacation()) {
            for (Fleet f : attackers) {
                mailer.system(f.getOwnerId(), Message.Type.FLEET, "Atak nieudany",
                        "Cel [" + f.getTarget() + "] nie może zostać zaatakowany (tryb urlopowy). Flota zawraca.", at);
                sendBack(f, at);
            }
            return;
        }
        attackers.removeIf(f -> {
            if (f.getOwnerId() == defender.getId()) {
                sendBack(f, at);
                return true;
            }
            return false;
        });
        if (attackers.isEmpty()) return;

        Planet planet = world.advance(target.get(), defender, at);
        List<Fleet> held = store.fleetsHoldingAt(planet.coordinates(), planet.isMoon());

        List<Combatant> attackSide = new ArrayList<>();
        List<Player> attackPlayers = new ArrayList<>();
        for (Fleet f : attackers) {
            Player p = ctx.requirePlayer(f.getOwnerId());
            attackPlayers.add(p);
            attackSide.add(combatant(p, f.getShips()));
        }
        List<Combatant> defendSide = new ArrayList<>();
        List<Player> defendPlayers = new ArrayList<>();
        defendPlayers.add(defender);
        defendSide.add(combatant(defender, planet.getUnits()));
        for (Fleet h : held) {
            Player p = ctx.requirePlayer(h.getOwnerId());
            defendPlayers.add(p);
            defendSide.add(combatant(p, h.getShips()));
        }
        CombatResult result = ctx.combat().simulate(attackSide, defendSide, ctx.seed());

        // planeta: ocalali + odbudowana obrona + jednostki niewalczace (rakiety)
        Map<String, Long> after = new HashMap<>(result.defenderSurvivors().get(0));
        result.defenseRebuilt().forEach((k, v) -> after.merge(k, v, Long::sum));
        planet.getUnits().forEach((k, v) -> {
            if (!ctx.data().unit(k).fights()) after.merge(k, v, Long::sum);
        });
        planet.setUnits(after);

        // floty obroncow sojuszniczych
        for (int i = 0; i < held.size(); i++) {
            Fleet h = held.get(i);
            Map<String, Long> survivors = result.defenderSurvivors().get(i + 1);
            if (survivors.isEmpty()) {
                store.deleteFleet(h.getId());
            } else {
                h.setShips(survivors);
                store.save(h);
            }
        }

        // rabunek dzielony proporcjonalnie do wolnej ladownosci
        Resources totalLoot = Resources.ZERO;
        List<Resources> loot = new ArrayList<>();
        long[] free = new long[attackers.size()];
        long freeTotal = 0;
        for (int i = 0; i < attackers.size(); i++) {
            Map<String, Long> survivors = result.attackerSurvivors().get(i);
            loot.add(Resources.ZERO);
            if (survivors.isEmpty()) continue;
            long capacity = ctx.fleetMath().cargoCapacity(survivors, attackPlayers.get(i).getBranch());
            free[i] = Math.max(0, capacity - (long) attackers.get(i).getCargo().total());
            freeTotal += free[i];
        }
        if (result.outcome() == CombatResult.Outcome.ATTACKER && freeTotal > 0) {
            totalLoot = FleetMath.plunder(planet.getResources(), freeTotal, ctx.config().lootRatio());
            planet.setResources(planet.getResources().minus(totalLoot));
            Resources remaining = totalLoot;
            for (int i = 0; i < attackers.size(); i++) {
                if (free[i] == 0) continue;
                Resources share = totalLoot.times((double) free[i] / freeTotal).floor();
                loot.set(i, share);
                remaining = remaining.minus(share);
            }
            for (int i = 0; i < attackers.size(); i++) {
                if (free[i] > 0) {
                    loot.set(i, loot.get(i).plus(remaining));
                    break;
                }
            }
        }
        store.save(planet);

        if (!result.debris().isZero()) {
            DebrisField existing = store.debris(planet.coordinates())
                    .orElse(new DebrisField(planet.coordinates(), Resources.ZERO));
            store.save(new DebrisField(planet.coordinates(), existing.resources().plus(result.debris())));
        }

        // ksiezyc z pola zniszczen
        int moonChance = planet.isMoon() || store.moonAt(planet.coordinates()).isPresent() ? 0 : Moons.chancePercent(result.debris());
        boolean moonCreated = false;
        if (moonChance > 0 && ctx.random().nextInt(100) < moonChance) {
            createMoon(planet, defender, at);
            moonCreated = true;
        }

        Reports.CombatReport report = combatReport(result, attackers, attackPlayers, defendPlayers, planet,
                totalLoot, moonChance, moonCreated, at);
        String payload = Json.write(report);
        String subject = "Raport z walki [" + planet.coordinates() + "]";
        String summary = summary(result, totalLoot) + (moonCreated ? " Z pola zniszczeń powstał księżyc!" : "");
        Set<Long> recipients = new LinkedHashSet<>();
        attackPlayers.forEach(p -> recipients.add(p.getId()));
        defendPlayers.forEach(p -> recipients.add(p.getId()));
        for (long r : recipients) {
            mailer.send(r, null, null, Message.Type.COMBAT, subject, summary, payload, at);
        }

        for (int i = 0; i < attackers.size(); i++) {
            Fleet f = attackers.get(i);
            Map<String, Long> survivors = result.attackerSurvivors().get(i);
            if (survivors.isEmpty()) {
                store.deleteFleet(f.getId());
                continue;
            }
            f.setShips(survivors);
            f.setCargo(f.getCargo().plus(loot.get(i)));
            sendBack(f, at);
        }
    }

    private Combatant combatant(Player p, Map<String, Long> units) {
        return new Combatant(p.getId(), units, p.researchLevel("weapons_tech"), p.researchLevel("shielding_tech"),
                p.researchLevel("armour_tech"), Rules.attackBonus(p.getBranch(), warAcademy(p)));
    }

    private void createMoon(Planet planet, Player owner, Instant at) {
        Planet moon = new Planet();
        moon.setId(ctx.store().nextId("planet"));
        moon.setOwnerId(owner.getId());
        moon.setMoon(true);
        moon.setName("Księżyc");
        moon.setCoordinates(planet.coordinates());
        moon.setFields(Moons.MOON_BASE_FIELDS);
        moon.setTemperatureMin(planet.getTemperatureMin() - 40);
        moon.setTemperatureMax(planet.getTemperatureMax() - 40);
        moon.setPlanetType("moon");
        moon.setImageVariant(1 + ctx.random().nextInt(5));
        moon.setCreatedAt(at);
        moon.setLastUpdate(at);
        ctx.store().save(moon);
    }

    private int warAcademy(Player p) {
        int best = 0;
        for (Planet planet : ctx.store().planetsOf(p.getId())) {
            best = Math.max(best, planet.level("war_academy"));
        }
        return best;
    }

    private Reports.CombatReport combatReport(CombatResult r, List<Fleet> attackers, List<Player> attackPlayers,
                                              List<Player> defendPlayers, Planet planet, Resources loot,
                                              int moonChance, boolean moonCreated, Instant at) {
        List<Reports.Side> aSides = new ArrayList<>();
        for (int i = 0; i < attackPlayers.size(); i++) {
            aSides.add(side(attackPlayers.get(i), attackers.get(i).getOrigin().toString()));
        }
        List<Reports.Side> dSides = new ArrayList<>();
        for (Player p : defendPlayers) dSides.add(side(p, planet.coordinates().toString()));
        return combatReport(r, aSides, dSides, planet.coordinates().toString(), planet.getName(), loot,
                moonChance, moonCreated, at);
    }

    static Reports.CombatReport combatReport(CombatResult r, List<Reports.Side> aSides, List<Reports.Side> dSides,
                                             String coordinates, String placeName, Resources loot, int moonChance,
                                             boolean moonCreated, Instant at) {
        List<Reports.RoundView> rounds = r.rounds().stream().map(x -> new Reports.RoundView(x.number(),
                x.attackerShots(), Math.round(x.attackerDamage()), Math.round(x.absorbedByDefender()),
                x.defenderShots(), Math.round(x.defenderDamage()), Math.round(x.absorbedByAttacker()),
                x.attackersAfter(), x.defendersAfter())).toList();
        return new Reports.CombatReport(at, coordinates, placeName, aSides, dSides,
                r.attackerInitial(), r.defenderInitial(), rounds, r.outcome().name(),
                r.attackerLosses(), r.defenderLosses(), r.defenseRebuilt(), loot, r.debris(),
                r.attackerLostValue(), r.defenderLostValue(), moonChance, moonCreated);
    }

    static Reports.Side side(Player p, String coordinates) {
        return new Reports.Side(p.getId(), p.getUsername(), coordinates, p.researchLevel("weapons_tech"),
                p.researchLevel("shielding_tech"), p.researchLevel("armour_tech"));
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
        Optional<Planet> target = store.bodyAt(fleet.getTarget(), fleet.isTargetMoon());
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
        for (Fleet h : store.fleetsHoldingAt(planet.coordinates(), planet.isMoon())) {
            h.getShips().forEach((k, v) -> fleetOnPlanet.merge(k, v, Long::sum));
        }
        double chance = Espionage.counterEspionageChance(probes, defenderShips, spyTech, ownerTech);
        Random rnd = ctx.random();
        boolean detected = Espionage.detected(chance, rnd);

        Reports.EspionageReport report = new Reports.EspionageReport(at, planet.coordinates().toString(),
                planet.getName(), owner.getId(), owner.getUsername(), planet.isMoon(),
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
                "Obca flota z [" + fleet.getOrigin() + "] (gracz " + spy.getUsername()
                        + ") została zauważona w pobliżu: " + planet.getName() + " [" + planet.coordinates() + "]."
                        + (detected ? " Sondy zostały zestrzelone." : ""), at);

        if (detected) {
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
        } else if (store.planetsOf(owner.getId()).stream().filter(p -> !p.isMoon()).count()
                >= Rules.maxPlanets(owner.researchLevel("astrophysics"))) {
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

    // --- ekspedycje

    private void beginExpedition(Fleet fleet, Instant at) {
        fleet.setStatus(Fleet.Status.HOLDING);
        fleet.setHoldUntil(at.plusSeconds(Math.max(1, fleet.getHoldSeconds())));
        ctx.store().save(fleet);
    }

    private void expeditionResult(Fleet fleet, Instant at) {
        GameStore store = ctx.store();
        Player owner = ctx.requirePlayer(fleet.getOwnerId());
        Expedition.Outcome o = Expedition.resolve(ctx.data(), fleet.getShips(), ctx.random(), ctx.config().economySpeed());
        String where = "[" + fleet.getTarget() + "]";
        switch (o.kind()) {
            case LOST -> {
                store.deleteFleet(fleet.getId());
                mailer.system(owner.getId(), Message.Type.FLEET, "Raport z ekspedycji",
                        "Ostatni sygnał floty z " + where + " urwał się przy horyzoncie zdarzeń czarnej dziury. Flota zaginęła.", at);
                return;
            }
            case NOTHING -> mailer.system(owner.getId(), Message.Type.FLEET, "Raport z ekspedycji",
                    "Ekspedycja w " + where + " przeszukała pusty obszar - nie znaleziono niczego interesującego.", at);
            case RESOURCES -> {
                long cap = ctx.fleetMath().cargoCapacity(fleet.getShips(), owner.getBranch());
                long free = Math.max(0, cap - (long) fleet.getCargo().total());
                Resources found = o.resources();
                double scale = found.total() > free ? free / found.total() : 1;
                Resources taken = found.times(scale).floor();
                fleet.setCargo(fleet.getCargo().plus(taken));
                mailer.system(owner.getId(), Message.Type.FLEET, "Raport z ekspedycji",
                        "Ekspedycja odnalazła dryfujące złoża i zebrała: " + describe(taken)
                                + (scale < 1 ? " (część pozostała z braku ładowności)" : "") + ".", at);
            }
            case SHIPS -> {
                o.ships().forEach((k, v) -> fleet.getShips().merge(k, v, Long::sum));
                StringBuilder sb = new StringBuilder();
                o.ships().forEach((k, v) -> sb.append(sb.isEmpty() ? "" : ", ").append(k).append(": ").append(v));
                mailer.system(owner.getId(), Message.Type.FLEET, "Raport z ekspedycji",
                        "Ekspedycja natrafiła na porzucone statki, które dołączyły do floty (" + sb + ").", at);
            }
            case PIRATES -> {
                Combatant pirates = new Combatant(PIRATES_ID, o.pirates(), 0, 0, 0, 0);
                CombatResult r = ctx.combat().simulate(List.of(pirates), List.of(combatant(owner, fleet.getShips())), ctx.seed());
                Reports.Side pirateSide = new Reports.Side(PIRATES_ID, "Piraci", fleet.getTarget().toString(), 0, 0, 0);
                Reports.CombatReport report = combatReport(r, List.of(pirateSide),
                        List.of(side(owner, fleet.getTarget().toString())), fleet.getTarget().toString(),
                        "Nieznany obszar", Resources.ZERO, 0, false, at);
                mailer.send(owner.getId(), null, null, Message.Type.COMBAT, "Atak piratów " + where,
                        summary(r, Resources.ZERO), Json.write(report), at);
                Map<String, Long> survivors = r.defenderSurvivors().get(0);
                if (survivors.isEmpty()) {
                    store.deleteFleet(fleet.getId());
                    return;
                }
                fleet.setShips(survivors);
            }
            case DELAY -> mailer.system(owner.getId(), Message.Type.FLEET, "Raport z ekspedycji",
                    "Awaria napędu opóźni powrót ekspedycji z " + where + ".", at);
            case EARLY -> mailer.system(owner.getId(), Message.Type.FLEET, "Raport z ekspedycji",
                    "Dzięki korzystnemu polu grawitacyjnemu ekspedycja wróci szybciej.", at);
        }
        sendBack(fleet, at, o.timeFactor());
    }

    // --- rakiety miedzyplanetarne

    private void missileImpact(Fleet fleet, Instant at) {
        GameStore store = ctx.store();
        store.deleteFleet(fleet.getId());
        Optional<Planet> target = store.planetAt(fleet.getTarget());
        Player attacker = ctx.requirePlayer(fleet.getOwnerId());
        long missiles = fleet.getShips().getOrDefault(MissileStrike.IPM, 0L);
        if (target.isEmpty()) {
            mailer.system(attacker.getId(), Message.Type.FLEET, "Atak rakietowy",
                    "Rakiety nie znalazły celu w [" + fleet.getTarget() + "].", at);
            return;
        }
        Player defender = ctx.requirePlayer(target.get().getOwnerId());
        Planet planet = world.advance(target.get(), defender, at);
        long abm = planet.count(MissileStrike.ABM);
        MissileStrike.Result r = MissileStrike.strike(ctx.data(), missiles, abm, planet.getUnits(),
                fleet.getPrimaryTarget(), attacker.researchLevel("weapons_tech"), defender.researchLevel("armour_tech"));
        if (r.intercepted() > 0) planet.addUnits(MissileStrike.ABM, -r.intercepted());
        r.destroyed().forEach((k, v) -> planet.addUnits(k, -v));
        store.save(planet);
        StringBuilder lost = new StringBuilder();
        r.destroyed().forEach((k, v) -> lost.append(lost.isEmpty() ? "" : ", ").append(k).append(": ").append(v));
        String body = "Rakiety: " + missiles + ", przechwycone: " + r.intercepted() + ", trafienia: " + r.hitting()
                + ". Zniszczona obrona: " + (lost.isEmpty() ? "brak" : lost) + ".";
        mailer.system(attacker.getId(), Message.Type.COMBAT, "Atak rakietowy na [" + planet.coordinates() + "]", body, at);
        mailer.system(defender.getId(), Message.Type.COMBAT, "Atak rakietowy z [" + fleet.getOrigin() + "]",
                "Gracz " + attacker.getUsername() + " zaatakował rakietami " + bodyName(planet) + ". " + body, at);
    }

    // --- pomocnicze

    static String describe(Resources r) {
        return fmt(r.metal()) + " metalu, " + fmt(r.crystal()) + " kryształu, " + fmt(r.tritium()) + " trytu";
    }

    static String fmt(double v) {
        return String.format(java.util.Locale.GERMANY, "%,d", (long) Math.floor(v));
    }
}
