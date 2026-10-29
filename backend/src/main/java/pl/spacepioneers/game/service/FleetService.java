package pl.spacepioneers.game.service;

import pl.spacepioneers.engine.Rules;
import pl.spacepioneers.engine.common.Coordinates;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.data.UnitDef;
import pl.spacepioneers.engine.economy.TechLevels;
import pl.spacepioneers.engine.fleet.FleetMath;
import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.Fleet;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.Treaty;
import pl.spacepioneers.game.store.GameStore;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Wysylanie i zawracanie flot. */
public final class FleetService extends ServiceBase {

    public FleetService(GameContext ctx, World world) {
        super(ctx, world);
    }

    public record SendRequest(long originPlanetId, Map<String, Long> ships, String target, Fleet.Mission mission,
                              int speedPercent, Resources cargo) {
    }

    public record Estimate(long distance, long speed, long durationSeconds, long fuel, long capacity) {
    }

    public record DispatchInfo(Views.PlanetRef planet, Map<String, Long> ships, Map<String, Long> speeds,
                               int slotsUsed, int slotsMax, Resources resources) {
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
            return new DispatchInfo(PlanetService.ref(planet), ships, speeds, ctx.store().fleetsOf(playerId).size(),
                    Rules.fleetSlots(player.researchLevel("computer_tech")), planet.getResources().floor());
        });
    }

    public Estimate estimate(long playerId, long planetId, Map<String, Long> ships, String target, int speedPercent) {
        return tx(now -> {
            Player player = ctx.requirePlayer(playerId);
            Planet planet = ctx.requireOwnPlanet(playerId, planetId);
            Coordinates to = parseTarget(target);
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
            Coordinates target = parseTarget(req.target());
            if (target.equals(origin.coordinates())) {
                throw new GameException("same_planet", "Cel jest taki sam jak planeta startowa.");
            }
            if (req.mission() == null) {
                throw new GameException("invalid_mission", "Wybierz misję.");
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
            int slots = Rules.fleetSlots(player.researchLevel("computer_tech"));
            if (store.fleetsOf(playerId).size() >= slots) {
                throw new GameException("no_fleet_slots", "Brak wolnych slotów flot. Rozwiń technologię komputerową.");
            }

            Optional<Planet> targetPlanet = store.planetAt(target);
            validateMission(player, req.mission(), ships, target, targetPlanet, now);

            Estimate est = estimate(player, origin.coordinates(), target, ships, req.speedPercent());
            Resources cargo = req.cargo() == null ? Resources.ZERO : req.cargo().floor();
            if (cargo.metal() < 0 || cargo.crystal() < 0 || cargo.tritium() < 0) {
                throw new GameException("invalid_cargo", "Ładunek nie może być ujemny.");
            }
            if (req.mission() == Fleet.Mission.ESPIONAGE || req.mission() == Fleet.Mission.RECYCLE) {
                cargo = Resources.ZERO;
            }
            if (cargo.total() > est.capacity()) {
                throw new GameException("cargo_exceeded", "Ładunek przekracza ładowność floty.");
            }
            if (req.mission() == Fleet.Mission.TRANSPORT && cargo.isZero()) {
                throw new GameException("no_cargo", "Transport wymaga ładunku.");
            }
            Resources needed = cargo.plus(Resources.of(0, 0, est.fuel()));
            if (!origin.getResources().covers(needed)) {
                throw new GameException("not_enough_resources", "Za mało surowców na ładunek i paliwo (tryt).");
            }
            origin.setResources(origin.getResources().minus(needed));
            ships.forEach((k, v) -> origin.addUnits(k, -v));
            store.save(origin);

            Fleet fleet = new Fleet();
            fleet.setId(store.nextId("fleet"));
            fleet.setOwnerId(playerId);
            fleet.setOriginPlanetId(origin.getId());
            fleet.setOrigin(origin.coordinates());
            fleet.setTarget(target);
            fleet.setTargetPlanetId(targetPlanet.map(Planet::getId).orElse(null));
            fleet.setTargetOwnerId(targetPlanet.map(Planet::getOwnerId).orElse(null));
            fleet.setMission(req.mission());
            fleet.setShips(ships);
            fleet.setCargo(cargo);
            fleet.setSpeedPercent(req.speedPercent());
            fleet.setFuel(est.fuel());
            fleet.setDepartAt(now);
            fleet.setArriveAt(now.plusSeconds(est.durationSeconds()));
            fleet.setReturnAt(fleet.getArriveAt().plusSeconds(est.durationSeconds()));
            store.save(fleet);
            return PlanetService.movement(fleet, true, player.getUsername());
        });
    }

    private void validateMission(Player player, Fleet.Mission mission, Map<String, Long> ships, Coordinates target,
                                 Optional<Planet> targetPlanet, Instant now) {
        GameStore store = ctx.store();
        switch (mission) {
            case TRANSPORT -> {
                if (targetPlanet.isEmpty()) throw new GameException("no_planet", "Na tej pozycji nie ma planety.");
            }
            case DEPLOY -> {
                if (targetPlanet.isEmpty() || targetPlanet.get().getOwnerId() != player.getId()) {
                    throw new GameException("not_own_planet", "Stacjonować można tylko na własnej planecie.");
                }
            }
            case ATTACK, ESPIONAGE -> {
                if (targetPlanet.isEmpty()) throw new GameException("no_planet", "Na tej pozycji nie ma planety.");
                Planet tp = targetPlanet.get();
                if (tp.getOwnerId() == player.getId()) {
                    throw new GameException("own_planet", "Nie możesz atakować własnej planety.");
                }
                Player defender = ctx.requirePlayer(tp.getOwnerId());
                if (defender.inVacation()) {
                    throw new GameException("target_vacation", "Gracz jest w trybie urlopowym.");
                }
                if (player.inVacation()) {
                    throw new GameException("vacation_mode", "W trybie urlopowym nie można atakować.");
                }
                boolean inactive = defender.inactivity(now) != null;
                if (!Rules.attackAllowed(player.getScore().total(), defender.getScore().total(), inactive, ctx.config())) {
                    throw new GameException("newbie_protection", "Cel jest objęty ochroną początkujących (lub ty jesteś).");
                }
                if (mission == Fleet.Mission.ATTACK && protectedByDiplomacy(player, defender)) {
                    throw new GameException("diplomacy", "Nie możesz atakować członków własnego lub sprzymierzonego sojuszu.");
                }
                if (mission == Fleet.Mission.ESPIONAGE
                        && (ships.size() != 1 || !ships.containsKey("espionage_probe"))) {
                    throw new GameException("probes_only", "Na misję szpiegowską można wysłać tylko sondy.");
                }
            }
            case COLONIZE -> {
                if (!ships.containsKey("colony_ship")) {
                    throw new GameException("no_colony_ship", "Misja wymaga statku kolonizacyjnego.");
                }
                if (targetPlanet.isPresent()) throw new GameException("position_taken", "Ta pozycja jest zajęta.");
                int max = Rules.maxPlanets(player.researchLevel("astrophysics"));
                long colonizing = store.fleetsOf(player.getId()).stream()
                        .filter(f -> f.getMission() == Fleet.Mission.COLONIZE && f.getStatus() == Fleet.Status.OUTBOUND)
                        .count();
                if (store.planetsOf(player.getId()).size() + colonizing >= max) {
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
        }
    }

    /** Ataki na czlonkow wlasnego sojuszu i sojuszy zwiazanych aktywnym paktem sa zablokowane. */
    private boolean protectedByDiplomacy(Player attacker, Player defender) {
        Long a = attacker.getAllianceId();
        Long d = defender.getAllianceId();
        if (a == null || d == null) return false;
        if (a.equals(d)) return true;
        for (Treaty t : ctx.store().treaties(a)) {
            if (t.status() == Treaty.Status.ACTIVE && t.type() != Treaty.Type.WAR && t.other(a) == d) {
                return true;
            }
        }
        return false;
    }

    public Views.FleetMovement recall(long playerId, long fleetId) {
        return tx(now -> {
            Fleet fleet = ctx.store().fleet(fleetId).filter(f -> f.getOwnerId() == playerId)
                    .orElseThrow(() -> GameException.notFound("flota " + fleetId));
            if (fleet.getStatus() != Fleet.Status.OUTBOUND) {
                throw new GameException("already_returning", "Flota już wraca.");
            }
            Duration flown = Duration.between(fleet.getDepartAt(), now);
            fleet.setStatus(Fleet.Status.RETURNING);
            fleet.setReturnAt(now.plus(flown).plusSeconds(flown.isZero() ? 1 : 0));
            ctx.store().save(fleet);
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

    private Coordinates parseTarget(String target) {
        Coordinates c;
        try {
            c = Coordinates.parse(target == null ? "" : target);
        } catch (IllegalArgumentException e) {
            throw new GameException("invalid_coordinates", "Nieprawidłowe współrzędne.");
        }
        if (!c.isValid(ctx.config())) {
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
