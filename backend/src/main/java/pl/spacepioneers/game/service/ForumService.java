package pl.spacepioneers.game.service;

import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.ForumPost;
import pl.spacepioneers.game.model.ForumThread;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.Player.AllianceRank;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Forum wewnetrzne sojuszu: watki i wpisy widoczne tylko dla czlonkow. Zalozyciel i oficerowie moderuja
 * (przypinanie, zamykanie, usuwanie), autor moze edytowac i usuwac wlasne wpisy.
 */
public final class ForumService extends ServiceBase {

    public static final int MAX_TITLE = 100;
    public static final int MAX_TEXT = 10_000;
    public static final int PAGE_SIZE = 20;

    public ForumService(GameContext ctx, World world) {
        super(ctx, world);
    }

    public record ThreadView(long id, String title, String authorName, Instant createdAt, Instant lastPostAt,
                             String lastPostAuthor, int posts, boolean pinned, boolean locked, boolean unread) {
    }

    public record PostView(long id, long authorId, String authorName, String text, Instant createdAt, Instant editedAt,
                           boolean canEdit, boolean canDelete) {
    }

    public record ThreadPage(ThreadView thread, List<PostView> posts, int page, int pages, boolean canModerate,
                             boolean canReply) {
    }

    public record ForumView(List<ThreadView> threads, boolean canModerate, int unread) {
    }

    private Player member(long playerId) {
        Player p = ctx.requirePlayer(playerId);
        if (p.getAllianceId() == null) {
            throw new GameException("no_alliance", "Nie należysz do sojuszu.");
        }
        return p;
    }

    private static boolean moderator(Player p) {
        return p.getAllianceRank() == AllianceRank.FOUNDER || p.getAllianceRank() == AllianceRank.OFFICER;
    }

    private ForumThread thread(Player p, long threadId) {
        return ctx.store().thread(threadId).filter(t -> t.allianceId() == p.getAllianceId())
                .orElseThrow(() -> GameException.notFound("wątek " + threadId));
    }

    private static boolean unread(Player p, ForumThread t) {
        Long seen = p.getForumRead().get(t.id());
        return seen == null || seen < t.lastPostId();
    }

    private ThreadView view(Player p, ForumThread t) {
        return new ThreadView(t.id(), t.title(), t.authorName(), t.createdAt(), t.lastPostAt(), t.lastPostAuthor(),
                t.posts(), t.pinned(), t.locked(), unread(p, t));
    }

    public ForumView threads(long playerId) {
        return tx(now -> {
            Player p = member(playerId);
            List<ThreadView> list = ctx.store().threads(p.getAllianceId()).stream().map(t -> view(p, t)).toList();
            return new ForumView(list, moderator(p), (int) list.stream().filter(ThreadView::unread).count());
        });
    }

    /** Liczba watkow z nowymi wpisami (do menu). */
    public int unreadCount(long playerId) {
        return tx(now -> {
            Player p = ctx.requirePlayer(playerId);
            if (p.getAllianceId() == null) return 0;
            return (int) ctx.store().threads(p.getAllianceId()).stream().filter(t -> unread(p, t)).count();
        });
    }

    public ThreadView create(long playerId, String title, String text) {
        return tx(now -> {
            Player p = member(playerId);
            String t = MessageService.clean(title, MAX_TITLE);
            String x = MessageService.clean(text, MAX_TEXT);
            if (t.isEmpty() || x.isEmpty()) {
                throw new GameException("empty_post", "Tytuł i treść są wymagane.");
            }
            long threadId = ctx.store().nextId("thread");
            ForumPost first = new ForumPost(ctx.store().nextId("post"), threadId, p.getAllianceId(), p.getId(),
                    p.getUsername(), x, now, null);
            ForumThread thread = new ForumThread(threadId, p.getAllianceId(), t, p.getId(),
                    p.getUsername(), now, now, p.getUsername(), 1, false, false, first.id());
            ctx.store().save(thread);
            ctx.store().save(first);
            markRead(p, thread);
            return view(p, thread);
        });
    }

    /** Strona watku (od 1; {@code page <= 0} oznacza ostatnia). Oznacza watek jako przeczytany. */
    public ThreadPage read(long playerId, long threadId, int page) {
        return tx(now -> {
            Player p = member(playerId);
            ForumThread t = thread(p, threadId);
            int pages = Math.max(1, (t.posts() + PAGE_SIZE - 1) / PAGE_SIZE);
            int pg = page <= 0 || page > pages ? pages : page;
            boolean mod = moderator(p);
            List<PostView> posts = ctx.store().posts(t.id(), (pg - 1) * PAGE_SIZE, PAGE_SIZE).stream()
                    .map(x -> new PostView(x.id(), x.authorId(), x.authorName(), x.text(), x.createdAt(), x.editedAt(),
                            x.authorId() == p.getId() && !t.locked(), x.authorId() == p.getId() || mod))
                    .toList();
            markRead(p, t);
            ThreadView v = new ThreadView(t.id(), t.title(), t.authorName(), t.createdAt(), t.lastPostAt(),
                    t.lastPostAuthor(), t.posts(), t.pinned(), t.locked(), false);
            return new ThreadPage(v, posts, pg, pages, mod, !t.locked() || mod);
        });
    }

