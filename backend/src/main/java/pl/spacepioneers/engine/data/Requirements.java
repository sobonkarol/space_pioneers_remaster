package pl.spacepioneers.engine.data;

import java.util.Map;

/** Wymagania technologiczne: minimalne poziomy budynkow (na planecie) i badan (gracza). */
public record Requirements(Map<String, Integer> buildings, Map<String, Integer> research) {

    public static final Requirements NONE = new Requirements(Map.of(), Map.of());

    public Requirements {
        buildings = buildings == null ? Map.of() : Map.copyOf(buildings);
        research = research == null ? Map.of() : Map.copyOf(research);
    }
}
