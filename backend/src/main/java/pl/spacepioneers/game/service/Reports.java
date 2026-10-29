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

    /** Stan po rundzie; listy odpowiadaja kolejnosci uczestnikow w {@link CombatReport#attackers()} i {@link CombatReport#defenders()}. */
    public record RoundView(int number, long attackerShots, double attackerDamage, double absorbedByDefender,
                            long defenderShots, double defenderDamage, double absorbedByAttacker,
                            List<Map<String, Long>> attackerUnits, List<Map<String, Long>> defenderUnits) {
    }

    /**
     * Raport walki. Strona atakujaca moze miec wielu uczestnikow (atak sojuszniczy), obronca - wlasciciela
     * planety i floty sojusznikow (obrona sojusznicza).
     */
    public record CombatReport(
            Instant at,
            String coordinates,
            String planetName,
            List<Side> attackers,
            List<Side> defenders,
            List<Map<String, Long>> attackerStart,
            List<Map<String, Long>> defenderStart,
            List<RoundView> rounds,
            String outcome,
            List<Map<String, Long>> attackerLosses,
            List<Map<String, Long>> defenderLosses,
            Map<String, Long> defenseRebuilt,
            Resources loot,
            Resources debris,
            Resources attackerLostValue,
            Resources defenderLostValue,
            int moonChancePercent,
            boolean moonCreated
    ) {
    }

    public record EspionageReport(
            Instant at,
            String coordinates,
            String planetName,
            long ownerId,
            String ownerName,
            boolean moon,
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