    public PostView reply(long playerId, long threadId, String text) {
        return tx(now -> {
            Player p = member(playerId);
            ForumThread t = thread(p, threadId);
            if (t.locked() && !moderator(p)) {
                throw new GameException("thread_locked", "Wątek jest zamknięty.");
            }
            String x = MessageService.clean(text, MAX_TEXT);
            if (x.isEmpty()) {
                throw new GameException("empty_post", "Treść wpisu jest pusta.");
            }
            ForumPost post = new ForumPost(ctx.store().nextId("post"), t.id(), t.allianceId(), p.getId(), p.getUsername(),
                    x, now, null);
            ctx.store().save(post);
            ForumThread updated = t.withPost(post);
            ctx.store().save(updated);
            markRead(p, updated);
            return new PostView(post.id(), p.getId(), p.getUsername(), x, now, null, true, true);
        });
    }

    public void edit(long playerId, long postId, String text) {
        txRun(now -> {
            Player p = member(playerId);
            ForumPost post = ctx.store().post(postId).filter(x -> x.allianceId() == p.getAllianceId())
                    .orElseThrow(() -> GameException.notFound("wpis " + postId));
            if (post.authorId() != p.getId()) {
                throw GameException.forbidden("Możesz edytować tylko własne wpisy.");
            }
            if (thread(p, post.threadId()).locked()) {
                throw new GameException("thread_locked", "Wątek jest zamknięty.");
            }
            String x = MessageService.clean(text, MAX_TEXT);
            if (x.isEmpty()) {
                throw new GameException("empty_post", "Treść wpisu jest pusta.");
            }
            ctx.store().save(post.edited(x, now));
        });
    }

    /** Usuwa wpis; usuniecie pierwszego wpisu usuwa caly watek. */
    public void deletePost(long playerId, long postId) {
        txRun(now -> {
            Player p = member(playerId);
            ForumPost post = ctx.store().post(postId).filter(x -> x.allianceId() == p.getAllianceId())
                    .orElseThrow(() -> GameException.notFound("wpis " + postId));
            if (post.authorId() != p.getId() && !moderator(p)) {
                throw GameException.forbidden("Możesz usuwać tylko własne wpisy.");
            }
            ForumThread t = thread(p, post.threadId());
            List<ForumPost> first = ctx.store().posts(t.id(), 0, 1);
            if (!first.isEmpty() && first.get(0).id() == postId) {
                ctx.store().deleteThread(t.id());
                return;
            }
            ctx.store().deletePost(postId);
            List<ForumPost> rest = ctx.store().posts(t.id(), Math.max(0, t.posts() - 2), 1);
            ForumPost last = rest.isEmpty() ? first.get(0) : rest.get(0);
            ctx.store().save(t.withCount(t.posts() - 1, last));
        });
    }

    public ThreadView moderate(long playerId, long threadId, Boolean pinned, Boolean locked) {
        return tx(now -> {
            Player p = member(playerId);
            if (!moderator(p)) {
                throw GameException.forbidden("Tylko założyciel i oficerowie moderują forum.");
            }
            ForumThread t = thread(p, threadId);
            ForumThread u = t.withFlags(pinned == null ? t.pinned() : pinned, locked == null ? t.locked() : locked);
            ctx.store().save(u);
            return view(p, u);
        });
    }

    public void deleteThread(long playerId, long threadId) {
        txRun(now -> {
            Player p = member(playerId);
            ForumThread t = thread(p, threadId);
            if (!moderator(p) && t.authorId() != p.getId()) {
                throw GameException.forbidden("Tylko założyciel, oficerowie i autor mogą usunąć wątek.");
            }
            ctx.store().deleteThread(t.id());
        });
    }

    /** Zapamietuje odczyt watku i usuwa znaczniki watkow, ktore juz nie istnieja. */
    private void markRead(Player p, ForumThread thread) {
        Set<Long> existing = ctx.store().threads(p.getAllianceId()).stream().map(ForumThread::id).collect(Collectors.toSet());
        Map<Long, Long> read = new HashMap<>();
        p.getForumRead().forEach((k, v) -> {
            if (existing.contains(k)) read.put(k, v);
        });
        read.put(thread.id(), thread.lastPostId());
        p.setForumRead(read);
        ctx.store().save(p);
    }
}
