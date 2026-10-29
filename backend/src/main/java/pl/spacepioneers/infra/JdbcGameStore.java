package pl.spacepioneers.infra;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spacepioneers.engine.common.Coordinates;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.game.model.Alliance;
import pl.spacepioneers.game.model.AllianceApplication;
import pl.spacepioneers.game.model.AttackUnion;
import pl.spacepioneers.game.model.Buddy;
import pl.spacepioneers.game.model.BuildOrder;
import pl.spacepioneers.game.model.DebrisField;
import pl.spacepioneers.game.model.Fleet;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.Treaty;
import pl.spacepioneers.game.store.DueEvent;
import pl.spacepioneers.game.store.GameStore;
import pl.spacepioneers.game.store.Json;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;

/**
 * Magazyn stanu gry w PostgreSQL. Kazda transakcja gry zaklada blokade doradcza
 * {@code pg_advisory_xact_lock}, co serializuje zmiany stanu swiata (rowniez miedzy instancjami).
 */
public class JdbcGameStore implements GameStore {

    private static final long GAME_LOCK = 0x5350_4C4F_434BL; // "SPLOCK"
    private static final Set<String> SEQUENCES = Set.of("player", "planet", "fleet", "message", "alliance",
            "application", "treaty", "build", "shipyard", "union", "buddy");

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;

    public JdbcGameStore(JdbcTemplate jdbc, PlatformTransactionManager txManager) {
        this.jdbc = jdbc;
        this.tx = new TransactionTemplate(txManager);
    }

    @Override
    public <T> T inTransaction(Supplier<T> work) {
        return tx.execute(status -> {
            jdbc.query("select pg_advisory_xact_lock(?)", rs -> null, GAME_LOCK);
            return work.get();
        });
    }

    @Override
    public long nextId(String sequence) {
        if (!SEQUENCES.contains(sequence)) {
            throw new IllegalArgumentException("Nieznana sekwencja: " + sequence);
        }
        Long v = jdbc.queryForObject("select nextval('" + sequence + "_seq')", Long.class);
        return v == null ? 0 : v;
    }

    private static Timestamp ts(Instant i) {
        return i == null ? null : Timestamp.from(i);
    }

    private static <T> RowMapper<T> data(Class<T> type) {
        return (rs, n) -> Json.read(rs.getString("data"), type);
    }

