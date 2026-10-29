package pl.spacepioneers.game.model;

import java.time.Instant;

public record AllianceApplication(long id, long allianceId, long playerId, String text, Instant createdAt) {
}
