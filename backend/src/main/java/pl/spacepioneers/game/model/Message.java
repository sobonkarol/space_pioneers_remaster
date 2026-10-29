package pl.spacepioneers.game.model;

import java.time.Instant;

/**
 * Wiadomosc w skrzynce gracza.
 *
 * @param archived zapisana w archiwum - nie jest usuwana automatycznie
 * @param payload ustrukturyzowane dane raportu (JSON) dla raportow walki/szpiegowskich, inaczej null
 */
public record Message(
        long id,
        long recipientId,
        Long senderId,
        String senderName,
        Type type,
        String subject,
        String body,
        String payload,
        Instant createdAt,
        boolean read,
        boolean archived
) {
    public enum Type { PRIVATE, COMBAT, ESPIONAGE, FLEET, ALLIANCE, SYSTEM }

    public Message markRead() {
        return new Message(id, recipientId, senderId, senderName, type, subject, body, payload, createdAt, true, archived);
    }

    public Message withArchived(boolean value) {
        return new Message(id, recipientId, senderId, senderName, type, subject, body, payload, createdAt, read, value);
    }
}
