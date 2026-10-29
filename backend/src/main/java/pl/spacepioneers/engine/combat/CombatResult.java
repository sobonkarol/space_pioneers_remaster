package pl.spacepioneers.engine.combat;

import pl.spacepioneers.engine.common.Resources;

import java.util.List;
import java.util.Map;

public record CombatResult(
        Outcome outcome,
        List<Round> rounds,
        List<Map<String, Long>> attackerInitial,
        List<Map<String, Long>> defenderInitial,
        List<Map<String, Long>> attackerSurvivors,
        List<Map<String, Long>> defenderSurvivors,
        List<Map<String, Long>> attackerLosses,
        List<Map<String, Long>> defenderLosses,
        Map<String, Long> defenseRebuilt,
        Resources debris,
        Resources attackerLostValue,
        Resources defenderLostValue
) {
    public enum Outcome { ATTACKER, DEFENDER, DRAW }

    /**
     * Podsumowanie rundy. Liczby pozostalych jednostek po rundzie, w podziale na uczestnikow.
     */
    public record Round(
            int number,
            long attackerShots,
            double attackerDamage,
            double absorbedByDefender,
            long defenderShots,
            double defenderDamage,
            double absorbedByAttacker,
            List<Map<String, Long>> attackersAfter,
            List<Map<String, Long>> defendersAfter
    ) {
    }
}
