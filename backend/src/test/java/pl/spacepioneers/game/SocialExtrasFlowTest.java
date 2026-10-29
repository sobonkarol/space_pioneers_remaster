package pl.spacepioneers.game;

import org.junit.Before;
import org.junit.Test;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Note;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.Player.AllianceRank;
import pl.spacepioneers.game.service.ForumService;
import pl.spacepioneers.game.service.MessageService;

import java.time.Duration;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

/** Archiwum wiadomosci i ich wygasanie, notatki, forum sojuszu. */
public class SocialExtrasFlowTest {

    protected final GameFixture f = createFixture();

    protected GameFixture createFixture() {
        return new GameFixture();
    }

    private Player leader;
    private Player member;
    private Player outsider;
    private long allianceId;

    @Before
    public void setUp() {
        leader = f.register("Lider");
        member = f.register("Czlonek");
        outsider = f.register("Obcy");
        allianceId = f.game.alliances().create(leader.getId(), "FOR", "Forumowicze").id();
        f.game.alliances().apply(member.getId(), allianceId, "");
        f.game.alliances().decideApplication(leader.getId(), f.store.applicationOf(member.getId()).orElseThrow().id(), true);
    }

    @Test
    public void archivedMessagesSurviveCleanup() {
        Message keep = f.game.messages().send(member.getId(), "Lider", "Ważne", "Zachowaj to");
        Message drop = f.game.messages().send(member.getId(), "Lider", "Zwykłe", "Do usunięcia");
        Message unread = f.game.messages().send(member.getId(), "Lider", "Nieprzeczytane", "x");
        f.game.messages().read(leader.getId(), keep.id());
        f.game.messages().read(leader.getId(), drop.id());
        f.game.messages().setArchived(leader.getId(), keep.id(), true);
        assertEquals(1, f.game.messages().archive(leader.getId()).size());

        f.advance(MessageService.READ_RETENTION.plusHours(1));
        f.game.messages().purgeOld();
        List<Long> ids = f.store.messagesOf(leader.getId(), null, 100).stream().map(Message::id).toList();
        assertTrue(ids.contains(keep.id()));
        assertFalse(ids.contains(drop.id()));
        assertTrue(ids.contains(unread.id())); // nieprzeczytane zyja dluzej

        f.advance(MessageService.UNREAD_RETENTION);
        f.game.messages().purgeOld();
        ids = f.store.messagesOf(leader.getId(), null, 100).stream().map(Message::id).toList();
        assertEquals(List.of(keep.id()), ids);

        f.game.messages().setArchived(leader.getId(), keep.id(), false);
        assertTrue(f.game.messages().archive(leader.getId()).isEmpty());
        assertThrows(GameException.class, () -> f.game.messages().setArchived(member.getId(), keep.id(), true));
    }

    @Test
    public void deleteAllKeepsArchive() {
        Message a = f.game.messages().send(member.getId(), "Lider", "A", "a");
        f.game.messages().send(member.getId(), "Lider", "B", "b");
        f.game.messages().setArchived(leader.getId(), a.id(), true);
        int before = f.store.messagesOf(leader.getId(), Message.Type.PRIVATE, 100).size();
        assertEquals(before - 1, f.game.messages().deleteAll(leader.getId(), Message.Type.PRIVATE));
        assertEquals(1, f.store.messagesOf(leader.getId(), Message.Type.PRIVATE, 100).size());
    }

    @Test
    public void notesCrud() {
        Note n = f.game.notes().save(member.getId(), null, "Cele", "Zbudować kolonię", 2);
        f.game.notes().save(member.getId(), null, "Drobne", "", 0);
        assertEquals("Cele", f.game.notes().list(member.getId()).get(0).title()); // wazne najpierw
        f.advance(Duration.ofMinutes(5));
        Note u = f.game.notes().save(member.getId(), n.id(), "Cele 2", "Zmiana", 1);
        assertEquals(n.createdAt(), u.createdAt());
        assertTrue(u.updatedAt().isAfter(n.updatedAt()));
        assertEquals("not_found", assertThrows(GameException.class,
                () -> f.game.notes().save(outsider.getId(), n.id(), "x", "", 1)).getCode());
        assertEquals("empty_title", assertThrows(GameException.class,
                () -> f.game.notes().save(member.getId(), null, " ", "", 1)).getCode());
        f.game.notes().delete(member.getId(), n.id());
        assertEquals(1, f.game.notes().list(member.getId()).size());
        assertTrue(f.game.notes().list(leader.getId()).isEmpty());
    }

