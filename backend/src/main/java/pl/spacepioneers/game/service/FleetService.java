package pl.spacepioneers.game.service;

import pl.spacepioneers.engine.Rules;
import pl.spacepioneers.engine.common.Coordinates;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.data.UnitDef;
import pl.spacepioneers.engine.economy.TechLevels;
import pl.spacepioneers.engine.fleet.FleetMath;
import pl.spacepioneers.engine.special.Expedition;
import pl.spacepioneers.engine.special.MissileStrike;
import pl.spacepioneers.engine.special.Moons;
import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.AttackUnion;
import pl.spacepioneers.game.model.Fleet;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.store.GameStore;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** Floty: wysylanie (wszystkie misje), zawracanie, ataki sojusznicze, rakiety, falanga, teleporter. */
public final class FleetService extends ServiceBase {

    public static final int MAX_HOLD_HOURS = 32;
    public static final int MAX_EXPEDITION_HOURS = 8;

    public FleetService(GameContext ctx, World world) {
        super(ctx, world);
    }

    public record SendRequest(long originPlanetId, Map<String, Long> ships, String target, Fleet.Mission mission,
                              int speedPercent, Resources cargo, boolean targetMoon, Long unionId, Integer holdHours) {
        public SendRequest(long originPlanetId, Map<String, Long> ships, String target, Fleet.Mission mission,
                           int speedPercent, Resources cargo) {
            this(originPlanetId, ships, target, mission, speedPercent, cargo, false, null, null);
        }
    }

    public record Estimate(long distance, long speed, long durationSeconds, long fuel, long capacity) {
    }

    public record DispatchInfo(Views.PlanetRef planet, Map<String, Long> ships, Map<String, Long> speeds,
                               int slotsUsed, int slotsMax, Resources resources, int expeditionsUsed,
                               int expeditionsMax, long missiles, int missileRange) {
    }

    public record UnionView(long id, String name, String target, boolean targetMoon, Instant arriveAt, String ownerName,
                            boolean own, int fleets, List<String> invited) {
    }

    public DispatchInfo dispatchInfo(long playerId, long planetId) {
        return tx(now -> {
            Player player = ctx.requirePlayer(playerId);
            Planet planet = ownPlanet(playerId, planetId, now);
            ctx.store().save(planet);
            TechLevels tech = new TechLevels(player.getResearch());
            Map<String, Long> ships = new LinkedHashMap<>();
            Map<String, Long> speeds = new LinkedHashMap<>();
            for (UnitDef def : ctx.data().ships()) {
                long n = planet.count(def.key());
                if (n > 0 && def.canFly()) {
                    ships.put(def.key(), n);
                    speeds.put(def.key(), ctx.fleetMath().unitSpeed(def, tech, player.getBranch()));
                }
            }
            List<Fleet> own = ctx.store().fleetsOf(playerId);
            return new DispatchInfo(PlanetService.ref(planet), ships, speeds, (int) own.stream().filter(Fleet::usesSlot).count(),
                    Rules.fleetSlots(player.researchLevel("computer_tech")), planet.getResources().floor(),
                    (int) own.stream().filter(f -> f.getMission() == Fleet.Mission.EXPEDITION).count(),
                    Expedition.maxConcurrent(player.researchLevel("astrophysics")),
                    planet.count(MissileStrike.IPM), MissileStrike.rangeSystems(player.researchLevel("impulse_drive")));
        });
    }

    public Estimate estimate(long playerId, long planetId, Map<String, Long> ships, String target, int speedPercent) {
        return tx(now -> {
            Player player = ctx.requirePlayer(playerId);
            Planet planet = ctx.requireOwnPlanet(playerId, planetId);
            Coordinates to = parseTarget(target, true);
            Map<String, Long> clean = cleanShips(ships);
            return estimate(player, planet.coordinates(), to, clean, speedPercent);
        });
    }

    private Estimate estimate(Player player, Coordinates from, Coordinates to, Map<String, Long> ships, int speedPercent) {
        FleetMath math = ctx.fleetMath();
        long distance = FleetMath.distance(from, to);
        long speed;
        long duration;
        long fuel;
        try {
            speed = math.fleetSpeed(ships, new TechLevels(player.getResearch()), player.getBranch());
            duration = math.flightSeconds(distance, speed, speedPercent);
            fuel = math.fuel(ships, distance, speedPercent);
        } catch (IllegalArgumentException e) {
            throw new GameException("invalid_fleet", e.getMessage());
        }
        return new Estimate(distance, speed, duration, fuel, math.cargoCapacity(ships, player.getBranch()));
    }

