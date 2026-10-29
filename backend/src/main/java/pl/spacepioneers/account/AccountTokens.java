package pl.spacepioneers.account;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spacepioneers.game.GameException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;

/**
 * Jednorazowe tokeny z linkow e-mail (potwierdzenie adresu, reset hasla). W bazie trzymany jest tylko skrot
 * SHA-256; token wygasa i znika po uzyciu, a nowy token tego samego rodzaju uniewaznia poprzednie.
 */
@Service
public class AccountTokens {

    public enum Purpose {
        VERIFY_EMAIL(Duration.ofDays(3)),
        RESET_PASSWORD(Duration.ofHours(1));

        final Duration ttl;

        Purpose(Duration ttl) {
            this.ttl = ttl;
        }
    }

    /** Ile tokenow jednego rodzaju mozna wydac graczowi w ciagu godziny (ochrona przed zasypaniem skrzynki). */
    public static final int MAX_PER_HOUR = 3;

    public record Redeemed(long playerId, String email) {
    }

    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public AccountTokens(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional
    public String issue(long playerId, String email, Purpose purpose) {
        Instant now = clock.instant();
        Integer recent = jdbc.queryForObject("""
                select count(*) from account_token_log where player_id = ? and purpose = ? and created_at > ?
                """, Integer.class, playerId, purpose.name(), Timestamp.from(now.minus(Duration.ofHours(1))));
        if (recent != null && recent >= MAX_PER_HOUR) {
            throw new GameException("too_many_requests", "Wysłano już kilka wiadomości. Spróbuj ponownie za godzinę.");
        }
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        jdbc.update("delete from account_tokens where player_id = ? and purpose = ?", playerId, purpose.name());
        jdbc.update("""
                insert into account_tokens (token_hash, player_id, purpose, email, created_at, expires_at)
                values (?, ?, ?, ?, ?, ?)
                """, hash(token), playerId, purpose.name(), email, Timestamp.from(now), Timestamp.from(now.plus(purpose.ttl)));
        jdbc.update("insert into account_token_log (player_id, purpose, created_at) values (?, ?, ?)",
                playerId, purpose.name(), Timestamp.from(now));
        return token;
    }

    /** Zuzywa token. Rzuca wyjatek, gdy token nie istnieje, wygasl albo jest innego rodzaju. */
    @Transactional
    public Redeemed redeem(String token, Purpose purpose) {
        if (token == null || token.isBlank() || token.length() > 100) {
            throw invalid();
        }
        List<Redeemed> found = jdbc.query("""
                delete from account_tokens where token_hash = ? and purpose = ? and expires_at > ?
                returning player_id, email
                """, (rs, n) -> new Redeemed(rs.getLong(1), rs.getString(2)), hash(token), purpose.name(),
                Timestamp.from(clock.instant()));
        if (found.isEmpty()) {
            throw invalid();
        }
        return found.get(0);
    }

    public void deleteExpired() {
        Instant now = clock.instant();
        jdbc.update("delete from account_tokens where expires_at <= ?", Timestamp.from(now));
        jdbc.update("delete from account_token_log where created_at <= ?", Timestamp.from(now.minus(Duration.ofDays(1))));
    }

    private static GameException invalid() {
        return new GameException("token_invalid", "Link jest nieprawidłowy albo wygasł.");
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
