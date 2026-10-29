package pl.spacepioneers.security;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

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
import java.util.Optional;

/**
 * Sesje logowania oparte o losowe tokeny. W bazie przechowywany jest tylko skrot SHA-256 tokenu,
 * wiec wyciek tabeli nie pozwala przejac sesji.
 */
@Service
public class SessionService {

    public static final Duration SESSION_TTL = Duration.ofDays(14);

    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public SessionService(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public String create(long playerId) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant now = clock.instant();
        jdbc.update("insert into sessions (token_hash, player_id, created_at, expires_at) values (?, ?, ?, ?)",
                hash(token), playerId, Timestamp.from(now), Timestamp.from(now.plus(SESSION_TTL)));
        return token;
    }

    public Optional<Long> resolve(String token) {
        if (token == null || token.isBlank() || token.length() > 100) {
            return Optional.empty();
        }
        List<Long> ids = jdbc.query("select player_id from sessions where token_hash = ? and expires_at > ?",
                (rs, n) -> rs.getLong(1), hash(token), Timestamp.from(clock.instant()));
        return ids.isEmpty() ? Optional.empty() : Optional.of(ids.get(0));
    }

    public void revoke(String token) {
        if (token != null) {
            jdbc.update("delete from sessions where token_hash = ?", hash(token));
        }
    }

    public void revokeAll(long playerId) {
        jdbc.update("delete from sessions where player_id = ?", playerId);
    }

    public void deleteExpired() {
        jdbc.update("delete from sessions where expires_at <= ?", Timestamp.from(clock.instant()));
    }

    static String hash(String token) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
