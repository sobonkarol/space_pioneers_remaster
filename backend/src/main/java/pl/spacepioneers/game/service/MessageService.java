package pl.spacepioneers.game.service;

import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Player;

import java.util.List;

/** Skrzynka wiadomosci i wiadomosci prywatne. */
public final class MessageService extends ServiceBase {

    public static final int MAX_SUBJECT = 100;
    public static final int MAX_BODY = 5000;

    private final Mailer mailer;

    public MessageService(GameContext ctx, World world, Mailer mailer) {
        super(ctx, world);
        this.mailer = mailer;
    }

    public List<Message> inbox(long playerId, Message.Type type, int limit) {
        int l = Math.max(1, Math.min(limit, 200));
        return tx(now -> ctx.store().messagesOf(playerId, type, l));
    }

    public Message read(long playerId, long messageId) {
        return tx(now -> {
            Message m = ctx.store().message(messageId).filter(x -> x.recipientId() == playerId)
                    .orElseThrow(() -> GameException.notFound("wiadomość " + messageId));
            if (!m.read()) {
                m = m.markRead();
                ctx.store().save(m);
            }
            return m;
        });
    }

    public void markAllRead(long playerId) {
        txRun(now -> {
            for (Message m : ctx.store().messagesOf(playerId, null, Integer.MAX_VALUE)) {
                if (!m.read()) ctx.store().save(m.markRead());
            }
        });
    }

    public void delete(long playerId, long messageId) {
        txRun(now -> {
            ctx.store().message(messageId).filter(x -> x.recipientId() == playerId)
                    .orElseThrow(() -> GameException.notFound("wiadomość " + messageId));
            ctx.store().deleteMessage(messageId);
        });
    }

    public Message send(long senderId, String recipientName, String subject, String body) {
        return tx(now -> {
            Player sender = ctx.requirePlayer(senderId);
            Player recipient = ctx.store().playerByName(recipientName == null ? "" : recipientName.trim())
                    .orElseThrow(() -> new GameException(GameException.Kind.NOT_FOUND, "no_recipient", "Nie ma takiego gracza."));
            String s = clean(subject, MAX_SUBJECT);
            String b = clean(body, MAX_BODY);
            if (b.isEmpty()) {
                throw new GameException("empty_message", "Treść wiadomości jest pusta.");
            }
            return mailer.send(recipient.getId(), sender.getId(), sender.getUsername(), Message.Type.PRIVATE,
                    s.isEmpty() ? "(brak tematu)" : s, b, null, now);
        });
    }

    public int unread(long playerId) {
        return tx(now -> ctx.store().unreadCount(playerId));
    }

    static String clean(String text, int max) {
        if (text == null) return "";
        String t = text.strip();
        if (t.length() > max) {
            throw new GameException("too_long", "Tekst jest za długi (max " + max + " znaków).");
        }
        return t;
    }
}
