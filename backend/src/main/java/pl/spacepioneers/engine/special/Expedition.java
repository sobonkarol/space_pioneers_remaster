package pl.spacepioneers.engine.special;

import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.data.GameData;
import pl.spacepioneers.engine.data.UnitDef;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Ekspedycje w nieznany obszar (pozycja poza ostatnia planeta systemu). Wynik losowy,
 * skalowany wartoscia wyslanej floty.
 */
public final class Expedition {

    public enum Kind { NOTHING, RESOURCES, SHIPS, PIRATES, DELAY, EARLY, LOST }

    /**
     * @param resources  znalezione surowce (przed ograniczeniem ladownoscia)
     * @param ships      znalezione statki
     * @param pirates    flota piratow do walki (dla PIRATES)
     * @param timeFactor mnoznik czasu powrotu (DELAY &gt; 1, EARLY &lt; 1)
     */
    public record Outcome(Kind kind, Resources resources, Map<String, Long> ships, Map<String, Long> pirates,
                          double timeFactor) {
    }

    private Expedition() {
    }

    /** Maksymalna liczba jednoczesnych ekspedycji = sqrt(astrofizyka). */
    public static int maxConcurrent(int astrophysics) {
        return (int) Math.floor(Math.sqrt(astrophysics));
    }

    public static Outcome resolve(GameData data, Map<String, Long> fleet, Random rnd, double economySpeed) {
        double fleetValue = 0;
        for (var e : fleet.entrySet()) fleetValue += data.unit(e.getKey()).cost().total() * e.getValue();
        double roll = rnd.nextDouble();
        if (roll < 0.02) {
            return new Outcome(Kind.LOST, Resources.ZERO, Map.of(), Map.of(), 1);
        }
        if (roll < 0.32) {
            return new Outcome(Kind.NOTHING, Resources.ZERO, Map.of(), Map.of(), 1);
        }
        if (roll < 0.57) {
            double base = Math.min(fleetValue * 0.5, 25_000 * Math.max(1, economySpeed)) * (0.4 + rnd.nextDouble() * 0.6);
            int which = rnd.nextInt(10);
            Resources r = which < 5 ? Resources.of(base, 0, 0) : which < 8 ? Resources.of(0, base * 0.66, 0)
                    : Resources.of(0, 0, base * 0.33);
            return new Outcome(Kind.RESOURCES, r.floor(), Map.of(), Map.of(), 1);
        }
        if (roll < 0.67) {
            double budget = Math.min(fleetValue * 0.25, 40_000 * Math.max(1, economySpeed)) * (0.5 + rnd.nextDouble() * 0.5);
            Map<String, Long> found = new LinkedHashMap<>();
            for (String key : List.of("small_cargo", "light_fighter", "heavy_fighter", "large_cargo")) {
                UnitDef u = data.unit(key);
                long n = (long) Math.floor(budget * (0.2 + rnd.nextDouble() * 0.3) / u.cost().total());
                if (n > 0) {
                    found.put(key, n);
                    budget -= n * u.cost().total();
                }
            }
            if (found.isEmpty()) found.put("small_cargo", 1L);
            return new Outcome(Kind.SHIPS, Resources.ZERO, found, Map.of(), 1);
        }
        if (roll < 0.77) {
            double strength = fleetValue * (0.15 + rnd.nextDouble() * 0.25);
            Map<String, Long> pirates = new LinkedHashMap<>();
            long fighters = Math.max(1, (long) (strength * 0.6 / data.unit("light_fighter").cost().total()));
            long heavies = (long) (strength * 0.4 / data.unit("heavy_fighter").cost().total());
            pirates.put("light_fighter", fighters);
            if (heavies > 0) pirates.put("heavy_fighter", heavies);
            return new Outcome(Kind.PIRATES, Resources.ZERO, Map.of(), pirates, 1);
        }
        if (roll < 0.89) {
            return new Outcome(Kind.DELAY, Resources.ZERO, Map.of(), Map.of(), 1.5 + rnd.nextDouble());
        }
        return new Outcome(Kind.EARLY, Resources.ZERO, Map.of(), Map.of(), 0.5);
    }
}
