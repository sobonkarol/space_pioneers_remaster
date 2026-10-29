package pl.spacepioneers.engine.economy;

import pl.spacepioneers.engine.common.ResourceType;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.common.UniverseConfig;
import pl.spacepioneers.engine.data.BuildingDef;
import pl.spacepioneers.engine.data.GameData;
import pl.spacepioneers.engine.data.GrowthFormula;

import java.util.LinkedHashMap;
import java.util.Map;

/** Produkcja, energia, magazyny i narastanie zasobow w czasie. */
public final class Economy {

    /** Produkcja bazowa planety niezalezna od kopalni (na godzine, przed mnoznikiem predkosci). */
    public static final Resources BASE_PRODUCTION = Resources.of(30, 15, 0);
    /** Pojemnosc magazynu przy poziomie 0. */
    public static final double BASE_STORAGE = 10_000;
    public static final double STORAGE_GROWTH = 1.8;
    public static final String SOLAR_SATELLITE = "solar_satellite";

    private final GameData data;
    private final UniverseConfig config;

    public Economy(GameData data, UniverseConfig config) {
        this.data = data;
        this.config = config;
    }

    public ProductionReport production(PlanetSnapshot planet, TechLevels tech) {
        Map<String, Resources> perSource = new LinkedHashMap<>();
        Map<String, Double> energyPerSource = new LinkedHashMap<>();
        double speed = config.economySpeed();

        double energyProduced = 0;
        double energyUsed = 0;
        Resources mines = Resources.ZERO;
        Resources consumption = Resources.ZERO;

        for (BuildingDef b : data.buildings()) {
            int level = planet.level(b.key());
            if (level <= 0) {
                continue;
            }
            double pct = planet.percent(b.key());
            if (b.energyProduction() != null) {
                GrowthFormula f = b.energyProduction();
                int techLevel = f.techBonusKey() == null ? 0 : tech.level(f.techBonusKey());
                double e = f.valueAt(level, techLevel) * pct;
                energyProduced += e;
                energyPerSource.put(b.key(), e);
            }
            if (b.energyUse() != null) {
                double e = b.energyUse().valueAt(level, 0) * pct;
                energyUsed += e;
                energyPerSource.put(b.key(), -e);
            }
            if (b.tritiumUse() != null) {
                double t = b.tritiumUse().valueAt(level, 0) * pct * speed;
                consumption = consumption.plus(Resources.of(0, 0, t));
                perSource.put(b.key(), Resources.of(0, 0, -t));
            }
        }

        long satellites = planet.count(SOLAR_SATELLITE);
        if (satellites > 0) {
            double e = satellites * satelliteEnergy(planet.temperatureMax()) * planet.percent(SOLAR_SATELLITE);
            energyProduced += e;
            energyPerSource.put(SOLAR_SATELLITE, e);
        }

        double efficiency = energyUsed <= 0 ? 1.0 : Math.min(1.0, energyProduced / energyUsed);

        for (BuildingDef b : data.buildings()) {
            GrowthFormula f = b.production();
            int level = planet.level(b.key());
            if (f == null || level <= 0) {
                continue;
            }
            double amount = f.valueAt(level, 0) * planet.percent(b.key()) * efficiency * speed;
            if (f.isTemperatureDependent()) {
                amount *= tritiumTemperatureFactor(planet.temperatureMax());
            }
            Resources r = Resources.ZERO.with(f.resource(), amount);
            mines = mines.plus(r);
            perSource.put(b.key(), r);
        }

        Resources base = planet.moon() ? Resources.ZERO : BASE_PRODUCTION.times(speed);
        perSource.put("base", base);
        Resources total = base.plus(mines).minus(consumption);
        return new ProductionReport(total, energyProduced, energyUsed, efficiency, perSource, energyPerSource);
    }

    /** Energia jednej satelity sloneczne zalezy od temperatury planety. */
    public static double satelliteEnergy(int temperatureMax) {
        return Math.max(1, Math.floor((temperatureMax + 140) / 6.0));
    }

    /** Zimniejsze planety daja wiecej trytu. */
    public static double tritiumTemperatureFactor(int temperatureMax) {
        return Math.max(0.1, 1.44 - 0.004 * temperatureMax);
    }

    public Resources storageCapacity(PlanetSnapshot planet) {
        double[] cap = {BASE_STORAGE, BASE_STORAGE, BASE_STORAGE};
        for (BuildingDef b : data.buildings()) {
            if (b.storage() == null) {
                continue;
            }
            int level = planet.level(b.key());
            cap[b.storage().resource().ordinal()] = storageForLevel(level);
        }
        return Resources.of(cap[0], cap[1], cap[2]);
    }

    public static double storageForLevel(int level) {
        return Math.floor(BASE_STORAGE * Math.pow(STORAGE_GROWTH, level));
    }

    /**
     * Narastanie zasobow przez {@code seconds} sekund. Produkcja dodatnia zatrzymuje sie
     * na pojemnosci magazynu (nadwyzka powyzej limitu nie przepada), produkcja ujemna nie schodzi ponizej zera.
     */
    public static Resources accrue(Resources current, Resources perHour, Resources capacity, double seconds) {
        if (seconds <= 0) {
            return current;
        }
        Resources result = current;
        for (ResourceType t : ResourceType.values()) {
            double now = current.get(t);
            double rate = perHour.get(t);
            double cap = capacity.get(t);
            double delta = rate * seconds / 3600.0;
            double next;
            if (delta >= 0) {
                next = now >= cap ? now : Math.min(cap, now + delta);
            } else {
                next = Math.max(0, now + delta);
            }
            result = result.with(t, next);
        }
        return result;
    }

    /** Liczba zajetych pol = suma poziomow budynkow. */
    public static int usedFields(PlanetSnapshot planet) {
        return planet.buildings().values().stream().mapToInt(Integer::intValue).sum();
    }

    public int maxFields(PlanetSnapshot planet) {
        int bonus = 0;
        for (BuildingDef b : data.buildings()) {
            if (b.fieldsBonus() != null) {
                bonus += b.fieldsBonus() * planet.level(b.key());
            }
        }
        return planet.fields() + bonus;
    }
}
