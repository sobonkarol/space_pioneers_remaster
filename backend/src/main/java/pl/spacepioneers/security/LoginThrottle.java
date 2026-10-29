package pl.spacepioneers.security;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Prosta ochrona przed zgadywaniem hasel: po {@link #MAX_FAILURES} nieudanych probach dla danego loginu
 * kolejne proby sa blokowane na {@link #LOCK}. Stan trzymany w pamieci instancji.
 */
@Component
public class LoginThrottle {

    public static final int MAX_FAILURES = 8;
    public static final Duration LOCK = Duration.ofMinutes(10);

    private record Entry(int failures, Instant lockedUntil) {
    }

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();
    private final Clock clock;

    public LoginThrottle(Clock clock) {
        this.clock = clock;
    }

    private static String key(String login) {
        return login == null ? "" : login.trim().toLowerCase(Locale.ROOT);
    }

    public boolean isLocked(String login) {
        Entry e = entries.get(key(login));
        return e != null && e.lockedUntil() != null && e.lockedUntil().isAfter(clock.instant());
    }

    public void failure(String login) {
        entries.compute(key(login), (k, e) -> {
            int n = e == null || (e.lockedUntil() != null && !e.lockedUntil().isAfter(clock.instant())) ? 1 : e.failures() + 1;
            return new Entry(n, n >= MAX_FAILURES ? clock.instant().plus(LOCK) : null);
        });
    }

    public void success(String login) {
        entries.remove(key(login));
    }
}