    public Views.FleetMovement send(long playerId, SendRequest req) {
        return tx(now -> {
            GameStore store = ctx.store();
            Player player = ctx.requirePlayer(playerId);
            requireActive(player);
            Planet origin = ownPlanet(playerId, req.originPlanetId(), now);
            if (req.mission() == null) {
                throw new GameException("invalid_mission", "Wybierz misję.");
            }
            if (req.mission() == Fleet.Mission.MISSILE) {
                throw new GameException("invalid_mission", "Rakiety wystrzeliwuje się z silosu rakietowego.");
            }
            Coordinates target = parseTarget(req.target(), req.mission() == Fleet.Mission.EXPEDITION);
            boolean targetMoon = req.targetMoon() && req.mission() != Fleet.Mission.COLONIZE
                    && req.mission() != Fleet.Mission.RECYCLE && req.mission() != Fleet.Mission.EXPEDITION;
            if (target.equals(origin.coordinates()) && targetMoon == origin.isMoon()) {
                throw new GameException("same_planet", "Cel jest taki sam jak miejsce startu.");
            }
            Map<String, Long> ships = cleanShips(req.ships());
            for (var e : ships.entrySet()) {
                UnitDef def = ctx.data().findUnit(e.getKey())
                        .orElseThrow(() -> new GameException("invalid_ship", "Nieznany statek: " + e.getKey()));
                if (!def.canFly()) {
                    throw new GameException("invalid_ship", "Ta jednostka nie może latać: " + e.getKey());
                }
                if (origin.count(e.getKey()) < e.getValue()) {
                    throw new GameException("not_enough_ships", "Na planecie nie ma tylu statków.");
                }
            }
            List<Fleet> own = store.fleetsOf(playerId);
            int slots = Rules.fleetSlots(player.researchLevel("computer_tech"));
            if (own.stream().filter(Fleet::usesSlot).count() >= slots) {
                throw new GameException("no_fleet_slots", "Brak wolnych slotów flot. Rozwiń technologię komputerową.");
            }

            Optional<Planet> targetBody = store.bodyAt(target, targetMoon);
            validateMission(player, req, ships, target, targetMoon, targetBody, own, now);

            Estimate est = estimate(player, origin.coordinates(), target, ships, req.speedPercent());
            Resources cargo = req.cargo() == null ? Resources.ZERO : req.cargo().floor();
            if (cargo.metal() < 0 || cargo.crystal() < 0 || cargo.tritium() < 0) {
                throw new GameException("invalid_cargo", "Ładunek nie może być ujemny.");
            }
            if (req.mission() == Fleet.Mission.ESPIONAGE || req.mission() == Fleet.Mission.RECYCLE
                    || req.mission() == Fleet.Mission.EXPEDITION) {
                cargo = Resources.ZERO;
            }
            if (cargo.total() > est.capacity()) {
                throw new GameException("cargo_exceeded", "Ładunek przekracza ładowność floty.");
            }
            if (req.mission() == Fleet.Mission.TRANSPORT && cargo.isZero()) {
                throw new GameException("no_cargo", "Transport wymaga ładunku.");
            }
            long holdSeconds = 0;
            if (req.mission() == Fleet.Mission.HOLD || req.mission() == Fleet.Mission.EXPEDITION) {
                int max = req.mission() == Fleet.Mission.HOLD ? MAX_HOLD_HOURS : MAX_EXPEDITION_HOURS;
                int hours = req.holdHours() == null ? 1 : req.holdHours();
                if (hours < 1 || hours > max) {
                    throw new GameException("invalid_hold", "Czas pobytu: od 1 do " + max + " godzin.");
                }
                holdSeconds = Math.max(1, Math.round(hours * 3600 / ctx.config().fleetSpeed()));
            }
            Resources needed = cargo.plus(Resources.of(0, 0, est.fuel()));
            if (!origin.getResources().covers(needed)) {
                throw new GameException("not_enough_resources", "Za mało surowców na ładunek i paliwo (tryt).");
            }

            Fleet fleet = new Fleet();
            fleet.setId(store.nextId("fleet"));
            fleet.setOwnerId(playerId);
            fleet.setOriginPlanetId(origin.getId());
            fleet.setOrigin(origin.coordinates());
            fleet.setTarget(target);
            fleet.setTargetMoon(targetMoon);
            fleet.setTargetPlanetId(targetBody.map(Planet::getId).orElse(null));
            fleet.setTargetOwnerId(targetBody.map(Planet::getOwnerId).orElse(null));
            fleet.setMission(req.mission());
            fleet.setShips(ships);
            fleet.setCargo(cargo);
            fleet.setSpeedPercent(req.speedPercent());
            fleet.setFuel(est.fuel());
            fleet.setDepartAt(now);
            fleet.setFlightSeconds(est.durationSeconds());
            fleet.setHoldSeconds(holdSeconds);
            fleet.setArriveAt(now.plusSeconds(est.durationSeconds()));

            if (req.mission() == Fleet.Mission.ATTACK && req.unionId() != null) {
                joinUnion(player, fleet, req.unionId(), now);
            }
            fleet.setReturnAt(fleet.getArriveAt().plusSeconds(holdSeconds + est.durationSeconds()));

            origin.setResources(origin.getResources().minus(needed));
            ships.forEach((k, v) -> origin.addUnits(k, -v));
            store.save(origin);
            store.save(fleet);
            return PlanetService.movement(fleet, true, player.getUsername());
        });
    }

