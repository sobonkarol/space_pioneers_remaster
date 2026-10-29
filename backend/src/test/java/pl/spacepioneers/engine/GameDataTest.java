package pl.spacepioneers.engine;

import org.junit.Test;
import pl.spacepioneers.engine.common.Branch;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.data.GameData;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class GameDataTest {

    private final GameData data = GameData.loadDefault();

    @Test
    public void loadsAllCatalogs() {
        assertEquals(19, data.buildings().size());
        assertEquals(14, data.research().size());
        assertEquals(13, data.ships().size());
        assertEquals(8, data.defenses().size());
        assertEquals(2, data.missiles().size());
    }

    @Test
    public void costGrowsGeometrically() {
        var mine = data.building("metal_mine");
        assertEquals(Resources.of(60, 15, 0), mine.costForLevel(1));
        assertEquals(Resources.of(90, 22, 0), mine.costForLevel(2));
        assertEquals(Resources.of(135, 33, 0), mine.costForLevel(3));
    }

    @Test
    public void branchSpecificContentIsMarked() {
        assertEquals(Branch.TRADER, data.building("trade_center").branch());
        assertEquals(Branch.WARRIOR, data.building("war_academy").branch());
        assertEquals(Branch.WARRIOR, data.unit("destroyer").branch());
        assertEquals(Branch.TRADER, data.unit("freighter").branch());
        assertEquals(Branch.NONE, data.unit("small_cargo").branch());
    }

    @Test
    public void satelliteCannotFly() {
        assertFalse(data.unit("solar_satellite").canFly());
        assertTrue(data.unit("small_cargo").canFly());
    }

    @Test
    public void hullFromCost() {
        assertEquals(400.0, data.unit("small_cargo").baseHull(), 1e-9);
        assertEquals(200.0, data.unit("rocket_launcher").baseHull(), 1e-9);
    }
}
