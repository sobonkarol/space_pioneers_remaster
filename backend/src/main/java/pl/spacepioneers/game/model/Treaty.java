package pl.spacepioneers.game.model;

import java.time.Instant;

/**
 * Traktat dyplomatyczny miedzy sojuszami. Pakty wymagaja akceptacji drugiej strony,
 * wypowiedzenie wojny jest jednostronne i natychmiastowe.
 */
public record Treaty(long id, long allianceA, long allianceB, Type type, Status status, long proposedBy, Instant createdAt) {

    public enum Type { DEFENSE_PACT, TRADE_PACT, NON_AGGRESSION, WAR }

    public enum Status { PROPOSED, ACTIVE }

    public boolean involves(long allianceId) {
        return allianceA == allianceId || allianceB == allianceId;
    }

    public long other(long allianceId) {
        return allianceA == allianceId ? allianceB : allianceA;
    }

    public Treaty activate() {
        return new Treaty(id, allianceA, allianceB, type, Status.ACTIVE, proposedBy, createdAt);
    }
}