    private void validateMission(Player player, SendRequest req, Map<String, Long> ships, Coordinates target,
                                 boolean targetMoon, Optional<Planet> targetBody, List<Fleet> own, Instant now) {
        GameStore store = ctx.store();
        String noTarget = targetMoon ? "Na tej pozycji nie ma księżyca." : "Na tej pozycji nie ma planety.";
        switch (req.mission()) {
            case TRANSPORT -> {
                if (targetBody.isEmpty()) throw new GameException("no_planet", noTarget);
            }
            case DEPLOY -> {
                if (targetBody.isEmpty() || targetBody.get().getOwnerId() != player.getId()) {
                    throw new GameException("not_own_planet", "Stacjonować można tylko na własnej planecie lub księżycu.");
                }
            }
            case HOLD -> {
                if (targetBody.isEmpty()) throw new GameException("no_planet", noTarget);
                Player host = ctx.requirePlayer(targetBody.get().getOwnerId());
                if (host.getId() == player.getId()) {
                    throw new GameException("own_planet", "Do własnej planety wyślij flotę na stacjonowanie.");
                }
                if (!Diplomacy.allied(ctx, player, host)) {
                    throw new GameException("not_allied", "Obrona sojusznicza jest możliwa tylko u członków sojuszu i znajomych.");
                }
            }
            case ATTACK, ESPIONAGE -> {
                if (targetBody.isEmpty()) throw new GameException("no_planet", noTarget);
                Planet tp = targetBody.get();
                if (tp.getOwnerId() == player.getId()) {
                    throw new GameException("own_planet", "Nie możesz atakować własnej planety.");
                }
                Player defender = ctx.requirePlayer(tp.getOwnerId());
                if (defender.inVacation()) {
                    throw new GameException("target_vacation", "Gracz jest w trybie urlopowym.");
                }
                boolean inactive = defender.inactivity(now) != null;
                if (!Rules.attackAllowed(player.getScore().total(), defender.getScore().total(), inactive, ctx.config())) {
                    throw new GameException("newbie_protection", "Cel jest objęty ochroną początkujących (lub ty jesteś).");
                }
                if (req.mission() == Fleet.Mission.ATTACK && Diplomacy.protectedFromAttack(ctx, player, defender)) {
                    throw new GameException("diplomacy", "Nie możesz atakować członków własnego lub sprzymierzonego sojuszu.");
                }
                if (req.mission() == Fleet.Mission.ESPIONAGE
                        && (ships.size() != 1 || !ships.containsKey("espionage_probe"))) {
                    throw new GameException("probes_only", "Na misję szpiegowską można wysłać tylko sondy.");
                }
            }
            case COLONIZE -> {
                if (!ships.containsKey("colony_ship")) {
                    throw new GameException("no_colony_ship", "Misja wymaga statku kolonizacyjnego.");
                }
                if (targetBody.isPresent()) throw new GameException("position_taken", "Ta pozycja jest zajęta.");
                int max = Rules.maxPlanets(player.researchLevel("astrophysics"));
                long colonizing = own.stream()
                        .filter(f -> f.getMission() == Fleet.Mission.COLONIZE && f.getStatus() == Fleet.Status.OUTBOUND)
                        .count();
                long planets = store.planetsOf(player.getId()).stream().filter(p -> !p.isMoon()).count();
                if (planets + colonizing >= max) {
                    throw new GameException("planet_limit", "Osiągnięto limit planet. Rozwiń astrofizykę.");
                }
            }
            case RECYCLE -> {
                if (!ships.containsKey("recycler")) {
                    throw new GameException("no_recycler", "Misja wymaga recyklerów.");
                }
                if (store.debris(target).isEmpty()) {
                    throw new GameException("no_debris", "Na tej pozycji nie ma pola zniszczeń.");
                }
            }
            case EXPEDITION -> {
                if (target.position() != ctx.config().positions() + 1) {
                    throw new GameException("invalid_expedition", "Ekspedycje wysyła się na pozycję " + (ctx.config().positions() + 1) + ".");
                }
                int max = Expedition.maxConcurrent(player.researchLevel("astrophysics"));
                long running = own.stream().filter(f -> f.getMission() == Fleet.Mission.EXPEDITION).count();
                if (running >= max) {
                    throw new GameException("expedition_limit", max == 0 ? "Ekspedycje wymagają astrofizyki."
                            : "Osiągnięto limit jednoczesnych ekspedycji (" + max + ").");
                }
            }
            case MISSILE -> throw new GameException("invalid_mission", "Nieobsługiwana misja.");
        }
        if (req.mission() != Fleet.Mission.EXPEDITION && target.position() > ctx.config().positions()) {
            throw new GameException("invalid_coordinates", "Współrzędne poza zakresem galaktyki.");
        }
    }

