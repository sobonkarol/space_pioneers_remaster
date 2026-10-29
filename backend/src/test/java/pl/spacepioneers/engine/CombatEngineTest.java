package pl.spacepioneers.engine;

import org.junit.Test;
import pl.spacepioneers.engine.combat.CombatEngine;
import pl.spacepioneers.engine.combat.CombatResult;
import pl.spacepioneers.engine.combat.Combatant;
import pl.spacepioneers.engine.combat.Espionage;
import pl.spacepioneers.engine.common.UniverseConfig;
import pl.spacepioneers.engine.data.GameData;

import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class CombatEngineTest {

    private final GameData data = GameData.loadDefault();
    private final CombatEngine engine = new CombatEngine(data, UniverseConfig.defaults());

    private static Combatant side(long id, Map<String, Long> units) {
        return new Combatant(id, units, 0, 0, 0, 0);
    }

    @Test
    public void overwhelmingAttackerWins() {
        var r = engine.simulate(List.of(side(1, Map.of("battleship", 50L))),
                List.of(side(2, Map.of("light_fighter", 5L))), 42);
        assertEquals(CombatResult.Outcome.ATTACKER, r.outcome());
        assertTrue(r.defenderSurvivors().get(0).isEmpty());
        assertEquals(5L, (long) r.defenderLosses().get(0).get("light_fighter"));
        assertTrue(r.rounds().size() <= 2);
        // 5 mysliwcow * (3000+1000) * 30%
        assertEquals(4_500, r.debris().metal(), 1e-9);
        assertEquals(1_500, r.debris().crystal(), 1e-9);
    }

    @Test
    public void emptyDefenderMeansImmediateWin() {
        var r = engine.simulate(List.of(side(1, Map.of("small_cargo", 1L))), List.of(side(2, Map.of())), 1);
        assertEquals(CombatResult.Outcome.ATTACKER, r.outcome());
        assertTrue(r.rounds().isEmpty());
    }

    @Test
    public void unarmedVsUnarmedIsDraw() {
        var r = engine.simulate(List.of(side(1, Map.of("espionage_probe", 3L))),
                List.of(side(2, Map.of("espionage_probe", 3L))), 7);
        assertEquals(CombatResult.Outcome.DRAW, r.outcome());
        assertEquals(6, r.rounds().size());
    }

    @Test
    public void shieldDomeBouncesWeakShots() {
        // Mysliwiec (atak 50) przeciw duzej kopule (oslona 10000): 50 < 1% * 10000 -> brak efektu
        var r = engine.simulate(List.of(side(1, Map.of("light_fighter", 100L))),
                List.of(side(2, Map.of("large_shield_dome", 1L))), 3);
        assertEquals(CombatResult.Outcome.DRAW, r.outcome());
        assertTrue(r.defenderLosses().get(0).isEmpty());
    }

    @Test
    public void isDeterministicForSeed() {
        var a = List.of(side(1, Map.of("light_fighter", 200L, "heavy_fighter", 50L)));
        var d = List.of(side(2, Map.of("rocket_launcher", 150L, "light_laser", 60L, "cruiser", 10L)));
        var r1 = engine.simulate(a, d, 99);
        var r2 = engine.simulate(a, d, 99);
        assertEquals(r1.attackerLosses(), r2.attackerLosses());
        assertEquals(r1.defenderLosses(), r2.defenderLosses());
        assertEquals(r1.defenseRebuilt(), r2.defenseRebuilt());
    }

    @Test
    public void defenseIsPartiallyRebuiltAndNotInDebris() {
        var r = engine.simulate(List.of(side(1, Map.of("battleship", 800L))),
                List.of(side(2, Map.of("rocket_launcher", 1000L))), 5);
        assertEquals(CombatResult.Outcome.ATTACKER, r.outcome());
        long rebuilt = r.defenseRebuilt().getOrDefault("rocket_launcher", 0L);
        assertTrue("odbudowano ok. 70%: " + rebuilt, rebuilt > 600 && rebuilt < 800);
        assertEquals(0, r.debris().metal(), 1e-9);
    }

    @Test
    public void technologyMatters() {
        var units = Map.of("light_fighter", 300L);
        int strongWins = 0;
        for (int seed = 0; seed < 10; seed++) {
            var r = engine.simulate(List.of(new Combatant(1, units, 10, 10, 10, 0)),
                    List.of(new Combatant(2, units, 0, 0, 0, 0)), seed);
            if (r.outcome() == CombatResult.Outcome.ATTACKER) strongWins++;
        }
        assertTrue(strongWins >= 9);
    }

    @Test
    public void multipleAttackersTrackedSeparately() {
        var r = engine.simulate(List.of(side(1, Map.of("cruiser", 20L)), side(3, Map.of("cruiser", 20L))),
                List.of(side(2, Map.of("light_fighter", 10L))), 11);
        assertEquals(2, r.attackerSurvivors().size());
        assertEquals(CombatResult.Outcome.ATTACKER, r.outcome());
    }

    @Test
    public void espionageSections() {
        var s1 = Espionage.visibleSections(1, 0, 0);
        assertTrue(s1.contains(Espionage.Section.RESOURCES));
        assertFalse(s1.contains(Espionage.Section.FLEET));
        var s7 = Espionage.visibleSections(7, 0, 0);
        assertTrue(s7.contains(Espionage.Section.RESEARCH));
        var tech = Espionage.visibleSections(1, 3, 0);
        assertTrue(tech.contains(Espionage.Section.RESEARCH)); // 1 + 9
        var worse = Espionage.visibleSections(4, 0, 2);       // 4 - 4 = 0
        assertEquals(1, worse.size());
        assertEquals(0.0, Espionage.counterEspionageChance(5, 0, 0, 0), 1e-9);
        assertEquals(1.0, Espionage.counterEspionageChance(10, 1000, 0, 0), 1e-9);
    }
}
