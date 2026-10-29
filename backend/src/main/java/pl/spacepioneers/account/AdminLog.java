package pl.spacepioneers.account;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.List;

/** Dziennik dzialan administratorow; wpisy BAN tworza tez publiczny pregierz. */
@Service
public class AdminLog {

    public record Entry(long id, Instant at, String adminName, String action, Long targetId, String targetName,
                        String details, Instant until) {
    }

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public AdminLog(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public void add(String adminName, String action, Long targetId, String targetName, String details, Instant until) {
        jdbc.update("""
                insert into admin_log (at, admin_name, action, target_id, target_name, details, until)
                values (?, ?, ?, ?, ?, ?, ?)
                """, Timestamp.from(clock.instant()), adminName, action, targetId, targetName, details,
                until == null ? null : Timestamp.from(until));
    }

    public List<Entry> recent(int limit) {
        return jdbc.query("select * from admin_log order by id desc limit ?", (rs, n) -> map(rs), limit);
    }

    /** Pregierz: blokady wraz z powodem i terminem. */
    public List<Entry> pillory(int limit) {
        return jdbc.query("select * from admin_log where action = 'BAN' order by id desc limit ?", (rs, n) -> map(rs), limit);
    }

    private static Entry map(java.sql.ResultSet rs) throws java.sql.SQLException {
        Timestamp until = rs.getTimestamp("until");
        long target = rs.getLong("target_id");
        return new Entry(rs.getLong("id"), rs.getTimestamp("at").toInstant(), rs.getString("admin_name"),
                rs.getString("action"), rs.wasNull() ? null : target, rs.getString("target_name"),
                rs.getString("details"), until == null ? null : until.toInstant());
    }
}