    // --- ataki sojusznicze

    private void joinUnion(Player player, Fleet fleet, long unionId, Instant now) {
        GameStore store = ctx.store();
        AttackUnion union = store.union(unionId).orElseThrow(() -> GameException.notFound("atak sojuszniczy " + unionId));
        if (!union.mayJoin(player.getId())) {
            throw GameException.forbidden("Nie zostałeś zaproszony do tego ataku.");
        }
        if (!union.target().equals(fleet.getTarget()) || union.targetMoon() != fleet.isTargetMoon()) {
            throw new GameException("union_target", "Cel floty musi być taki sam jak cel ataku sojuszniczego.");
        }
        if (!union.arriveAt().isAfter(now)) {
            throw new GameException("union_started", "Atak sojuszniczy już się rozpoczął.");
        }
        List<Fleet> members = store.fleetsInUnion(unionId);
        if (members.size() >= AttackUnion.MAX_FLEETS) {
            throw new GameException("union_full", "Do ataku dołączyła już maksymalna liczba flot.");
        }
        Instant own = fleet.getArriveAt();
        if (own.isAfter(union.arriveAt())) {
            long remaining = Duration.between(now, union.arriveAt()).getSeconds();
            long ownSeconds = Duration.between(now, own).getSeconds();
            if (ownSeconds > remaining * (1 + AttackUnion.MAX_DELAY_RATIO)) {
                throw new GameException("union_too_slow", "Flota jest za wolna - opóźniłaby atak o więcej niż 30%.");
            }
            store.save(union.withArriveAt(own));
            for (Fleet m : members) {
                m.setArriveAt(own);
                m.setReturnAt(own.plusSeconds(m.getFlightSeconds()));
                store.save(m);
            }
        } else {
            fleet.setArriveAt(union.arriveAt());
        }
        fleet.setUnionId(unionId);
    }

