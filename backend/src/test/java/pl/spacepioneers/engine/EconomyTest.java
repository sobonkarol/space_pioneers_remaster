package pl.spacepioneers.engine;

import org.junit.Test;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.common.UniverseConfig;
import pl.spacepioneers.engine.data.GameData;
import pl.spacepioneers.engine.economy.Economy;
import pl.spacepioneers.engine.economy.PlanetSnapshot;
import pl.spacepioneers.engine.economy.ProductionReport;
import pl.spacepioneers.engine.economy.RequirementChecker;
import pl.spacepioneers.engine.economy.TechLevels;
import pl.spacepioneers.engine.economy.Timing;

import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class EconomyTest {

    private final GameData data = GameData.loadDefault();
    private final Economy economy = new Economy(data, UniverseConfig.defaults());

    private PlanetSnapshot planet(Map<String, Integer> buildings) {
        return new PlanetSnapshot(buildings, Map.of(), 40, 163, Map.of());
    }

    @Test
    public void emptyPlanetHasBaseProductionOnly() {
        ProductionReport r = economy.production(planet(Map.of()), TechLevels.NONE);
        assertEquals(Resources.of(30, 15, 0), r.perHour());
        assertEquals(1.0, r.efficiency(), 1e-9);
    }

    @Test
    public void minesWithEnoughEnergyProduceFully() {
        ProductionReport r = economy.production(planet(Map.of("metal_mine", 1, "solar_plant", 1)), TechLevels.NONE);
        // metal 30*1*1.1 = 33, energia 22 produkowana / 11 zuzywana
        assertEquals(1.0, r.efficiency(), 1e-9);
        assertEquals(30 + 33, r.perHour().metal(), 1e-9);
        assertEquals(22, r.energyProduced(), 1e-9);
        assertEquals(11, r.energyUsed(), 1e-9);
    }

    @Test
    public void energyDeficitReducesMineOutput() {
        ProductionReport r = economy.production(planet(Map.of("metal_mine", 4, "crystal_mine", 4)), TechLevels.NONE);
        assertEquals(0.0, r.efficiency(), 1e-9);
        assertEquals(Resources.of(30, 15, 0), r.perHour());
    }

    @Test
    public void satellitesProduceEnergyByTemperature() {
        assertEquals(30, Economy.satelliteEnergy(40), 1e-9);
        assertEquals(1, Economy.satelliteEnergy(-200), 1e-9);
        var p = new PlanetSnapshot(Map.of(), Map.of("solar_satellite", 10L), 40, 163, Map.of());
        assertEquals(300, economy.production(p, TechLevels.NONE).energyProduced(), 1e-9);
    }

    @Test
    public void fusionConsumesTritium() {
        var p = planet(Map.of("fusion_plant", 1));
        ProductionReport r = economy.production(p, TechLevels.NONE);
        assertEquals(-11, r.perHour().tritium(), 1e-9);
        assertTrue(r.energyProduced() > 30);
    }

    @Test
    public void productionPercentScalesConsumption() {
        var p = new PlanetSnapshot(Map.of("metal_mine", 1, "solar_plant", 1), Map.of(), 40, 163, Map.of("metal_mine", 50));
        ProductionReport r = economy.production(p, TechLevels.NONE);
        assertEquals(30 + 16.5, r.perHour().metal(), 1e-9);
        assertEquals(5.5, r.energyUsed(), 1e-9);
    }

    @Test
    public void accrualStopsAtStorageButKeepsOverflow() {
        Resources cap = Resources.of(10_000, 10_000, 10_000);
        Resources perHour = Resources.of(3600, 3600, -3600);
        Resources after = Economy.accrue(Resources.of(9_000, 12_000, 500), perHour, cap, 3600);
        assertEquals(10_000, after.metal(), 1e-9);
        assertEquals(12_000, after.crystal(), 1e-9); // nadwyzka nie przepada
        assertEquals(0, after.tritium(), 1e-9);     // nie schodzi ponizej zera
    }

    @Test
    public void storageGrows() {
        assertEquals(10_000, Economy.storageForLevel(0), 1e-9);
        assertEquals(18_000, Economy.storageForLevel(1), 1e-9);
        var p = planet(Map.of("metal_storage", 2));
        assertEquals(32_400, economy.storageCapacity(p).metal(), 1e-9);
        assertEquals(10_000, economy.storageCapacity(p).crystal(), 1e-9);
    }

    @Test
    public void buildTimeShrinksWithRobotics() {
        Timing timing = new Timing(UniverseConfig.defaults());
        Resources cost = Resources.of(2500, 0, 0);
        assertEquals(3600, timing.buildingSeconds(cost, planet(Map.of())));
        assertEquals(1800, timing.buildingSeconds(cost, planet(Map.of("robotics_factory", 1))));
        assertEquals(900, timing.buildingSeconds(cost, planet(Map.of("robotics_factory", 1, "nanite_factory", 1))));
    }

    @Test
    public void speedUniverseShortensTimes() {
        Timing timing = new Timing(UniverseConfig.defaults().withSpeed(4));
        assertEquals(900, timing.buildingSeconds(Resources.of(2500, 0, 0), planet(Map.of())));
        assertEquals(900, timing.researchSeconds(Resources.of(1000, 0, 0), 0));
    }

    @Test
    public void requirementsReportMissing() {
        var req = data.building("fusion_plant").requirements();
        var missing = RequirementChecker.missing(req, planet(Map.of("tritium_synthesizer", 2)), TechLevels.NONE);
        assertEquals(2, missing.size());
        assertTrue(missing.contains("building:tritium_synthesizer:5"));
        assertTrue(missing.contains("research:energy_tech:3"));
        var ok = RequirementChecker.missing(req, planet(Map.of("tritium_synthesizer", 5)),
                new TechLevels(Map.of("energy_tech", 3)));
        assertTrue(ok.isEmpty());
    }

    @Test
    public void fieldsIncludeTerraformer() {
        var p = planet(Map.of("terraformer", 2, "metal_mine", 3));
        assertEquals(173, economy.maxFields(p));
        assertEquals(5, Economy.usedFields(p));
    }
}
