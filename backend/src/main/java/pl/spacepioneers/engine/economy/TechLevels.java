package pl.spacepioneers.engine.economy;

import java.util.Map;

/** Poziomy badan gracza. */
public record TechLevels(Map<String, Integer> levels) {

    public static final TechLevels NONE = new TechLevels(Map.of());

    public TechLevels {
        levels = levels == null ? Map.of() : Map.copyOf(levels);
    }

    public int level(String key) {
        return levels.getOrDefault(key, 0);
    }
}