    public UnionView createUnion(long playerId, long fleetId, String name) {
        return tx(now -> {
            GameStore store = ctx.store();
            Fleet fleet = store.fleet(fleetId).filter(f -> f.getOwnerId() == playerId)
                    .orElseThrow(() -> GameException.notFound("flota " + fleetId));
            if (fleet.getMission() != Fleet.Mission.ATTACK || fleet.getStatus() != Fleet.Status.OUTBOUND) {
                throw new GameException("not_attack", "Atak sojuszniczy można utworzyć tylko z lecącej floty atakującej.");
            }
            if (fleet.getUnionId() != null) {
                throw new GameException("already_union", "Flota należy już do ataku sojuszniczego.");
            }
            String n = name == null || name.isBlank() ? "Atak " + fleet.getTarget() : MessageService.clean(name, 40);
            AttackUnion union = new AttackUnion(store.nextId("union"), playerId, n, fleet.getTarget(), fleet.isTargetMoon(),
                    fleet.getArriveAt(), Set.of(), now);
            store.save(union);
            fleet.setUnionId(union.id());
            store.save(fleet);
            return unionView(union, playerId);
        });
    }

    public UnionView invite(long playerId, long unionId, String username) {
        return tx(now -> {
            GameStore store = ctx.store();
            AttackUnion union = store.union(unionId).filter(u -> u.ownerId() == playerId)
                    .orElseThrow(() -> GameException.notFound("atak sojuszniczy " + unionId));
            Player owner = ctx.requirePlayer(playerId);
            Player guest = store.playerByName(username == null ? "" : username.trim())
                    .orElseThrow(() -> new GameException(GameException.Kind.NOT_FOUND, "no_player", "Nie ma takiego gracza."));
            if (guest.getId() == playerId) throw new GameException("self_invite", "Nie możesz zaprosić samego siebie.");
            if (!Diplomacy.allied(ctx, owner, guest)) {
                throw new GameException("not_allied", "Zaprosić można tylko członków sojuszu i znajomych.");
            }
            Set<Long> invited = new HashSet<>(union.invited());
            invited.add(guest.getId());
            AttackUnion updated = union.withInvited(invited);
            store.save(updated);
            new Mailer(ctx).system(guest.getId(), pl.spacepioneers.game.model.Message.Type.FLEET, "Zaproszenie do ataku sojuszniczego",
                    owner.getUsername() + " zaprasza cię do ataku „" + union.name() + "” na [" + union.target() + "]. "
                            + "Wyślij flotę atakującą na ten cel i wybierz ten atak w widoku floty.", now);
            return unionView(updated, playerId);
        });
    }

    public List<UnionView> unions(long playerId) {
        return tx(now -> ctx.store().unions().stream()
                .filter(u -> u.mayJoin(playerId) && u.arriveAt().isAfter(now))
                .map(u -> unionView(u, playerId)).toList());
    }

    private UnionView unionView(AttackUnion u, long viewerId) {
        GameStore store = ctx.store();
        List<String> invited = new ArrayList<>();
        for (long id : u.invited()) store.player(id).ifPresent(p -> invited.add(p.getUsername()));
        String owner = store.player(u.ownerId()).map(Player::getUsername).orElse("?");
        return new UnionView(u.id(), u.name(), u.target().toString(), u.targetMoon(), u.arriveAt(), owner,
                u.ownerId() == viewerId, store.fleetsInUnion(u.id()).size(), invited);
    }

    // --- zawracanie

    public Views.FleetMovement recall(long playerId, long fleetId) {
        return tx(now -> {
            Fleet fleet = ctx.store().fleet(fleetId).filter(f -> f.getOwnerId() == playerId)
                    .orElseThrow(() -> GameException.notFound("flota " + fleetId));
            if (fleet.getMission() == Fleet.Mission.MISSILE) {
                throw new GameException("cannot_recall", "Rakiet nie można zawrócić.");
            }
            switch (fleet.getStatus()) {
                case RETURNING -> throw new GameException("already_returning", "Flota już wraca.");
                case OUTBOUND -> {
                    Duration flown = Duration.between(fleet.getDepartAt(), now);
                    fleet.setReturnAt(now.plus(flown).plusSeconds(flown.isZero() ? 1 : 0));
                }
                case HOLDING -> fleet.setReturnAt(now.plus(fleet.flightDuration()));
            }
            Long unionId = fleet.getUnionId();
            fleet.setStatus(Fleet.Status.RETURNING);
            fleet.setUnionId(null);
            ctx.store().save(fleet);
            if (unionId != null && ctx.store().fleetsInUnion(unionId).isEmpty()) {
                ctx.store().deleteUnion(unionId);
            }
            Player player = ctx.requirePlayer(playerId);
            return PlanetService.movement(fleet, true, player.getUsername());
        });
    }

