package pl.spacepioneers.security;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

/**
 * Ochrona przed zgadywaniem hasel: po {@link #MAX_FAILURES} nieudanych probach dla danego loginu kolejne
 * proby sa blokowane na {@link #LOCK}. Stan jest w bazie, wiec dziala po restarcie i przy wielu instancjach.
 */
@Component
public class LoginThrottle {

    public static final int MAX_FAILURES = 8;
    public static final Duration LOCK = Duration.ofMinutes(10);
    /** Seria nieudanych prob wygasa po tym czasie bez kolejnej porazki. */
    public static final Duration WINDOW = Duration.ofMinutes(30);

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public LoginThrottle(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    private static String key(String login) {
        String k = login == null ? "" : login.trim().toLowerCase(Locale.ROOT);
        return k.length() > 254 ? k.substring(0, 254) : k;
    }

    public boolean isLocked(String login) {
        List<Timestamp> until = jdbc.query("select locked_until from login_attempts where login_key = ?",
                (rs, n) -> rs.getTimestamp(1), key(login));
        return !until.isEmpty() && until.get(0) != null && until.get(0).toInstant().isAfter(clock.instant());
    }

    public void failure(String login) {
        Instant now = clock.instant();
        // atomowo: nowa seria po wygasnieciu blokady lub okna, inaczej licznik + 1; blokada po przekroczeniu progu
        jdbc.update("""
                insert into login_attempts (login_key, failures, last_failure, locked_until) values (?, 1, ?::timestamptz, null)
                on conflict (login_key) do update set
                    failures = case when (login_attempts.locked_until is not null and login_attempts.locked_until <= ?::timestamptz)
                                          or login_attempts.last_failure < ?::timestamptz
                                    then 1 else login_attempts.failures + 1 end,
                    last_failure = excluded.last_failure,
                    locked_until = case when (case when (login_attempts.locked_until is not null
                                                              and login_attempts.locked_until <= ?::timestamptz)
                                                         or login_attempts.last_failure < ?::timestamptz
                                                   then 1 else login_attempts.failures + 1 end) >= ?
                                        then ?::timestamptz else null end
                """, key(login), Timestamp.from(now), Timestamp.from(now), Timestamp.from(now.minus(WINDOW)),
                Timestamp.from(now), Timestamp.from(now.minus(WINDOW)), MAX_FAILURES, Timestamp.from(now.plus(LOCK)));
    }

    public void success(String login) {
        jdbc.update("delete from login_attempts where login_key = ?", key(login));
    }

    public void deleteExpired() {
        Instant now = clock.instant();
        jdbc.update("delete from login_attempts where (locked_until is null or locked_until <= ?) and last_failure < ?",
                Timestamp.from(now), Timestamp.from(now.minus(WINDOW)));
    }
}
