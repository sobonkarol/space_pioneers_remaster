package pl.spacepioneers.account;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;

/**
 * Tryb bez serwera SMTP: wiadomosci trafiaja do dziennika serwera. Opcjonalnie (MAIL_DEV_OUTBOX=true,
 * wylacznie srodowiska testowe) ostatnie wiadomosci sa dostepne pod /api/dev/outbox.
 */
public class LogEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(LogEmailSender.class);
    private static final int OUTBOX_SIZE = 100;

    public record OutboxMail(String to, String subject, String text, Instant at) {
    }

    private final boolean keepOutbox;
    private final Deque<OutboxMail> outbox = new ArrayDeque<>();

    public LogEmailSender(boolean keepOutbox) {
        this.keepOutbox = keepOutbox;
    }

    @Override
    public void send(String to, String subject, String text) {
        log.info("E-mail (brak SMTP) do {}: {}\n{}", to, subject, text);
        if (keepOutbox) {
            synchronized (outbox) {
                outbox.addFirst(new OutboxMail(to, subject, text, Instant.now()));
                while (outbox.size() > OUTBOX_SIZE) outbox.removeLast();
            }
        }
    }

    public boolean outboxEnabled() {
        return keepOutbox;
    }

    public List<OutboxMail> outbox() {
        synchronized (outbox) {
            return List.copyOf(outbox);
        }
    }
}
