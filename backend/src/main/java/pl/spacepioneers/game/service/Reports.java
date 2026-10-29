package pl.spacepioneers.game.service;

import pl.spacepioneers.engine.common.Resources;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Ustrukturyzowane tresci raportow zapisywane w wiadomosciach (pole payload, JSON). */
public final class Reports {

    private Reports() {
    }

    public record Side(long playerId, String playerName, String coordinates, int weapons, int shielding, int armour) {
    }

    public record RoundView(int number, long attackerShots, double attackerDamage, double absorbedByDefender,
                            long defenderShots, double defenderDamage, double absorbedByAttacker,
                            Map<String, Long> attackerUnits, Map<String, Long> defenderUnits) {
    }

    public record CombatReport(
            Instant at,
            String coordinates,
            String planetName,
            Side attacker,
            Side defender,
            Map<String, Long> attackerStart,
            Map<String, Long> defenderStart,
            List<RoundView> rounds,
            String outcome,
            Map<String, Long> attackerLosses,
            Map<String, Long> defenderLosses,
            Map<String, Long> defenseRebuilt,
            Resources loot,
            Resources debris,
            Resources attackerLostValue,
            Resources defenderLostValue
    ) {
    }

    public record EspionageReport(
            Instant at,
            String coordinates,
            String planetName,
            long ownerId,
            String ownerName,
            Resources resources,
            Map<String, Long> fleet,
            Map<String, Long> defense,
            Map<String, Integer> buildings,
            Map<String, Integer> research,
            int counterEspionageChancePercent,
            boolean probesDestroyed
    ) {
    }
}
