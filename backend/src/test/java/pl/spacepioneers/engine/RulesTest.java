package pl.spacepioneers.engine;

import org.junit.Test;
import pl.spacepioneers.engine.common.Branch;
import pl.spacepioneers.engine.common.ResourceType;
import pl.spacepioneers.engine.common.UniverseConfig;
import pl.spacepioneers.engine.data.GameData;
import pl.spacepioneers.engine.economy.Market;
import pl.spacepioneers.engine.economy.PlanetGenerator;
import pl.spacepioneers.engine.economy.Points;

import java.util.Map;
import java.util.Random;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public class RulesTest {

    @Test
    public void fleetSlotsAndPlanets() {
        assertEquals(1, Rules.fleetSlots(0));
        assertEquals(6, Rules.fleetSlots(5));
        assertEquals(1, Rules.maxPlanets(0));
        assertEquals(2, Rules.maxPlanets(1));
        assertEquals(2, Rules.maxPlanets(2));
        assertEquals(3, Rules.maxPlanets(3));
        assertEquals(9, Rules.maxPlanets(30));
    }

    @Test
    public void newbieProtection() {
        var cfg = UniverseConfig.defaults();
        assertFalse(Rules.attackAllowed(100_000, 1_000, false, cfg));
        assertTrue(Rules.attackAllowed(100_000, 1_000, true, cfg));
        assertTrue(Rules.attackAllowed(4_000, 1_000, false, cfg));
        assertTrue(Rules.attackAllowed(100_000, 50_000, false, cfg));
        assertFalse(Rules.attackAllowed(1_000, 100_000, false, cfg));
    }

    @Test
    public void warriorBonus() {
        assertEquals(0, Rules.attackBonus(Branch.TRADER, 5), 1e-9);
        assertEquals(0.15, Rules.attackBonus(Branch.WARRIOR, 5), 1e-9);
    }

    @Test
    public void marketExchange() {
        assertTrue(Market.available(Branch.TRADER, 1));
        assertFalse(Market.available(Branch.WARRIOR, 5));
        assertFalse(Market.available(Branch.TRADER, 0));
        // 3000 metalu = 1000 jednostek wartosci = 1000 trytu, minus 10% prowizji
        assertEquals(900, Market.exchange(ResourceType.METAL, ResourceType.TRITIUM, 3000, 0));
        assertEquals(0.05, Market.fee(20), 1e-9);
        assertThrows(IllegalArgumentException.class, () -> Market.exchange(ResourceType.METAL, ResourceType.METAL, 1, 0));
    }

    @Test
    public void pointsFromCosts() {
        Points points = new Points(GameData.loadDefault());
        // metal_mine 1..2: (60+15) + (90+22) = 187
        assertEquals(0.187, points.buildingPoints(Map.of("metal_mine", 2)), 1e-9);
        double[] u = points.unitPoints(Map.of("small_cargo", 10L, "rocket_launcher", 5L));
        assertEquals(40, u[0], 1e-9);
        assertEquals(10, u[1], 1e-9);
    }

    @Test
    public void planetGeneration() {
        Random rnd = new Random(1);
        for (int pos = 1; pos <= 15; pos++) {
            var t = PlanetGenerator.colony(pos, rnd);
            assertTrue(t.fields() >= 50 && t.fields() <= 200);
            assertEquals(t.temperatureMax() - 40, t.temperatureMin());
        }
        assertEquals(163, PlanetGenerator.homeworld(8, rnd).fields());
        assertEquals("hot", PlanetGenerator.planetType(1));
        assertEquals("ice", PlanetGenerator.planetType(15));
    }
}
