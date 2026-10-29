package pl.spacepioneers.engine.fleet;

import pl.spacepioneers.engine.common.Branch;
import pl.spacepioneers.engine.common.Coordinates;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.common.UniverseConfig;
import pl.spacepioneers.engine.data.GameData;
import pl.spacepioneers.engine.data.UnitDef;
import pl.spacepioneers.engine.economy.TechLevels;

import java.util.Map;

/** Odleglosci, predkosci, czasy lotu, zuzycie paliwa, ladownosc i rabunek. */
public final class FleetMath {

    public static final double WARRIOR_SPEED_BONUS = 0.10;
    public static final double TRADER_CARGO_BONUS = 0.20;

    private final GameData data;
    private final UniverseConfig config;

    public FleetMath(GameData data, UniverseConfig config) {
        this.data = data;
        this.config = config;
    }

    public static long distance(Coordinates a, Coordinates b) {
        if (a.galaxy() != b.galaxy()) {
            return 20_000L * Math.abs(a.galaxy() - b.galaxy());
        }
        if (a.system() != b.system()) {
            return 2_700L + 95L * Math.abs(a.system() - b.system());
        }
        if (a.position() != b.position()) {
            return 1_000L + 5L * Math.abs(a.position() - b.position());
        }
        return 5;
    }

    public static double driveBonusPerLevel(String drive) {
        if (drive == null) {
            return 0;
        }
        return switch (drive) {
            case "combustion_drive" -> 0.10;
            case "impulse_drive" -> 0.20;
            case "hyperspace_drive" -> 0.30;
            default -> 0;
        };
    }

    public long unitSpeed(UnitDef unit, TechLevels tech, Branch branch) {
        if (!unit.canFly()) {
            return 0;
        }
        double factor = 1 + driveBonusPerLevel(unit.drive()) * tech.level(unit.drive());
        if (branch == Branch.WARRIOR) {
            factor += WARRIOR_SPEED_BONUS;
        }
        return Math.round(unit.speed() * factor);
    }

    /** Predkosc floty = predkosc najwolniejszego statku. */
    public long fleetSpeed(Map<String, Long> ships, TechLevels tech, Branch branch) {
        long min = Long.MAX_VALUE;
        for (var e : ships.entrySet()) {
            if (e.getValue() <= 0) continue;
            UnitDef def = data.unit(e.getKey());
            if (!def.canFly()) {
                throw new IllegalArgumentException("Jednostka nie moze latac: " + def.key());
            }
            min = Math.min(min, unitSpeed(def, tech, branch));
        }
        if (min == Long.MAX_VALUE) {
            throw new IllegalArgumentException("Flota nie zawiera statkow");
        }
        return min;
    }

    /**
     * Czas lotu w jedna strone w sekundach.
     *
     * @param speedPercent ustawienie predkosci 10..100
     */
    public long flightSeconds(long distance, long fleetSpeed, int speedPercent) {
        validatePercent(speedPercent);
        double seconds = (35_000.0 / speedPercent * Math.sqrt(distance * 10.0 / fleetSpeed) + 10) / config.fleetSpeed();
        return Math.max(1, Math.round(seconds));
    }

    /** Zuzycie trytu w jedna strone. */
    public long fuel(Map<String, Long> ships, long distance, int speedPercent) {
        validatePercent(speedPercent);
        double total = 0;
        double speedFactor = Math.pow(speedPercent / 100.0 + 1, 2);
        for (var e : ships.entrySet()) {
            if (e.getValue() <= 0) continue;
            UnitDef def = data.unit(e.getKey());
            total += e.getValue() * def.fuel() * distance / 35_000.0 * speedFactor;
        }
        return 1 + Math.round(total);
    }

    public long cargoCapacity(Map<String, Long> ships, Branch branch) {
        double total = 0;
        for (var e : ships.entrySet()) {
            if (e.getValue() <= 0) continue;
            total += (double) e.getValue() * data.unit(e.getKey()).cargo();
        }
        if (branch == Branch.TRADER) {
            total *= 1 + TRADER_CARGO_BONUS;
        }
        return (long) Math.floor(total);
    }

    private static void validatePercent(int speedPercent) {
        if (speedPercent < 10 || speedPercent > 100 || speedPercent % 10 != 0) {
            throw new IllegalArgumentException("Predkosc musi byc wielokrotnoscia 10 w zakresie 10..100");
        }
    }

    /**
     * Rabunek: z planety mozna zabrac co najwyzej {@code lootRatio} kazdego zasobu,
     * w granicach ladownosci. Rozdzial: najpierw po rowno, potem dopelnienie.
     */
    public static Resources plunder(Resources available, long capacity, double lootRatio) {
        double m = Math.floor(available.metal() * lootRatio);
        double c = Math.floor(available.crystal() * lootRatio);
        double t = Math.floor(available.tritium() * lootRatio);
        double cap = capacity;

        double takeM = Math.min(m, cap / 3);
        cap -= takeM;
        double takeC = Math.min(c, cap / 2);
        cap -= takeC;
        double takeT = Math.min(t, cap);
        cap -= takeT;

        double extraM = Math.min(m - takeM, cap / 2);
        takeM += extraM;
        cap -= extraM;
        double extraC = Math.min(c - takeC, cap);
        takeC += extraC;
        cap -= extraC;
        double extraM2 = Math.min(m - takeM, cap);
        takeM += extraM2;

        return Resources.of(Math.floor(takeM), Math.floor(takeC), Math.floor(takeT));
    }

    /** Ile surowca z pola zniszczen zbierze flota recyklerow. Metal ma pierwszenstwo, reszta krysztal. */
    public static Resources harvest(Resources debris, long recyclerCapacity) {
        double cap = recyclerCapacity;
        double half = cap / 2;
        double m = Math.min(debris.metal(), half);
        double c = Math.min(debris.crystal(), cap - m);
        cap -= m + c;
        double m2 = Math.min(debris.metal() - m, cap);
        return Resources.of(Math.floor(m + m2), Math.floor(c), 0);
    }
}
