package pl.spacepioneers.game.model;

import java.time.Instant;

/** Znajomosc dwoch graczy (lista znajomych). */
public record Buddy(long id, long requesterId, long addresseeId, Status status, String text, Instant createdAt) {

    public enum Status { PENDING, ACCEPTED }

    public boolean involves(long playerId) {
        return requesterId == playerId || addresseeId == playerId;
    }

    public long other(long playerId) {
        return requesterId == playerId ? addresseeId : requesterId;
    }

    public Buddy accept() {
        return new Buddy(id, requesterId, addresseeId, Status.ACCEPTED, text, createdAt);
    }
}
