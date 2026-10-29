package pl.spacepioneers.engine.economy;

import java.util.Map;

/**
 * Niezalezny od bazy danych obraz planety wykorzystywany do obliczen.
 *
 * @param buildings         poziomy budynkow
 * @param units             liczby statkow i obrony stacjonujacych na planecie
 * @param temperatureMax    maksymalna temperatura (wplywa na tryt i satelity)
 * @param fields            bazowa liczba pol zabudowy
 * @param productionPercent ustawienia produkcji 0..100 dla kopalni/elektrowni/satelit (brak = 100)
 * @param moon              czy to ksiezyc (brak produkcji podstawowej)
 */
public record PlanetSnapshot(
        Map<String, Integer> buildings,
        Map<String, Long> units,
        int temperatureMax,
        int fields,
        Map<String, Integer> productionPercent,
        boolean moon
) {
    public PlanetSnapshot(Map<String, Integer> buildings, Map<String, Long> units, int temperatureMax, int fields,
                          Map<String, Integer> productionPercent) {
        this(buildings, units, temperatureMax, fields, productionPercent, false);
    }

    public PlanetSnapshot {
        buildings = buildings == null ? Map.of() : Map.copyOf(buildings);
        units = units == null ? Map.of() : Map.copyOf(units);
        productionPercent = productionPercent == null ? Map.of() : Map.copyOf(productionPercent);
    }

    public int level(String building) {
        return buildings.getOrDefault(building, 0);
    }

    public long count(String unit) {
        return units.getOrDefault(unit, 0L);
    }

    public double percent(String key) {
        int p = productionPercent.getOrDefault(key, 100);
        return Math.max(0, Math.min(100, p)) / 100.0;
    }
}
