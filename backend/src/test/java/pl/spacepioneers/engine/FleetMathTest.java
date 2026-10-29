package pl.spacepioneers.engine;

import org.junit.Test;
import pl.spacepioneers.engine.common.Branch;
import pl.spacepioneers.engine.common.Coordinates;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.common.UniverseConfig;
import pl.spacepioneers.engine.data.GameData;
import pl.spacepioneers.engine.economy.TechLevels;
import pl.spacepioneers.engine.fleet.FleetMath;

import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public class FleetMathTest {

    private final GameData data = GameData.loadDefault();
    private final FleetMath math = new FleetMath(data, UniverseConfig.defaults());

    @Test
    public void distances() {
        Coordinates a = Coordinates.parse("1:10:5");
        assertEquals(5, FleetMath.distance(a, a));
        assertEquals(1010, FleetMath.distance(a, Coordinates.parse("1:10:7")));
        assertEquals(2700 + 95 * 5, FleetMath.distance(a, Coordinates.parse("1:15:5")));
        assertEquals(40_000, FleetMath.distance(a, Coordinates.parse("[3:1:1]")));
    }

    @Test
    public void coordinatesValidation() {
        assertThrows(IllegalArgumentException.class, () -> Coordinates.parse("1:2"));
        assertTrue(Coordinates.parse("5:200:15").isValid(UniverseConfig.defaults()));
        assertTrue(!Coordinates.parse("6:1:1").isValid(UniverseConfig.defaults()));
    }

    @Test
    public void slowestShipDefinesSpeedAndDrivesUpgrade() {
        var ships = Map.of("small_cargo", 5L, "light_fighter", 3L);
        assertEquals(5000, math.fleetSpeed(ships, TechLevels.NONE, Branch.NONE));
        var tech = new TechLevels(Map.of("combustion_drive", 5));
        assertEquals(7500, math.fleetSpeed(ships, tech, Branch.NONE));
        assertEquals(8000, math.fleetSpeed(ships, tech, Branch.WARRIOR));
    }

    @Test
    public void satelliteCannotJoinFleet() {
        assertThrows(IllegalArgumentException.class,
                () -> math.fleetSpeed(Map.of("solar_satellite", 1L), TechLevels.NONE, Branch.NONE));
    }

    @Test
    public void flightTimeFormula() {
        // 35000/100 * sqrt(1010*10/5000) + 10 = 350*1.42127 + 10 = 507.4
        assertEquals(507, math.flightSeconds(1010, 5000, 100));
        assertTrue(math.flightSeconds(1010, 5000, 50) > math.flightSeconds(1010, 5000, 100));
        assertThrows(IllegalArgumentException.class, () -> math.flightSeconds(10, 10, 55));
    }

    @Test
    public void fuelAndCargo() {
        var ships = Map.of("small_cargo", 10L);
        // 10 * 10 * 35000/35000 * (1+1)^2 = 400 (+1)
        assertEquals(401, math.fuel(ships, 35_000, 100));
        assertEquals(50_000, math.cargoCapacity(ships, Branch.NONE));
        assertEquals(60_000, math.cargoCapacity(ships, Branch.TRADER));
    }

    @Test
    public void plunderRespectsRatioAndCapacity() {
        Resources avail = Resources.of(100_000, 50_000, 20_000);
        Resources big = FleetMath.plunder(avail, 1_000_000, 0.5);
        assertEquals(Resources.of(50_000, 25_000, 10_000), big);
        Resources small = FleetMath.plunder(avail, 30_000, 0.5);
        assertEquals(30_000, small.total(), 1e-9);
        assertTrue(small.metal() >= 10_000);
    }

    @Test
    public void harvestDebris() {
        Resources got = FleetMath.harvest(Resources.of(30_000, 5_000, 0), 20_000);
        assertEquals(Resources.of(15_000, 5_000, 0), got);
        Resources got2 = FleetMath.harvest(Resources.of(30_000, 1_000, 0), 20_000);
        assertEquals(Resources.of(19_000, 1_000, 0), got2);
    }
}