    private static <T> Optional<T> first(List<T> list) {
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    // --- gracze

    @Override
    public Optional<Player> player(long id) {
        return first(jdbc.query("select data from players where id = ?", data(Player.class), id));
    }

    @Override
    public Optional<Player> playerByName(String username) {
        return first(jdbc.query("select data from players where lower(username) = lower(?)", data(Player.class), username));
    }

    @Override
    public Optional<Player> playerByEmail(String email) {
        return first(jdbc.query("select data from players where lower(email) = lower(?)", data(Player.class), email));
    }

    @Override
    public List<Player> players() {
        return jdbc.query("select data from players order by id", data(Player.class));
    }

    @Override
    public List<Player> playersOfAlliance(long allianceId) {
        return jdbc.query("select data from players where alliance_id = ? order by id", data(Player.class), allianceId);
    }

    @Override
    public void save(Player p) {
        jdbc.update("""
                insert into players (id, username, email, alliance_id, research_end, score_total, last_activity, data)
                values (?, ?, ?, ?, ?, ?, ?, ?::jsonb)
                on conflict (id) do update set username = excluded.username, email = excluded.email,
                    alliance_id = excluded.alliance_id, research_end = excluded.research_end,
                    score_total = excluded.score_total, last_activity = excluded.last_activity, data = excluded.data
                """,
                p.getId(), p.getUsername(), p.getEmail(), p.getAllianceId(),
                ts(p.getResearchJob() == null ? null : p.getResearchJob().end()),
                p.getScore().total(), ts(p.getLastActivity()), Json.write(p));
    }

    // --- planety

    @Override
    public Optional<Planet> planet(long id) {
        return first(jdbc.query("select data from planets where id = ?", data(Planet.class), id));
    }

    @Override
    public Optional<Planet> planetAt(Coordinates c) {
        return first(jdbc.query("select data from planets where galaxy = ? and system = ? and position = ? and not is_moon",
                data(Planet.class), c.galaxy(), c.system(), c.position()));
    }

    @Override
    public Optional<Planet> moonAt(Coordinates c) {
        return first(jdbc.query("select data from planets where galaxy = ? and system = ? and position = ? and is_moon",
                data(Planet.class), c.galaxy(), c.system(), c.position()));
    }

    @Override
    public List<Planet> moonsInSystem(int galaxy, int system) {
        return jdbc.query("select data from planets where galaxy = ? and system = ? and is_moon order by position",
                data(Planet.class), galaxy, system);
    }

    @Override
    public List<Planet> planetsOf(long ownerId) {
        return jdbc.query("select data from planets where owner_id = ? order by id", data(Planet.class), ownerId);
    }

    @Override
    public List<Planet> planetsInSystem(int galaxy, int system) {
        return jdbc.query("select data from planets where galaxy = ? and system = ? and not is_moon order by position",
                data(Planet.class), galaxy, system);
    }

    @Override
    public List<Planet> allPlanets() {
        return jdbc.query("select data from planets order by id", data(Planet.class));
    }

    @Override
    public void save(Planet p) {
        BuildOrder active = p.activeBuild();
        jdbc.update("""
                insert into planets (id, owner_id, galaxy, system, position, is_moon, build_end, data)
                values (?, ?, ?, ?, ?, ?, ?, ?::jsonb)
                on conflict (id) do update set owner_id = excluded.owner_id, galaxy = excluded.galaxy,
                    system = excluded.system, position = excluded.position, is_moon = excluded.is_moon,
                    build_end = excluded.build_end, data = excluded.data
                """,
                p.getId(), p.getOwnerId(), p.getGalaxy(), p.getSystem(), p.getPosition(), p.isMoon(),
                ts(active == null ? null : active.end()), Json.write(p));
    }

    @Override
    public void deletePlanet(long id) {
        jdbc.update("delete from planets where id = ?", id);
    }

    // --- floty

    @Override
    public Optional<Fleet> fleet(long id) {
        return first(jdbc.query("select data from fleets where id = ?", data(Fleet.class), id));
    }

    @Override
    public List<Fleet> fleetsOf(long ownerId) {
        return jdbc.query("select data from fleets where owner_id = ? order by next_event_at, id", data(Fleet.class), ownerId);
    }

    @Override
    public List<Fleet> fleetsTargeting(long playerId) {
        return jdbc.query("""
                select data from fleets where target_owner_id = ? and owner_id <> ? and status in ('OUTBOUND', 'HOLDING')
                order by next_event_at, id
                """, data(Fleet.class), playerId, playerId);
    }

    @Override
    public List<Fleet> allFleets() {
        return jdbc.query("select data from fleets order by id", data(Fleet.class));
    }

    @Override
    public void save(Fleet f) {
        jdbc.update("""
                insert into fleets (id, owner_id, origin_planet_id, target_owner_id, target_galaxy, target_system,
                    target_position, status, next_event_at, union_id, target_moon, origin_galaxy, origin_system,
                    origin_position, data)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
                on conflict (id) do update set target_owner_id = excluded.target_owner_id, status = excluded.status,
                    next_event_at = excluded.next_event_at, union_id = excluded.union_id, data = excluded.data
                """,
                f.getId(), f.getOwnerId(), f.getOriginPlanetId(), f.getTargetOwnerId(),
                f.getTarget().galaxy(), f.getTarget().system(), f.getTarget().position(),
                f.getStatus().name(), ts(f.nextEventAt()), f.getUnionId(), f.isTargetMoon(),
                f.getOrigin().galaxy(), f.getOrigin().system(), f.getOrigin().position(), Json.write(f));
    }

    @Override
    public List<Fleet> fleetsInUnion(long unionId) {
        return jdbc.query("select data from fleets where union_id = ? order by id", data(Fleet.class), unionId);
    }

    @Override
    public List<Fleet> fleetsHoldingAt(Coordinates c, boolean moon) {
        return jdbc.query("""
                select data from fleets where status = 'HOLDING' and data ->> 'mission' = 'HOLD'
                  and target_galaxy = ? and target_system = ? and target_position = ? and target_moon = ? order by id
                """, data(Fleet.class), c.galaxy(), c.system(), c.position(), moon);
    }

    @Override
    public List<Fleet> fleetsAround(Coordinates c) {
        return jdbc.query("""
                select data from fleets where (origin_galaxy = ? and origin_system = ? and origin_position = ?)
                  or (target_galaxy = ? and target_system = ? and target_position = ? and not target_moon)
                order by next_event_at, id
                """, data(Fleet.class), c.galaxy(), c.system(), c.position(), c.galaxy(), c.system(), c.position());
    }

    @Override
    public Optional<AttackUnion> union(long id) {
        return first(jdbc.query("select data from attack_unions where id = ?", data(AttackUnion.class), id));
    }

    @Override
    public List<AttackUnion> unions() {
        return jdbc.query("select data from attack_unions order by id", data(AttackUnion.class));
    }

    @Override
    public void save(AttackUnion u) {
        jdbc.update("""
                insert into attack_unions (id, data) values (?, ?::jsonb)
                on conflict (id) do update set data = excluded.data
                """, u.id(), Json.write(u));
    }

    @Override
    public void deleteUnion(long id) {
        jdbc.update("delete from attack_unions where id = ?", id);
    }

    @Override
    public void deleteFleet(long id) {
        jdbc.update("delete from fleets where id = ?", id);
    }

    // --- pola zniszczen

    private static final RowMapper<DebrisField> DEBRIS = (rs, n) -> new DebrisField(
            new Coordinates(rs.getInt("galaxy"), rs.getInt("system"), rs.getInt("position")),
            Resources.of(rs.getDouble("metal"), rs.getDouble("crystal"), 0));

    @Override
    public Optional<DebrisField> debris(Coordinates c) {
        return first(jdbc.query("select * from debris_fields where galaxy = ? and system = ? and position = ?",
                DEBRIS, c.galaxy(), c.system(), c.position()));
    }

    @Override
    public List<DebrisField> debrisInSystem(int galaxy, int system) {
        return jdbc.query("select * from debris_fields where galaxy = ? and system = ? order by position",
                DEBRIS, galaxy, system);
    }

    @Override
    public void save(DebrisField d) {
        Coordinates c = d.coordinates();
        jdbc.update("""
                insert into debris_fields (galaxy, system, position, metal, crystal) values (?, ?, ?, ?, ?)
                on conflict (galaxy, system, position) do update set metal = excluded.metal, crystal = excluded.crystal
                """, c.galaxy(), c.system(), c.position(), d.resources().metal(), d.resources().crystal());
    }

    @Override
    public void deleteDebris(Coordinates c) {
        jdbc.update("delete from debris_fields where galaxy = ? and system = ? and position = ?",
                c.galaxy(), c.system(), c.position());
    }

    // --- wiadomosci

    private static final RowMapper<Message> MESSAGE = (rs, n) -> new Message(
            rs.getLong("id"), rs.getLong("recipient_id"),
            rs.getObject("sender_id") == null ? null : rs.getLong("sender_id"),
            rs.getString("sender_name"), Message.Type.valueOf(rs.getString("type")),
            rs.getString("subject"), rs.getString("body"), rs.getString("payload"),
            rs.getTimestamp("created_at").toInstant(), rs.getBoolean("is_read"));

    @Override
    public Optional<Message> message(long id) {
        return first(jdbc.query("select * from messages where id = ?", MESSAGE, id));
    }

    @Override
    public List<Message> messagesOf(long playerId, Message.Type type, int limit) {
        if (type == null) {
            return jdbc.query("select * from messages where recipient_id = ? order by created_at desc, id desc limit ?",
                    MESSAGE, playerId, limit);
        }
        return jdbc.query("""
                select * from messages where recipient_id = ? and type = ? order by created_at desc, id desc limit ?
                """, MESSAGE, playerId, type.name(), limit);
    }

    @Override
    public int unreadCount(long playerId) {
        Integer n = jdbc.queryForObject("select count(*) from messages where recipient_id = ? and not is_read",
                Integer.class, playerId);
        return n == null ? 0 : n;
    }

    @Override
    public void save(Message m) {
        jdbc.update("""
                insert into messages (id, recipient_id, sender_id, sender_name, type, subject, body, payload, created_at, is_read)
                values (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)
                on conflict (id) do update set is_read = excluded.is_read
                """, m.id(), m.recipientId(), m.senderId(), m.senderName(), m.type().name(), m.subject(), m.body(),
                m.payload(), ts(m.createdAt()), m.read());
    }

    @Override
    public void deleteMessage(long id) {
        jdbc.update("delete from messages where id = ?", id);
    }

    // --- sojusze

    @Override
    public Optional<Alliance> alliance(long id) {
        return first(jdbc.query("select data from alliances where id = ?", data(Alliance.class), id));
    }

    @Override
    public Optional<Alliance> allianceByTag(String tag) {
        return first(jdbc.query("select data from alliances where lower(tag) = lower(?)", data(Alliance.class), tag));
    }

    @Override
    public List<Alliance> alliances() {
        return jdbc.query("select data from alliances order by id", data(Alliance.class));
    }

    @Override
    public void save(Alliance a) {
        jdbc.update("""
                insert into alliances (id, tag, data) values (?, ?, ?::jsonb)
                on conflict (id) do update set tag = excluded.tag, data = excluded.data
                """, a.getId(), a.getTag(), Json.write(a));
    }

    @Override
    public void deleteAlliance(long id) {
        jdbc.update("delete from alliances where id = ?", id);
    }

    private static final RowMapper<AllianceApplication> APPLICATION = (rs, n) -> new AllianceApplication(
            rs.getLong("id"), rs.getLong("alliance_id"), rs.getLong("player_id"), rs.getString("text"),
            rs.getTimestamp("created_at").toInstant());

    @Override
    public Optional<AllianceApplication> application(long id) {
        return first(jdbc.query("select * from alliance_applications where id = ?", APPLICATION, id));
    }

    @Override
    public Optional<AllianceApplication> applicationOf(long playerId) {
        return first(jdbc.query("select * from alliance_applications where player_id = ?", APPLICATION, playerId));
    }

    @Override
    public List<AllianceApplication> applications(long allianceId) {
        return jdbc.query("select * from alliance_applications where alliance_id = ? order by id", APPLICATION, allianceId);
    }

    @Override
    public void save(AllianceApplication a) {
        jdbc.update("""
                insert into alliance_applications (id, alliance_id, player_id, text, created_at) values (?, ?, ?, ?, ?)
                on conflict (id) do update set text = excluded.text
                """, a.id(), a.allianceId(), a.playerId(), a.text(), ts(a.createdAt()));
    }

    @Override
    public void deleteApplication(long id) {
        jdbc.update("delete from alliance_applications where id = ?", id);
    }

    private static final RowMapper<Treaty> TREATY = (rs, n) -> new Treaty(rs.getLong("id"), rs.getLong("alliance_a"),
            rs.getLong("alliance_b"), Treaty.Type.valueOf(rs.getString("type")),
            Treaty.Status.valueOf(rs.getString("status")), rs.getLong("proposed_by"),
            rs.getTimestamp("created_at").toInstant());

    @Override
    public Optional<Treaty> treaty(long id) {
        return first(jdbc.query("select * from treaties where id = ?", TREATY, id));
    }

    @Override
    public List<Treaty> treaties(long allianceId) {
        return jdbc.query("select * from treaties where alliance_a = ? or alliance_b = ? order by id",
                TREATY, allianceId, allianceId);
    }

    @Override
    public void save(Treaty t) {
        jdbc.update("""
                insert into treaties (id, alliance_a, alliance_b, type, status, proposed_by, created_at)
                values (?, ?, ?, ?, ?, ?, ?)
                on conflict (id) do update set type = excluded.type, status = excluded.status
                """, t.id(), t.allianceA(), t.allianceB(), t.type().name(), t.status().name(), t.proposedBy(),
                ts(t.createdAt()));
    }

    @Override
    public void deleteTreaty(long id) {
        jdbc.update("delete from treaties where id = ?", id);
    }

    // --- znajomi

    private static final RowMapper<Buddy> BUDDY = (rs, n) -> new Buddy(rs.getLong("id"), rs.getLong("requester_id"),
            rs.getLong("addressee_id"), Buddy.Status.valueOf(rs.getString("status")), rs.getString("text"),
            rs.getTimestamp("created_at").toInstant());

    @Override
    public Optional<Buddy> buddy(long id) {
        return first(jdbc.query("select * from buddies where id = ?", BUDDY, id));
    }

    @Override
    public List<Buddy> buddiesOf(long playerId) {
        return jdbc.query("select * from buddies where requester_id = ? or addressee_id = ? order by id",
                BUDDY, playerId, playerId);
    }

    @Override
    public void save(Buddy b) {
        jdbc.update("""
                insert into buddies (id, requester_id, addressee_id, status, text, created_at) values (?, ?, ?, ?, ?, ?)
                on conflict (id) do update set status = excluded.status
                """, b.id(), b.requesterId(), b.addresseeId(), b.status().name(), b.text(), ts(b.createdAt()));
    }

    @Override
    public void deleteBuddy(long id) {
        jdbc.update("delete from buddies where id = ?", id);
    }

    // --- zdarzenia

    private static final Map<Integer, DueEvent.Type> EVENT_TYPES = Map.of(
            0, DueEvent.Type.BUILDING, 1, DueEvent.Type.RESEARCH, 2, DueEvent.Type.FLEET);

    @Override
    public Optional<DueEvent> nextDueEvent(Instant until) {
        Timestamp t = ts(until);
        return first(jdbc.query("""
                select kind, id, at from (
                    select 0 as kind, id, build_end as at from planets where build_end <= ?
                    union all
                    select 1, id, research_end from players where research_end <= ?
                    union all
                    select 2, id, next_event_at from fleets where next_event_at <= ?
                ) e order by at, kind, id limit 1
                """, (rs, n) -> new DueEvent(EVENT_TYPES.get(rs.getInt("kind")), rs.getLong("id"),
                rs.getTimestamp("at").toInstant()), t, t, t));
    }
}