    @Test
    public void forumThreadsPostsModerationAndUnread() {
        ForumService.ThreadView t = f.game.forum().create(member.getId(), "Plan ataku", "Atakujemy w sobotę.");
        assertEquals(1, f.game.forum().unreadCount(leader.getId()));
        assertEquals(0, f.game.forum().unreadCount(member.getId()));
        assertEquals(1, f.game.planets().overview(leader.getId(), leader.getHomePlanetId()).forumUnread());

        ForumService.ThreadPage page = f.game.forum().read(leader.getId(), t.id(), 1);
        assertEquals(1, page.posts().size());
        assertTrue(page.canModerate());
        assertEquals(0, f.game.forum().unreadCount(leader.getId()));

        f.advance(Duration.ofMinutes(1));
        ForumService.PostView reply = f.game.forum().reply(leader.getId(), t.id(), "Zgoda.");
        assertEquals(1, f.game.forum().unreadCount(member.getId()));
        assertEquals("forbidden", assertThrows(GameException.class,
                () -> f.game.forum().edit(member.getId(), reply.id(), "zmiana")).getCode());
        f.game.forum().edit(leader.getId(), reply.id(), "Zgoda, o 20:00.");

        // obcy nie widzi forum
        assertEquals("no_alliance", assertThrows(GameException.class, () -> f.game.forum().threads(outsider.getId())).getCode());

        // zamkniecie watku blokuje odpowiedzi czlonkow, nie moderatorow
        f.game.forum().moderate(leader.getId(), t.id(), true, true);
        assertEquals("thread_locked", assertThrows(GameException.class,
                () -> f.game.forum().reply(member.getId(), t.id(), "hej")).getCode());
        assertEquals("forbidden", assertThrows(GameException.class,
                () -> f.game.forum().moderate(member.getId(), t.id(), false, false)).getCode());
        f.game.forum().reply(leader.getId(), t.id(), "Ogłoszenie.");

        ForumService.ThreadView second = f.game.forum().create(leader.getId(), "Inny", "x");
        List<ForumService.ThreadView> list = f.game.forum().threads(member.getId()).threads();
        assertEquals(t.id(), list.get(0).id()); // przypiety pierwszy mimo starszego wpisu
        assertEquals(3, list.get(0).posts());

        // usuniecie odpowiedzi przez moderatora aktualizuje licznik; usuniecie pierwszego wpisu - caly watek
        f.game.forum().deletePost(leader.getId(), reply.id());
        assertEquals(2, f.store.thread(t.id()).orElseThrow().posts());
        long firstPost = f.game.forum().read(leader.getId(), second.id(), 1).posts().get(0).id();
        f.game.forum().deletePost(leader.getId(), firstPost);
        assertTrue(f.store.thread(second.id()).isEmpty());
    }

    @Test
    public void forumPagingAndDissolution() {
        ForumService.ThreadView t = f.game.forum().create(member.getId(), "Długi", "1");
        for (int i = 2; i <= ForumService.PAGE_SIZE + 5; i++) {
            f.advance(Duration.ofSeconds(1));
            f.game.forum().reply(i % 2 == 0 ? leader.getId() : member.getId(), t.id(), String.valueOf(i));
        }
        ForumService.ThreadPage last = f.game.forum().read(member.getId(), t.id(), 0);
        assertEquals(2, last.pages());
        assertEquals(2, last.page());
        assertEquals(5, last.posts().size());
        assertEquals("1", f.game.forum().read(member.getId(), t.id(), 1).posts().get(0).text());

        f.editPlayer(member.getId(), p -> p.setAllianceRank(AllianceRank.MEMBER));
        f.game.alliances().dissolve(leader.getId());
        assertTrue(f.store.threads(allianceId).isEmpty());
        assertTrue(f.store.thread(t.id()).isEmpty());
    }
}
