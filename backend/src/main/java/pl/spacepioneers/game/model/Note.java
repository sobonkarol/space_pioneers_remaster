package pl.spacepioneers.game.model;

import java.time.Instant;

/** Prywatna notatka gracza. Priorytet: 0 - niski, 1 - normalny, 2 - wazny. */
public record Note(long id, long ownerId, String title, String text, int priority, Instant createdAt, Instant updatedAt) {
}