    public List<Views.FleetMovement> movements(long playerId) {
        return tx(now -> {
            Player player = ctx.requirePlayer(playerId);
            List<Views.FleetMovement> out = new ArrayList<>();
            for (Fleet f : ctx.store().fleetsOf(playerId)) {
                out.add(PlanetService.movement(f, true, player.getUsername()));
            }
            return out;
        });
    }

    // --- rakiety miedzyplanetarne

    public Views.FleetMovement launchMissiles(long playerId, long planetId, String target, long count, String primaryTarget) {
        return tx(now -> {
            GameStore store = ctx.store();
            Player player = ctx.requirePlayer(playerId);
            requireActive(player);
            Planet origin = ownPlanet(playerId, planetId, now);
            Coordinates to = parseTarget(target, false);
            if (count < 1) throw new GameException("invalid_count", "Podaj liczbę rakiet.");
            if (origin.count(MissileStrike.IPM) < count) {
                throw new GameException("not_enough_missiles", "Na planecie nie ma tylu rakiet międzyplanetarnych.");
            }
            int range = MissileStrike.rangeSystems(player.researchLevel("impulse_drive"));
            int systems = Math.abs(to.system() - origin.getSystem());
            if (to.galaxy() != origin.getGalaxy() || systems > range) {
                throw new GameException("out_of_range", "Cel poza zasięgiem rakiet (" + range + " systemów).");
            }
            Planet targetPlanet = store.planetAt(to).orElseThrow(() -> new GameException("no_planet", "Na tej pozycji nie ma planety."));
            if (targetPlanet.getOwnerId() == playerId) throw new GameException("own_planet", "Nie możesz atakować własnej planety.");
            Player defender = ctx.requirePlayer(targetPlanet.getOwnerId());
            if (defender.inVacation()) throw new GameException("target_vacation", "Gracz jest w trybie urlopowym.");
            boolean inactive = defender.inactivity(now) != null;
            if (!Rules.attackAllowed(player.getScore().total(), defender.getScore().total(), inactive, ctx.config())) {
                throw new GameException("newbie_protection", "Cel jest objęty ochroną początkujących (lub ty jesteś).");
            }
            if (Diplomacy.protectedFromAttack(ctx, player, defender)) {
                throw new GameException("diplomacy", "Nie możesz atakować członków własnego lub sprzymierzonego sojuszu.");
            }
            if (primaryTarget != null && !primaryTarget.isBlank()
                    && ctx.data().findUnit(primaryTarget).filter(UnitDef::isDefense).isEmpty()) {
                throw new GameException("invalid_target", "Celem głównym może być tylko budowla obronna.");
            }
            long seconds = MissileStrike.flightSeconds(systems, ctx.config().fleetSpeed());
            origin.addUnits(MissileStrike.IPM, -count);
            store.save(origin);
            Fleet f = new Fleet();
            f.setId(store.nextId("fleet"));
            f.setOwnerId(playerId);
            f.setOriginPlanetId(origin.getId());
            f.setOrigin(origin.coordinates());
            f.setTarget(to);
            f.setTargetPlanetId(targetPlanet.getId());
            f.setTargetOwnerId(targetPlanet.getOwnerId());
            f.setMission(Fleet.Mission.MISSILE);
            f.setShips(Map.of(MissileStrike.IPM, count));
            f.setSpeedPercent(100);
            f.setDepartAt(now);
            f.setFlightSeconds(seconds);
            f.setArriveAt(now.plusSeconds(seconds));
            f.setReturnAt(f.getArriveAt());
            f.setPrimaryTarget(primaryTarget == null || primaryTarget.isBlank() ? null : primaryTarget);
            store.save(f);
            return PlanetService.movement(f, true, player.getUsername());
        });
    }

    // --- falanga czujnikowa i teleporter

