package pl.spacepioneers.engine;

import org.junit.Test;
import pl.spacepioneers.engine.combat.CombatEngine;
import pl.spacepioneers.engine.combat.CombatResult;
import pl.spacepioneers.engine.combat.Combatant;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.common.UniverseConfig;
import pl.spacepioneers.engine.data.GameData;
import pl.spacepioneers.engine.economy.Economy;
import pl.spacepioneers.engine.economy.PlanetSnapshot;
import pl.spacepioneers.engine.economy.TechLevels;
import pl.spacepioneers.engine.special.Expedition;
import pl.spacepioneers.engine.special.MissileStrike;
import pl.spacepioneers.engine.special.Moons;

import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class AdvancedRulesTest {

    private final GameData data = GameData.loadDefault();

    @Test
    public void rapidFireIncreasesShots() {
        CombatEngine engine = new CombatEngine(data, UniverseConfig.defaults());
        // krazownik ma szybki ogien 6 przeciw lekkim mysliwcom: srednio 6 strzalow na runde
        var r = engine.simulate(List.of(new Combatant(1, Map.of("cruiser", 50L), 0, 0, 0, 0)),
                List.of(new Combatant(2, Map.of("light_fighter", 5000L), 0, 0, 0, 0)), 3);
        long shots = r.rounds().get(0).attackerShots();
        assertTrue("strzaly: " + shots, shots > 180 && shots < 420);
        var noRf = engine.simulate(List.of(new Combatant(1, Map.of("cruiser", 10L), 0, 0, 0, 0)),
                List.of(new Combatant(2, Map.of("heavy_fighter", 2000L), 0, 0, 0, 0)), 3);
        assertEquals(10, noRf.rounds().get(0).attackerShots());
    }

    @Test
    public void missilesDoNotFight() {
        CombatEngine engine = new CombatEngine(data, UniverseConfig.defaults());
        var r = engine.simulate(List.of(new Combatant(1, Map.of("light_fighter", 1L), 0, 0, 0, 0)),
                List.of(new Combatant(2, Map.of("anti_ballistic_missile", 50L), 0, 0, 0, 0)), 1);
        assertEquals(CombatResult.Outcome.ATTACKER, r.outcome());
        assertTrue(r.defenderInitial().get(0).isEmpty());
    }

    @Test
    public void missileStrike() {
        assertEquals(0, MissileStrike.rangeSystems(0));
        assertEquals(14, MissileStrike.rangeSystems(3));
        var res = MissileStrike.strike(data, 10, 4, Map.of("rocket_launcher", 100L, "plasma_turret", 2L),
                "plasma_turret", 0, 0);
        assertEquals(4, res.intercepted());
        assertEquals(6, res.hitting());
        // 6 * 12000 = 72000: 2 wieze plazmowe (10000 kazda), potem 260 wyrzutni -> max 100
        assertEquals(2L, (long) res.destroyed().get("plasma_turret"));
        assertEquals(100L, (long) res.destroyed().get("rocket_launcher"));
        assertEquals(20, MissileStrike.siloCapacity(2));
        assertEquals(7, MissileStrike.usedSlots(data, Map.of("interplanetary_missile", 3L, "anti_ballistic_missile", 1L)));
    }

    @Test
    public void moonChanceAndPhalanx() {
        assertEquals(0, Moons.chancePercent(Resources.of(50_000, 40_000, 0)));
        assertEquals(3, Moons.chancePercent(Resources.of(200_000, 100_000, 0)));
        assertEquals(20, Moons.chancePercent(Resources.of(9e9, 0, 0)));
        assertEquals(-1, Moons.phalanxRange(0));
        assertEquals(0, Moons.phalanxRange(1));
        assertEquals(15, Moons.phalanxRange(4));
    }

    @Test
    public void moonsHaveNoBaseProduction() {
        Economy eco = new Economy(data, UniverseConfig.defaults());
        var moon = new PlanetSnapshot(Map.of("lunar_base", 2), Map.of(), 0, 1, Map.of(), true);
        assertTrue(eco.production(moon, TechLevels.NONE).perHour().isZero());
        assertEquals(7, eco.maxFields(moon));
        assertTrue(data.building("lunar_base").allowedOn(true));
        assertFalse(data.building("metal_mine").allowedOn(true));
        assertTrue(data.building("shipyard").allowedOn(true));
        assertTrue(data.building("shipyard").allowedOn(false));
    }

    @Test
    public void expeditionOutcomesCoverAllKinds() {
        Set<Expedition.Kind> seen = EnumSet.noneOf(Expedition.Kind.class);
        Random rnd = new Random(5);
        for (int i = 0; i < 2000; i++) {
            var o = Expedition.resolve(data, Map.of("large_cargo", 10L, "cruiser", 5L), rnd, 1);
            seen.add(o.kind());
            if (o.kind() == Expedition.Kind.RESOURCES) assertTrue(o.resources().total() > 0);
            if (o.kind() == Expedition.Kind.PIRATES) assertFalse(o.pirates().isEmpty());
        }
        assertEquals(EnumSet.allOf(Expedition.Kind.class), seen);
        assertEquals(0, Expedition.maxConcurrent(0));
        assertEquals(3, Expedition.maxConcurrent(9));
    }
}
