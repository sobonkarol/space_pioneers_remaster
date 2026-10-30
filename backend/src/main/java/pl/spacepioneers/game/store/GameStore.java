package pl.spacepioneers.game.store;

import pl.spacepioneers.engine.common.Coordinates;
import pl.spacepioneers.game.model.Alliance;
import pl.spacepioneers.game.model.AllianceApplication;
import pl.spacepioneers.game.model.AttackUnion;
import pl.spacepioneers.game.model.Buddy;
import pl.spacepioneers.game.model.DebrisField;
import pl.spacepioneers.game.model.BoardPost;
import pl.spacepioneers.game.model.BoardThread;
import pl.spacepioneers.game.model.Fleet;
import pl.spacepioneers.game.model.ForumPost;
import pl.spacepioneers.game.model.ForumThread;
import pl.spacepioneers.game.model.Note;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.Treaty;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * Port magazynu stanu gry. Obiekty zwracane sa kopiami - zmiany trzeba zapisac metoda {@code save}.
 * Wszystkie operacje modyfikujace wykonywane sa wewnatrz {@link #inTransaction(Supplier)},
 * ktora gwarantuje wylacznosc (jeden zapis naraz) i atomowosc.
 */
public interface GameStore {

    <T> T inTransaction(Supplier<T> work);

    /**
     * Odczyt bez blokady swiata (rownolegle z innymi odczytami). Praca nie moze niczego zapisywac.
     * Domyslnie zwykla transakcja.
     */
    default <T> T readOnly(Supplier<T> work) {
        return inTransaction(work);
    }

    default void inTransaction(Runnable work) {
        inTransaction(() -> {
            work.run();
            return null;
        });
    }

    long nextId(String sequence);

    // --- gracze
    Optional<Player> player(long id);

    Optional<Player> playerByName(String username);

    Optional<Player> playerByEmail(String email);

    List<Player> players();

    int playerCount();

    /** Gracze, ktorych nazwa zawiera fragment (bez rozrozniania wielkosci liter), alfabetycznie. */
    List<Player> searchPlayers(String fragment, int limit);

    /** Sojusze, ktorych skrot albo nazwa zawiera fragment. */
    List<Alliance> searchAlliances(String fragment, int limit);

    /** Planety i ksiezyce, ktorych nazwa zawiera fragment. */
    List<Planet> searchPlanets(String fragment, int limit);

    /**
     * Strona rankingu graczy wedlug kategorii punktow (total, economy, research, fleet, defense) malejaco,
     * przy rownych punktach rosnaco po id.
     */
    List<Player> playersByScore(String category, int offset, int limit);

    List<Player> playersOfAlliance(long allianceId);

    void save(Player player);

    /** Usuwa gracza wraz z jego wiadomosciami (planety, floty i powiazania usuwa wczesniej logika gry). */
    void deletePlayer(long id);

    // --- planety
    Optional<Planet> planet(long id);

    /** Planeta (nie ksiezyc) na danej pozycji. */
    Optional<Planet> planetAt(Coordinates coordinates);

    /** Ksiezyc na danej pozycji. */
    Optional<Planet> moonAt(Coordinates coordinates);

    default Optional<Planet> bodyAt(Coordinates coordinates, boolean moon) {
        return moon ? moonAt(coordinates) : planetAt(coordinates);
    }

    List<Planet> moonsInSystem(int galaxy, int system);

    List<Planet> planetsOf(long ownerId);

    List<Planet> planetsInSystem(int galaxy, int system);

    List<Planet> allPlanets();

    void save(Planet planet);

    void deletePlanet(long id);

    // --- floty
    Optional<Fleet> fleet(long id);

    List<Fleet> fleetsOf(long ownerId);

    /** Floty obcych graczy lecace do planet wskazanego gracza lub stacjonujace przy nich (obrona sojusznicza). */
    List<Fleet> fleetsTargeting(long playerId);

    List<Fleet> allFleets();

    List<Fleet> fleetsInUnion(long unionId);

    /** Floty sojusznikow stacjonujace (HOLDING) przy danym ciele niebieskim. */
    List<Fleet> fleetsHoldingAt(Coordinates coordinates, boolean moon);

    /** Floty startujace z lub lecace do danej pozycji (do skanowania falanga). */
    List<Fleet> fleetsAround(Coordinates coordinates);

    // --- ataki sojusznicze
    Optional<AttackUnion> union(long id);

    List<AttackUnion> unions();

    void save(AttackUnion union);

    void deleteUnion(long id);

    void save(Fleet fleet);

    void deleteFleet(long id);

    // --- pola zniszczen
    Optional<DebrisField> debris(Coordinates coordinates);

    List<DebrisField> debrisInSystem(int galaxy, int system);

    void save(DebrisField debris);

    void deleteDebris(Coordinates coordinates);

    // --- wiadomosci
    Optional<Message> message(long id);

    /** Wiadomosci gracza od najnowszych; {@code type == null} oznacza wszystkie. */
    List<Message> messagesOf(long playerId, Message.Type type, int limit);

    int unreadCount(long playerId);

    void save(Message message);

    void deleteMessage(long id);

    List<Message> archivedMessages(long playerId, int limit);

    int archivedCount(long playerId);

    /**
     * Usuwa wiadomosci spoza archiwum: przeczytane utworzone przed {@code readBefore} i wszystkie utworzone
     * przed {@code anyBefore}. Zwraca liczbe usunietych.
     */
    int purgeMessages(java.time.Instant readBefore, java.time.Instant anyBefore);

    // --- notatki

    Optional<Note> note(long id);

    List<Note> notesOf(long ownerId);

    void save(Note note);

    void deleteNote(long id);

    // --- publiczne forum gry

    Optional<BoardThread> boardThread(long id);

    /** Watki kategorii: przypiete najpierw, potem od najnowszego wpisu. */
    List<BoardThread> boardThreads(BoardThread.Category category, int offset, int limit);

    int boardThreadCount(BoardThread.Category category);

    /** Najnowsze watki ze wszystkich kategorii (podsumowanie forum). */
    List<BoardThread> latestBoardThreads(int limit);

    void save(BoardThread thread);

    /** Usuwa watek wraz z wpisami. */
    void deleteBoardThread(long id);

    Optional<BoardPost> boardPost(long id);

    List<BoardPost> boardPosts(long threadId, int offset, int limit);

    void save(BoardPost post);

    void deleteBoardPost(long id);

    // --- forum sojuszu

    Optional<ForumThread> thread(long id);

    /** Watki sojuszu: przypiete najpierw, potem od najnowszego wpisu. */
    List<ForumThread> threads(long allianceId);

    void save(ForumThread thread);

    /** Usuwa watek wraz z wpisami. */
    void deleteThread(long id);

    Optional<ForumPost> post(long id);

    /** Wpisy watku od najstarszego. */
    List<ForumPost> posts(long threadId, int offset, int limit);

    void save(ForumPost post);

    void deletePost(long id);

    // --- sojusze
    Optional<Alliance> alliance(long id);

    Optional<Alliance> allianceByTag(String tag);

    List<Alliance> alliances();

    void save(Alliance alliance);

    void deleteAlliance(long id);

    Optional<AllianceApplication> application(long id);

    Optional<AllianceApplication> applicationOf(long playerId);

    List<AllianceApplication> applications(long allianceId);

    void save(AllianceApplication application);

    void deleteApplication(long id);

    Optional<Treaty> treaty(long id);

    List<Treaty> treaties(long allianceId);

    void save(Treaty treaty);

    void deleteTreaty(long id);

    // --- znajomi
    Optional<Buddy> buddy(long id);

    List<Buddy> buddiesOf(long playerId);

    void save(Buddy buddy);

    void deleteBuddy(long id);

    default boolean areBuddies(long a, long b) {
        return buddiesOf(a).stream().anyMatch(x -> x.status() == Buddy.Status.ACCEPTED && x.other(a) == b);
    }

    // --- zdarzenia czasowe
    /** Najwczesniejsze zdarzenie z czasem &lt;= {@code until}. */
    Optional<DueEvent> nextDueEvent(Instant until);
}