    public List<Views.FleetMovement> phalanx(long playerId, long moonId, String target) {
        return tx(now -> {
            GameStore store = ctx.store();
            Planet moon = ownPlanet(playerId, moonId, now);
            if (!moon.isMoon() || moon.level("sensor_phalanx") < 1) {
                throw new GameException("no_phalanx", "Ten księżyc nie ma falangi czujnikowej.");
            }
            Coordinates to = parseTarget(target, false);
            int range = Moons.phalanxRange(moon.level("sensor_phalanx"));
            if (to.galaxy() != moon.getGalaxy() || Math.abs(to.system() - moon.getSystem()) > range) {
                throw new GameException("out_of_range", "Cel poza zasięgiem falangi (" + range + " systemów).");
            }
            Planet scanned = store.planetAt(to).orElseThrow(() -> new GameException("no_planet", "Na tej pozycji nie ma planety."));
            if (scanned.getOwnerId() == playerId) throw new GameException("own_planet", "Falanga nie skanuje własnych planet.");
            pay(moon, Resources.of(0, 0, Moons.PHALANX_SCAN_COST));
            store.save(moon);
            List<Views.FleetMovement> out = new ArrayList<>();
            for (Fleet f : store.fleetsAround(to)) {
                if (f.getMission() == Fleet.Mission.MISSILE) continue;
                String ownerName = store.player(f.getOwnerId()).map(Player::getUsername).orElse("?");
                out.add(PlanetService.movement(f, true, ownerName));
            }
            return out;
        });
    }

    public void jump(long playerId, long fromMoonId, long toMoonId, Map<String, Long> ships) {
        txRun(now -> {
            GameStore store = ctx.store();
            Planet from = ownPlanet(playerId, fromMoonId, now);
            Planet to = ownPlanet(playerId, toMoonId, now);
            if (!from.isMoon() || !to.isMoon() || from.level("jump_gate") < 1 || to.level("jump_gate") < 1) {
                throw new GameException("no_jump_gate", "Oba księżyce muszą mieć teleporter.");
            }
            if (from.getId() == to.getId()) throw new GameException("same_planet", "Wybierz inny księżyc docelowy.");
            for (Planet p : List.of(from, to)) {
                if (p.getJumpGateReadyAt() != null && p.getJumpGateReadyAt().isAfter(now)) {
                    throw new GameException("jump_cooldown", "Teleporter się ładuje - spróbuj później.");
                }
            }
            Map<String, Long> clean = cleanShips(ships);
            for (var e : clean.entrySet()) {
                UnitDef def = ctx.data().findUnit(e.getKey()).orElseThrow(() -> new GameException("invalid_ship", "Nieznany statek."));
                if (!def.canFly()) throw new GameException("invalid_ship", "Ta jednostka nie może przeskoczyć.");
                if (from.count(e.getKey()) < e.getValue()) {
                    throw new GameException("not_enough_ships", "Na księżycu nie ma tylu statków.");
                }
            }
            clean.forEach((k, v) -> {
                from.addUnits(k, -v);
                to.addUnits(k, v);
            });
            Instant ready = now.plusSeconds(Math.max(60, Math.round(Moons.JUMP_GATE_COOLDOWN_SECONDS / ctx.config().fleetSpeed())));
            from.setJumpGateReadyAt(ready);
            to.setJumpGateReadyAt(ready);
            store.save(from);
            store.save(to);
        });
    }

    // --- pomocnicze

    private Coordinates parseTarget(String target, boolean allowDeepSpace) {
        Coordinates c;
        try {
            c = Coordinates.parse(target == null ? "" : target);
        } catch (IllegalArgumentException e) {
            throw new GameException("invalid_coordinates", "Nieprawidłowe współrzędne.");
        }
        boolean deepSpace = allowDeepSpace && c.position() == ctx.config().positions() + 1
                && new Coordinates(c.galaxy(), c.system(), 1).isValid(ctx.config());
        if (!c.isValid(ctx.config()) && !deepSpace) {
            throw new GameException("invalid_coordinates", "Współrzędne poza zakresem galaktyki.");
        }
        return c;
    }

    private static Map<String, Long> cleanShips(Map<String, Long> ships) {
        Map<String, Long> out = new LinkedHashMap<>();
        if (ships != null) {
            ships.forEach((k, v) -> {
                if (v != null && v > 0) out.put(k, v);
                if (v != null && v < 0) throw new GameException("invalid_count", "Ujemna liczba statków.");
            });
        }
        if (out.isEmpty()) {
            throw new GameException("no_ships", "Wybierz statki.");
        }
        return out;
    }
}
