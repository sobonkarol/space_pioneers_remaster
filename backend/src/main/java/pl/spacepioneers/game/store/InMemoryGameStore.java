package pl.spacepioneers.game.store;

import pl.spacepioneers.engine.common.Coordinates;
import pl.spacepioneers.game.model.Alliance;
import pl.spacepioneers.game.model.AllianceApplication;
import pl.spacepioneers.game.model.AttackUnion;
import pl.spacepioneers.game.model.Buddy;
import pl.spacepioneers.game.model.BuildOrder;
import pl.spacepioneers.game.model.DebrisField;
import pl.spacepioneers.game.model.Fleet;
import pl.spacepioneers.game.model.ForumPost;
import pl.spacepioneers.game.model.ForumThread;
import pl.spacepioneers.game.model.Note;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.Treaty;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

/**
 * Magazyn w pamieci (testy i tryb deweloperski). Przechowuje i zwraca gleboke kopie,
 * dzieki czemu zachowuje sie jak baza danych - zmiany bez {@code save} sa tracone.
 * Transakcja: wylacznosc przez blokade + wycofanie zmian przy wyjatku (migawka stanu).
 */
public class InMemoryGameStore implements GameStore {

    private final ReentrantLock lock = new ReentrantLock();
    private State state = new State();

    /** Caly stan; kopiowany przy starcie transakcji, aby umozliwic wycofanie. */
    private static final class State {
        Map<String, Long> sequences = new HashMap<>();
        Map<Long, Player> players = new TreeMap<>();
        Map<Long, Planet> planets = new TreeMap<>();
        Map<Long, Fleet> fleets = new TreeMap<>();
        Map<String, DebrisField> debris = new TreeMap<>();
        Map<Long, Message> messages = new TreeMap<>();
        Map<Long, Alliance> alliances = new TreeMap<>();
        Map<Long, AllianceApplication> applications = new TreeMap<>();
        Map<Long, Treaty> treaties = new TreeMap<>();
        Map<Long, AttackUnion> unions = new TreeMap<>();
        Map<Long, Buddy> buddies = new TreeMap<>();
        Map<Long, Note> notes = new TreeMap<>();
        Map<Long, ForumThread> threads = new TreeMap<>();
        Map<Long, ForumPost> posts = new TreeMap<>();

        State copy() {
            State s = new State();
            s.sequences = new HashMap<>(sequences);
            s.players = new TreeMap<>(players);
            s.planets = new TreeMap<>(planets);
            s.fleets = new TreeMap<>(fleets);
            s.debris = new TreeMap<>(debris);
            s.messages = new TreeMap<>(messages);
            s.alliances = new TreeMap<>(alliances);
            s.applications = new TreeMap<>(applications);
            s.treaties = new TreeMap<>(treaties);
            s.unions = new TreeMap<>(unions);
            s.buddies = new TreeMap<>(buddies);
            s.notes = new TreeMap<>(notes);
            s.threads = new TreeMap<>(threads);
            s.posts = new TreeMap<>(posts);
            return s;
        }
    }

