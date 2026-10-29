package pl.spacepioneers.game.model;

import pl.spacepioneers.engine.common.Coordinates;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.economy.PlanetSnapshot;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Planeta gracza wraz z budynkami, jednostkami, zasobami i kolejkami. */
public class Planet {

    private long id;
    private long ownerId;
    private String name;
    private int galaxy;
    private int system;
    private int position;
    private int fields;
    private int temperatureMin;
    private int temperatureMax;
    private String planetType;
    private int imageVariant;
    private boolean homeworld;
    private boolean moon;
    private Instant jumpGateReadyAt;
    private Resources resources = Resources.ZERO;
    private Instant lastUpdate;
    private Instant createdAt;
    private Map<String, Integer> buildings = new HashMap<>();
    private Map<String, Long> units = new HashMap<>();
    private Map<String, Integer> productionPercent = new HashMap<>();
    private List<BuildOrder> buildQueue = new ArrayList<>();
    private List<ShipyardOrder> shipyardQueue = new ArrayList<>();

    public Coordinates coordinates() {
        return new Coordinates(galaxy, system, position);
    }

    public void setCoordinates(Coordinates c) {
        this.galaxy = c.galaxy();
        this.system = c.system();
        this.position = c.position();
    }

    public int level(String building) {
        return buildings.getOrDefault(building, 0);
    }

    public long count(String unit) {
        return units.getOrDefault(unit, 0L);
    }

    public void addUnits(String unit, long n) {
        long v = count(unit) + n;
        if (v < 0) throw new IllegalStateException("Ujemna liczba jednostek " + unit);
        if (v == 0) units.remove(unit);
        else units.put(unit, v);
    }

    public PlanetSnapshot snapshot() {
        return new PlanetSnapshot(buildings, units, temperatureMax, fields, productionPercent, moon);
    }

    /** Pierwsza rozpoczeta pozycja kolejki budowy (lub null). */
    public BuildOrder activeBuild() {
        return buildQueue.isEmpty() || !buildQueue.get(0).started() ? null : buildQueue.get(0);
    }

    /** Poziom budynku po wykonaniu calej kolejki. */
    public int plannedLevel(String building) {
        int level = level(building);
        for (BuildOrder o : buildQueue) {
            if (o.building().equals(building)) level = o.level();
        }
        return level;
    }

    public long getId() { return id; }
    public void setId(long id) { this.id = id; }
    public long getOwnerId() { return ownerId; }
    public void setOwnerId(long ownerId) { this.ownerId = ownerId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getGalaxy() { return galaxy; }
    public void setGalaxy(int galaxy) { this.galaxy = galaxy; }
    public int getSystem() { return system; }
    public void setSystem(int system) { this.system = system; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public int getFields() { return fields; }
    public void setFields(int fields) { this.fields = fields; }
    public int getTemperatureMin() { return temperatureMin; }
    public void setTemperatureMin(int temperatureMin) { this.temperatureMin = temperatureMin; }
    public int getTemperatureMax() { return temperatureMax; }
    public void setTemperatureMax(int temperatureMax) { this.temperatureMax = temperatureMax; }
    public String getPlanetType() { return planetType; }
    public void setPlanetType(String planetType) { this.planetType = planetType; }
    public int getImageVariant() { return imageVariant; }
    public void setImageVariant(int imageVariant) { this.imageVariant = imageVariant; }
    public boolean isMoon() { return moon; }
    public void setMoon(boolean moon) { this.moon = moon; }
    public Instant getJumpGateReadyAt() { return jumpGateReadyAt; }
    public void setJumpGateReadyAt(Instant jumpGateReadyAt) { this.jumpGateReadyAt = jumpGateReadyAt; }
    public boolean isHomeworld() { return homeworld; }
    public void setHomeworld(boolean homeworld) { this.homeworld = homeworld; }
    public Resources getResources() { return resources; }
    public void setResources(Resources resources) { this.resources = resources; }
    public Instant getLastUpdate() { return lastUpdate; }
    public void setLastUpdate(Instant lastUpdate) { this.lastUpdate = lastUpdate; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Map<String, Integer> getBuildings() { return buildings; }
    public void setBuildings(Map<String, Integer> buildings) { this.buildings = new HashMap<>(buildings); }
    public Map<String, Long> getUnits() { return units; }
    public void setUnits(Map<String, Long> units) { this.units = new HashMap<>(units); }
    public Map<String, Integer> getProductionPercent() { return productionPercent; }
    public void setProductionPercent(Map<String, Integer> p) { this.productionPercent = new HashMap<>(p); }
    public List<BuildOrder> getBuildQueue() { return buildQueue; }
    public void setBuildQueue(List<BuildOrder> buildQueue) { this.buildQueue = new ArrayList<>(buildQueue); }
    public List<ShipyardOrder> getShipyardQueue() { return shipyardQueue; }
    public void setShipyardQueue(List<ShipyardOrder> q) { this.shipyardQueue = new ArrayList<>(q); }
}
