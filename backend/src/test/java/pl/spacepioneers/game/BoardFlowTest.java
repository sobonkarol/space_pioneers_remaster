package pl.spacepioneers.game;

import org.junit.Before;
import org.junit.Test;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.service.BoardService;

import java.time.Duration;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

/** Publiczne forum gry: dzialy, watki, wpisy, moderacja, zgloszenia bledow, odczyt gosci. */
public class BoardFlowTest {

    protected final GameFixture f = createFixture();

    protected GameFixture createFixture() {
        return new GameFixture();
    }

    private Player admin;
    private Player player;
    private Player other;

    @Before
    public void setUp() {
        admin = f.register("Admin");
        player = f.register("Gracz");
        other = f.register("Inny");
    }

    private void later() {
        f.advance(BoardService.POST_INTERVAL.plusSeconds(1));
    }

    @Test
    public void bugReportLifecycle() {
        BoardService.ThreadView bug = f.game.board().create(player.getId(), "bugs", "Flota nie wraca", "Opis błędu");
        assertEquals("NEW", bug.status());
        assertEquals("BUGS", bug.category());

        // gosc widzi watek i wpisy
        BoardService.IndexView idx = f.game.board().index(null);
        assertFalse(idx.loggedIn());
        assertEquals(1, idx.categories().stream().filter(c -> c.key().equals("BUGS")).findFirst().orElseThrow().threads());
        BoardService.ThreadPage guest = f.game.board().thread(null, bug.id(), 1);
        assertEquals(1, guest.posts().size());
        assertFalse(guest.canReply());

        // nowy watek jest nieprzeczytany dla innych, przeczytany dla autora
        assertTrue(f.game.board().category(other.getId(), "BUGS", 1).threads().get(0).unread());
        assertFalse(f.game.board().category(player.getId(), "BUGS", 1).threads().get(0).unread());

        later();
        f.game.board().reply(admin.getId(), bug.id(), "Potwierdzam, poprawka w drodze.");
        BoardService.ThreadPage page = f.game.board().thread(player.getId(), bug.id(), 1);
        assertTrue(page.posts().get(1).authorAdmin());
        assertEquals("forbidden", assertThrows(GameException.class,
                () -> f.game.board().moderate(player.getId(), bug.id(), null, null, "FIXED")).getCode());
        assertEquals("FIXED", f.game.board().moderate(admin.getId(), bug.id(), null, true, "FIXED").status());
        later();
        assertEquals("thread_locked", assertThrows(GameException.class,
                () -> f.game.board().reply(player.getId(), bug.id(), "dzięki")).getCode());
    }

    @Test
    public void announcementsOnlyForAdminsAndRules() {
        assertEquals("forbidden", assertThrows(GameException.class,
                () -> f.game.board().create(player.getId(), "announcements", "Hej", "x")).getCode());
        BoardService.ThreadView a = f.game.board().create(admin.getId(), "announcements", "Start serwera", "Witajcie!");
        assertNull(a.status());
        assertFalse(f.game.board().category(player.getId(), "ANNOUNCEMENTS", 1).canCreate());
        assertTrue(f.game.board().category(player.getId(), "GENERAL", 1).canCreate());
        assertFalse(f.game.board().category(null, "GENERAL", 1).canCreate());
        assertEquals("no_category", assertThrows(GameException.class,
                () -> f.game.board().category(null, "memes", 1)).getCode());
        assertEquals("not_bug", assertThrows(GameException.class,
                () -> f.game.board().moderate(admin.getId(), a.id(), null, null, "FIXED")).getCode());

        // ochrona przed zalewaniem
        f.game.board().create(player.getId(), "general", "Pierwszy", "a");
        assertEquals("post_too_fast", assertThrows(GameException.class,
                () -> f.game.board().create(player.getId(), "general", "Drugi", "b")).getCode());
        later();
        f.game.board().create(player.getId(), "general", "Drugi", "b");
    }

    @Test
    public void editDeleteAndPinning() {
        BoardService.ThreadView t = f.game.board().create(player.getId(), "ideas", "Nowy statek", "Pomysł");
        later();
        BoardService.PostView r = f.game.board().reply(other.getId(), t.id(), "Fajne");
        assertEquals("forbidden", assertThrows(GameException.class,
                () -> f.game.board().edit(player.getId(), r.id(), "zmiana")).getCode());
        f.game.board().edit(other.getId(), r.id(), "Bardzo fajne");
        assertEquals("Bardzo fajne", f.game.board().thread(other.getId(), t.id(), 1).posts().get(1).text());
        assertEquals("forbidden", assertThrows(GameException.class,
                () -> f.game.board().deletePost(player.getId(), r.id())).getCode());
        f.game.board().deletePost(admin.getId(), r.id());
        assertEquals(1, f.store.boardThread(t.id()).orElseThrow().posts());

        later();
        f.advance(Duration.ofMinutes(1));
        BoardService.ThreadView newer = f.game.board().create(other.getId(), "ideas", "Nowsze", "x");
        assertEquals(newer.id(), f.game.board().category(null, "IDEAS", 1).threads().get(0).id());
        f.game.board().moderate(admin.getId(), t.id(), true, null, null);
        assertEquals(t.id(), f.game.board().category(null, "IDEAS", 1).threads().get(0).id()); // przypiety pierwszy

        // usuniecie pierwszego wpisu usuwa watek
        long first = f.game.board().thread(player.getId(), t.id(), 1).posts().get(0).id();
        f.game.board().deletePost(player.getId(), first);
        assertTrue(f.store.boardThread(t.id()).isEmpty());
        f.game.board().deleteThread(admin.getId(), newer.id());
        assertTrue(f.game.board().index(null).latest().isEmpty());
    }

    @Test
    public void pagingShowsLastPage() {
        BoardService.ThreadView t = f.game.board().create(player.getId(), "general", "Długi wątek", "1");
        for (int i = 2; i <= BoardService.POSTS_PER_PAGE + 3; i++) {
            later();
            f.game.board().reply(i % 2 == 0 ? other.getId() : player.getId(), t.id(), String.valueOf(i));
        }
        BoardService.ThreadPage last = f.game.board().thread(null, t.id(), 0);
        assertEquals(2, last.pages());
        assertEquals(3, last.posts().size());
    }
}
