package pl.spacepioneers.game.service;

import pl.spacepioneers.game.model.Message;

import java.time.Instant;

/** Tworzenie wiadomosci systemowych i raportow. */
public final class Mailer {

    private final GameContext ctx;

    public Mailer(GameContext ctx) {
        this.ctx = ctx;
    }

    public Message send(long recipientId, Long senderId, String senderName, Message.Type type,
                        String subject, String body, String payload, Instant at) {
        Message m = new Message(ctx.store().nextId("message"), recipientId, senderId, senderName, type,
                subject, body, payload, at, false);
        ctx.store().save(m);
        return m;
    }

    public Message system(long recipientId, Message.Type type, String subject, String body, Instant at) {
        return send(recipientId, null, null, type, subject, body, null, at);
    }
}
