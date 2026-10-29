package pl.spacepioneers.engine.economy;

import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.common.UniverseConfig;

/** Czasy budowy, badan i produkcji jednostek (w sekundach). */
public final class Timing {

    public static final String ROBOTICS = "robotics_factory";
    public static final String NANITE = "nanite_factory";
    public static final String SHIPYARD = "shipyard";
    public static final String LAB = "research_lab";

    private final UniverseConfig config;

    public Timing(UniverseConfig config) {
        this.config = config;
    }

    public long buildingSeconds(Resources cost, PlanetSnapshot planet) {
        double hours = (cost.metal() + cost.crystal())
                / (2500.0 * (1 + planet.level(ROBOTICS)) * Math.pow(2, planet.level(NANITE)));
        return Math.max(1, Math.round(hours * 3600 / config.economySpeed()));
    }

    /**
     * Czas badania. {@code labLevel} to poziom laboratorium na planecie, z ktorej prowadzone jest badanie.
     */
    public long researchSeconds(Resources cost, int labLevel) {
        double hours = (cost.metal() + cost.crystal()) / (1000.0 * (1 + labLevel));
        return Math.max(1, Math.round(hours * 3600 / config.researchSpeed()));
    }

    /** Czas budowy jednej jednostki (statku lub obrony). */
    public long unitSeconds(Resources unitCost, PlanetSnapshot planet) {
        double hours = (unitCost.metal() + unitCost.crystal())
                / (2500.0 * (1 + planet.level(SHIPYARD)) * Math.pow(2, planet.level(NANITE)));
        return Math.max(1, Math.round(hours * 3600 / config.economySpeed()));
    }
}