    @Override
    public <T> T inTransaction(Supplier<T> work) {
        lock.lock();
        boolean outer = lock.getHoldCount() == 1;
        State snapshot = outer ? state.copy() : null;
        try {
            return work.get();
        } catch (RuntimeException e) {
            if (outer) state = snapshot;
            throw e;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public long nextId(String sequence) {
        lock.lock();
        try {
            long v = state.sequences.getOrDefault(sequence, 0L) + 1;
            state.sequences.put(sequence, v);
            return v;
        } finally {
            lock.unlock();
        }
    }

    private static <T> T c(T v) {
        return Json.copy(v);
    }

    private static <T> Optional<T> co(T v) {
        return Optional.ofNullable(c(v));
    }

    private static String key(Coordinates c) {
        return String.format("%03d:%05d:%03d", c.galaxy(), c.system(), c.position());
    }

    // --- gracze
    @Override
    public Optional<Player> player(long id) {
        return co(state.players.get(id));
    }

    @Override
    public Optional<Player> playerByName(String username) {
        return state.players.values().stream().filter(p -> p.getUsername().equalsIgnoreCase(username)).findFirst().map(Json::copy);
    }

    @Override
    public Optional<Player> playerByEmail(String email) {
        return state.players.values().stream().filter(p -> p.getEmail().equalsIgnoreCase(email)).findFirst().map(Json::copy);
    }

    @Override
    public List<Player> players() {
        return state.players.values().stream().map(Json::copy).toList();
    }

    @Override
    public List<Player> playersOfAlliance(long allianceId) {
        return state.players.values().stream().filter(p -> p.getAllianceId() != null && p.getAllianceId() == allianceId)
                .map(Json::copy).toList();
    }

    @Override
    public void save(Player player) {
        state.players.put(player.getId(), c(player));
    }

    // --- planety
    @Override
    public Optional<Planet> planet(long id) {
        return co(state.planets.get(id));
    }

    @Override
    public Optional<Planet> planetAt(Coordinates coordinates) {
        return state.planets.values().stream().filter(p -> !p.isMoon() && p.coordinates().equals(coordinates)).findFirst().map(Json::copy);
    }

    @Override
    public Optional<Planet> moonAt(Coordinates coordinates) {
        return state.planets.values().stream().filter(p -> p.isMoon() && p.coordinates().equals(coordinates)).findFirst().map(Json::copy);
    }

    @Override
    public List<Planet> moonsInSystem(int galaxy, int system) {
        return state.planets.values().stream().filter(p -> p.isMoon() && p.getGalaxy() == galaxy && p.getSystem() == system)
                .sorted(Comparator.comparingInt(Planet::getPosition)).map(Json::copy).toList();
    }

    @Override
    public List<Planet> planetsOf(long ownerId) {
        return state.planets.values().stream().filter(p -> p.getOwnerId() == ownerId).map(Json::copy).toList();
    }

    @Override
    public List<Planet> planetsInSystem(int galaxy, int system) {
        return state.planets.values().stream().filter(p -> !p.isMoon() && p.getGalaxy() == galaxy && p.getSystem() == system)
                .sorted(Comparator.comparingInt(Planet::getPosition)).map(Json::copy).toList();
    }

    @Override
    public List<Planet> allPlanets() {
        return state.planets.values().stream().map(Json::copy).toList();
    }

    @Override
    public void save(Planet planet) {
        state.planets.put(planet.getId(), c(planet));
    }

    @Override
    public List<Player> searchPlayers(String fragment, int limit) {
        String f = fragment.toLowerCase(java.util.Locale.ROOT);
        return state.players.values().stream().filter(p -> p.getUsername().toLowerCase(java.util.Locale.ROOT).contains(f))
                .sorted(Comparator.comparing(Player::getUsername, String.CASE_INSENSITIVE_ORDER))
                .limit(limit).map(Json::copy).toList();
    }

    @Override
    public List<Alliance> searchAlliances(String fragment, int limit) {
        String f = fragment.toLowerCase(java.util.Locale.ROOT);
        return state.alliances.values().stream()
                .filter(a -> a.getTag().toLowerCase(java.util.Locale.ROOT).contains(f)
                        || a.getName().toLowerCase(java.util.Locale.ROOT).contains(f))
                .sorted(Comparator.comparing(Alliance::getTag, String.CASE_INSENSITIVE_ORDER))
                .limit(limit).map(Json::copy).toList();
    }

    @Override
    public List<Planet> searchPlanets(String fragment, int limit) {
        String f = fragment.toLowerCase(java.util.Locale.ROOT);
        return state.planets.values().stream().filter(p -> p.getName().toLowerCase(java.util.Locale.ROOT).contains(f))
                .sorted(Comparator.comparing(Planet::getName, String.CASE_INSENSITIVE_ORDER).thenComparingLong(Planet::getId))
                .limit(limit).map(Json::copy).toList();
    }

    @Override
    public int playerCount() {
        return state.players.size();
    }

    @Override
    public List<Player> playersByScore(String category, int offset, int limit) {
        java.util.function.ToDoubleFunction<Player> metric = pl -> scoreOf(pl.getScore(), category);
        return state.players.values().stream()
                .sorted(Comparator.comparingDouble(metric).reversed().thenComparingLong(Player::getId))
                .skip(offset).limit(limit).map(Json::copy).toList();
    }

    static double scoreOf(pl.spacepioneers.game.model.Score s, String category) {
        return switch (category == null ? "total" : category) {
            case "buildings" -> s.buildings();
            case "research" -> s.research();
            case "fleet" -> s.fleet();
            case "defense" -> s.defense();
            default -> s.total();
        };
    }

    @Override
    public void deletePlayer(long id) {
        state.players.remove(id);
        state.messages.values().removeIf(m -> m.recipientId() == id);
        state.notes.values().removeIf(n -> n.ownerId() == id);
        state.planets.values().removeIf(p -> p.getOwnerId() == id);
        state.fleets.values().removeIf(f -> f.getOwnerId() == id);
        state.buddies.values().removeIf(b -> b.requesterId() == id || b.addresseeId() == id);
        state.applications.values().removeIf(a -> a.playerId() == id);
    }

    @Override
    public void deletePlanet(long id) {
        state.planets.remove(id);
    }

    // --- floty
    @Override
    public Optional<Fleet> fleet(long id) {
        return co(state.fleets.get(id));
    }

    @Override
    public List<Fleet> fleetsOf(long ownerId) {
        return state.fleets.values().stream().filter(f -> f.getOwnerId() == ownerId).map(Json::copy).toList();
    }

    @Override
    public List<Fleet> fleetsTargeting(long playerId) {
        return state.fleets.values().stream()
                .filter(f -> f.getTargetOwnerId() != null && f.getTargetOwnerId() == playerId
                        && f.getOwnerId() != playerId && f.getStatus() != Fleet.Status.RETURNING)
                .map(Json::copy).toList();
    }

    @Override
    public List<Fleet> allFleets() {
        return state.fleets.values().stream().map(Json::copy).toList();
    }

    @Override
    public List<Fleet> fleetsInUnion(long unionId) {
        return state.fleets.values().stream().filter(f -> f.getUnionId() != null && f.getUnionId() == unionId)
                .map(Json::copy).toList();
    }

    @Override
    public List<Fleet> fleetsHoldingAt(Coordinates coordinates, boolean moon) {
        return state.fleets.values().stream()
                .filter(f -> f.getStatus() == Fleet.Status.HOLDING && f.getMission() == Fleet.Mission.HOLD
                        && f.getTarget().equals(coordinates) && f.isTargetMoon() == moon)
                .map(Json::copy).toList();
    }

    @Override
    public List<Fleet> fleetsAround(Coordinates coordinates) {
        return state.fleets.values().stream()
                .filter(f -> f.getOrigin().equals(coordinates) || (f.getTarget().equals(coordinates) && !f.isTargetMoon()))
                .map(Json::copy).toList();
    }

    @Override
    public Optional<AttackUnion> union(long id) {
        return Optional.ofNullable(state.unions.get(id));
    }

    @Override
    public List<AttackUnion> unions() {
        return List.copyOf(state.unions.values());
    }

    @Override
    public void save(AttackUnion union) {
        state.unions.put(union.id(), union);
    }

    @Override
    public void deleteUnion(long id) {
        state.unions.remove(id);
    }

    @Override
    public void save(Fleet fleet) {
        state.fleets.put(fleet.getId(), c(fleet));
    }

    @Override
    public void deleteFleet(long id) {
        state.fleets.remove(id);
    }

    // --- pola zniszczen
    @Override
    public Optional<DebrisField> debris(Coordinates coordinates) {
        return co(state.debris.get(key(coordinates)));
    }

    @Override
    public List<DebrisField> debrisInSystem(int galaxy, int system) {
        return state.debris.values().stream()
                .filter(d -> d.coordinates().galaxy() == galaxy && d.coordinates().system() == system)
                .map(Json::copy).toList();
    }

    @Override
    public void save(DebrisField debris) {
        state.debris.put(key(debris.coordinates()), c(debris));
    }

    @Override
    public void deleteDebris(Coordinates coordinates) {
        state.debris.remove(key(coordinates));
    }

    // --- wiadomosci
    @Override
    public Optional<Message> message(long id) {
        return co(state.messages.get(id));
    }

    @Override
    public List<Message> messagesOf(long playerId, Message.Type type, int limit) {
        return state.messages.values().stream()
                .filter(m -> m.recipientId() == playerId && (type == null || m.type() == type))
                .sorted(Comparator.comparing(Message::createdAt).thenComparingLong(Message::id).reversed())
                .limit(limit).map(Json::copy).toList();
    }

    @Override
    public int unreadCount(long playerId) {
        return (int) state.messages.values().stream().filter(m -> m.recipientId() == playerId && !m.read()).count();
    }

    @Override
    public void save(Message message) {
        state.messages.put(message.id(), c(message));
    }

    @Override
    public void deleteMessage(long id) {
        state.messages.remove(id);
    }

    @Override
    public List<Message> archivedMessages(long playerId, int limit) {
        return state.messages.values().stream().filter(m -> m.recipientId() == playerId && m.archived())
                .sorted(Comparator.comparing(Message::createdAt).thenComparingLong(Message::id).reversed())
                .limit(limit).map(Json::copy).toList();
    }

    @Override
    public int archivedCount(long playerId) {
        return (int) state.messages.values().stream().filter(m -> m.recipientId() == playerId && m.archived()).count();
    }

    @Override
    public int purgeMessages(java.time.Instant readBefore, java.time.Instant anyBefore) {
        int before = state.messages.size();
        state.messages.values().removeIf(m -> !m.archived()
                && ((m.read() && m.createdAt().isBefore(readBefore)) || m.createdAt().isBefore(anyBefore)));
        return before - state.messages.size();
    }

    // --- notatki
    @Override
    public Optional<Note> note(long id) {
        return co(state.notes.get(id));
    }

    @Override
    public List<Note> notesOf(long ownerId) {
        return state.notes.values().stream().filter(n -> n.ownerId() == ownerId)
                .sorted(Comparator.comparingInt(Note::priority).reversed().thenComparing(Comparator.comparing(Note::updatedAt).reversed()))
                .map(Json::copy).toList();
    }

    @Override
    public void save(Note note) {
        state.notes.put(note.id(), c(note));
    }

    @Override
    public void deleteNote(long id) {
        state.notes.remove(id);
    }

    // --- forum
    @Override
    public Optional<ForumThread> thread(long id) {
        return co(state.threads.get(id));
    }

    @Override
    public List<ForumThread> threads(long allianceId) {
        return state.threads.values().stream().filter(t -> t.allianceId() == allianceId)
                .sorted(Comparator.comparing(ForumThread::pinned).reversed()
                        .thenComparing(Comparator.comparing(ForumThread::lastPostAt).reversed())
                        .thenComparing(Comparator.comparingLong(ForumThread::id).reversed()))
                .map(Json::copy).toList();
    }

    @Override
    public void save(ForumThread thread) {
        state.threads.put(thread.id(), c(thread));
    }

    @Override
    public void deleteThread(long id) {
        state.threads.remove(id);
        state.posts.values().removeIf(p -> p.threadId() == id);
    }

    @Override
    public Optional<ForumPost> post(long id) {
        return co(state.posts.get(id));
    }

    @Override
    public List<ForumPost> posts(long threadId, int offset, int limit) {
        return state.posts.values().stream().filter(p -> p.threadId() == threadId)
                .sorted(Comparator.comparing(ForumPost::createdAt).thenComparingLong(ForumPost::id))
                .skip(offset).limit(limit).map(Json::copy).toList();
    }

    @Override
    public void save(ForumPost post) {
        state.posts.put(post.id(), c(post));
    }

    @Override
    public void deletePost(long id) {
        state.posts.remove(id);
    }

    // --- sojusze
    @Override
    public Optional<Alliance> alliance(long id) {
        return co(state.alliances.get(id));
    }

    @Override
    public Optional<Alliance> allianceByTag(String tag) {
        return state.alliances.values().stream().filter(a -> a.getTag().equalsIgnoreCase(tag)).findFirst().map(Json::copy);
    }

    @Override
    public List<Alliance> alliances() {
        return state.alliances.values().stream().map(Json::copy).toList();
    }

    @Override
    public void save(Alliance alliance) {
        state.alliances.put(alliance.getId(), c(alliance));
    }

    @Override
    public void deleteAlliance(long id) {
        state.alliances.remove(id);
        state.threads.values().removeIf(t -> t.allianceId() == id);
        state.posts.values().removeIf(p -> p.allianceId() == id);
    }

    @Override
    public Optional<AllianceApplication> application(long id) {
        return co(state.applications.get(id));
    }

    @Override
    public Optional<AllianceApplication> applicationOf(long playerId) {
        return state.applications.values().stream().filter(a -> a.playerId() == playerId).findFirst();
    }

    @Override
    public List<AllianceApplication> applications(long allianceId) {
        return state.applications.values().stream().filter(a -> a.allianceId() == allianceId).toList();
    }

    @Override
    public void save(AllianceApplication application) {
        state.applications.put(application.id(), application);
    }

    @Override
    public void deleteApplication(long id) {
        state.applications.remove(id);
    }

    @Override
    public Optional<Treaty> treaty(long id) {
        return Optional.ofNullable(state.treaties.get(id));
    }

    @Override
    public List<Treaty> treaties(long allianceId) {
        return state.treaties.values().stream().filter(t -> t.involves(allianceId)).toList();
    }

    @Override
    public void save(Treaty treaty) {
        state.treaties.put(treaty.id(), treaty);
    }

    @Override
    public void deleteTreaty(long id) {
        state.treaties.remove(id);
    }

    // --- znajomi
    @Override
    public Optional<Buddy> buddy(long id) {
        return Optional.ofNullable(state.buddies.get(id));
    }

    @Override
    public List<Buddy> buddiesOf(long playerId) {
        return state.buddies.values().stream().filter(b -> b.involves(playerId)).toList();
    }

    @Override
    public void save(Buddy buddy) {
        state.buddies.put(buddy.id(), buddy);
    }

    @Override
    public void deleteBuddy(long id) {
        state.buddies.remove(id);
    }

    // --- zdarzenia
    @Override
    public Optional<DueEvent> nextDueEvent(Instant until) {
        List<DueEvent> events = new ArrayList<>();
        for (Planet p : state.planets.values()) {
            BuildOrder active = p.activeBuild();
            if (active != null && !active.end().isAfter(until)) {
                events.add(new DueEvent(DueEvent.Type.BUILDING, p.getId(), active.end()));
            }
        }
        for (Player p : state.players.values()) {
            if (p.getResearchJob() != null && !p.getResearchJob().end().isAfter(until)) {
                events.add(new DueEvent(DueEvent.Type.RESEARCH, p.getId(), p.getResearchJob().end()));
            }
        }
        for (Fleet f : state.fleets.values()) {
            if (!f.nextEventAt().isAfter(until)) {
                events.add(new DueEvent(DueEvent.Type.FLEET, f.getId(), f.nextEventAt()));
            }
        }
        return events.stream().min(DueEvent.ORDER);
    }
}
