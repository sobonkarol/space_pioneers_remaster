package pl.spacepioneers.game.service;

import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.BoardPost;
import pl.spacepioneers.game.model.BoardThread;
import pl.spacepioneers.game.model.BoardThread.BugStatus;
import pl.spacepioneers.game.model.BoardThread.Category;
import pl.spacepioneers.game.model.Player;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Publiczne forum gry: kategorie, watki, wpisy. Czytac moze kazdy (takze bez logowania), pisac zalogowani
 * gracze. Administratorzy moderuja (przypinanie, zamykanie, usuwanie, status zgloszen bledow) i jako jedyni
 * zakladaja watki w ogloszeniach.
 */
public final class BoardService extends ServiceBase {

    public static final int MAX_TITLE = 100;
    public static final int MAX_TEXT = 10_000;
    public static final int THREADS_PER_PAGE = 25;
    public static final int POSTS_PER_PAGE = 20;
    /** Najkrotszy odstep miedzy wpisami jednego gracza. */
    public static final Duration POST_INTERVAL = Duration.ofSeconds(15);
    /** Ile identyfikatorow przeczytanych watkow pamietamy na gracza. */
    private static final int MAX_READ_MARKS = 500;

    public BoardService(GameContext ctx, World world) {
        super(ctx, world);
    }

    public record CategoryView(String key, int threads, ThreadView last) {
    }

    public record ThreadView(long id, String category, String title, String authorName, Instant createdAt,
                             Instant lastPostAt, String lastPostAuthor, int posts, boolean pinned, boolean locked,
                             String status, boolean unread) {
    }

    public record PostView(long id, String authorName, String text, Instant createdAt, Instant editedAt,
                           boolean authorAdmin, boolean canEdit, boolean canDelete) {
    }

    public record IndexView(List<CategoryView> categories, List<ThreadView> latest, boolean loggedIn, boolean admin) {
    }

    public record CategoryPage(String category, List<ThreadView> threads, int page, int pages, boolean canCreate,
                               boolean admin) {
    }

    public record ThreadPage(ThreadView thread, List<PostView> posts, int page, int pages, boolean canReply,
                             boolean admin) {
    }

    // --- odczyt (viewerId == null: gosc bez logowania)

    public IndexView index(Long viewerId) {
        return read(now -> {
            Player v = viewer(viewerId);
            List<CategoryView> cats = new ArrayList<>();
            for (Category c : Category.values()) {
                List<BoardThread> last = ctx.store().boardThreads(c, 0, THREADS_PER_PAGE);
                BoardThread newest = last.stream().max(java.util.Comparator.comparing(BoardThread::lastPostAt)).orElse(null);
                cats.add(new CategoryView(c.name(), ctx.store().boardThreadCount(c), newest == null ? null : view(v, newest)));
            }
            List<ThreadView> latest = ctx.store().latestBoardThreads(10).stream().map(t -> view(v, t)).toList();
            return new IndexView(cats, latest, v != null, v != null && v.isAdmin());
        });
    }

    public CategoryPage category(Long viewerId, String category, int page) {
        Category c = category(category);
        return read(now -> {
            Player v = viewer(viewerId);
            int total = ctx.store().boardThreadCount(c);
            int pages = Math.max(1, (total + THREADS_PER_PAGE - 1) / THREADS_PER_PAGE);
            int pg = Math.max(1, Math.min(page, pages));
            List<ThreadView> threads = ctx.store().boardThreads(c, (pg - 1) * THREADS_PER_PAGE, THREADS_PER_PAGE)
                    .stream().map(t -> view(v, t)).toList();
            boolean canCreate = v != null && (c != Category.ANNOUNCEMENTS || v.isAdmin());
            return new CategoryPage(c.name(), threads, pg, pages, canCreate, v != null && v.isAdmin());
        });
    }

    /** Strona watku ({@code page <= 0}: ostatnia). Zalogowanemu zapamietuje odczyt. */
    public ThreadPage thread(Long viewerId, long threadId, int page) {
        java.util.function.Function<Instant, ThreadPage> work = now -> {
            Player v = viewer(viewerId);
            BoardThread t = requireThread(threadId);
            int pages = Math.max(1, (t.posts() + POSTS_PER_PAGE - 1) / POSTS_PER_PAGE);
            int pg = page <= 0 || page > pages ? pages : page;
            boolean admin = v != null && v.isAdmin();
            Map<Long, Boolean> admins = new HashMap<>();
            List<PostView> posts = ctx.store().boardPosts(t.id(), (pg - 1) * POSTS_PER_PAGE, POSTS_PER_PAGE).stream()
                    .map(p -> {
                        boolean own = v != null && p.authorId() == v.getId();
                        boolean authorAdmin = admins.computeIfAbsent(p.authorId(),
                                id -> ctx.store().player(id).map(Player::isAdmin).orElse(false));
                        return new PostView(p.id(), p.authorName(), p.text(), p.createdAt(), p.editedAt(), authorAdmin,
                                own && !t.locked(), own || admin);
                    })
                    .toList();
            if (v != null) markRead(v, t);
            return new ThreadPage(view(null, t), posts, pg, pages, v != null && (!t.locked() || admin), admin);
        };
        return viewerId == null ? read(work) : tx(work);
    }

    // --- zapis

    public ThreadView create(long playerId, String category, String title, String text) {
        Category c = category(category);
        return tx(now -> {
            Player p = writer(playerId, now);
            if (c == Category.ANNOUNCEMENTS && !p.isAdmin()) {
                throw GameException.forbidden("Ogłoszenia publikuje administracja.");
            }
            String t = MessageService.clean(title, MAX_TITLE);
            String x = MessageService.clean(text, MAX_TEXT);
            if (t.isEmpty() || x.isEmpty()) {
                throw new GameException("empty_post", "Tytuł i treść są wymagane.");
            }
            long threadId = ctx.store().nextId("board_thread");
            BoardPost first = new BoardPost(ctx.store().nextId("board_post"), threadId, p.getId(), p.getUsername(), x, now, null);
            BoardThread thread = new BoardThread(threadId, c, t, p.getId(), p.getUsername(), now, now, p.getUsername(), 1,
                    false, false, first.id(), c == Category.BUGS ? BugStatus.NEW : null);
            ctx.store().save(thread);
            ctx.store().save(first);
            p.setLastBoardPostAt(now);
            markRead(p, thread);
            return view(p, thread);
        });
    }

    public PostView reply(long playerId, long threadId, String text) {
        return tx(now -> {
            Player p = writer(playerId, now);
            BoardThread t = requireThread(threadId);
            if (t.locked() && !p.isAdmin()) {
                throw new GameException("thread_locked", "Wątek jest zamknięty.");
            }
            String x = MessageService.clean(text, MAX_TEXT);
            if (x.isEmpty()) {
                throw new GameException("empty_post", "Treść wpisu jest pusta.");
            }
            BoardPost post = new BoardPost(ctx.store().nextId("board_post"), t.id(), p.getId(), p.getUsername(), x, now, null);
            ctx.store().save(post);
            BoardThread updated = t.withPost(post);
            ctx.store().save(updated);
            p.setLastBoardPostAt(now);
            markRead(p, updated);
            return new PostView(post.id(), p.getUsername(), x, now, null, p.isAdmin(), true, true);
        });
    }

    public void edit(long playerId, long postId, String text) {
        txRun(now -> {
            Player p = ctx.requirePlayer(playerId);
            BoardPost post = requirePost(postId);
            if (post.authorId() != p.getId()) {
                throw GameException.forbidden("Możesz edytować tylko własne wpisy.");
            }
            if (requireThread(post.threadId()).locked()) {
                throw new GameException("thread_locked", "Wątek jest zamknięty.");
            }
            String x = MessageService.clean(text, MAX_TEXT);
            if (x.isEmpty()) {
                throw new GameException("empty_post", "Treść wpisu jest pusta.");
            }
            ctx.store().save(post.edited(x, now));
        });
    }

    /** Usuwa wpis (autor albo administrator); usuniecie pierwszego wpisu usuwa caly watek. */
    public void deletePost(long playerId, long postId) {
        txRun(now -> {
            Player p = ctx.requirePlayer(playerId);
            BoardPost post = requirePost(postId);
            if (post.authorId() != p.getId() && !p.isAdmin()) {
                throw GameException.forbidden("Możesz usuwać tylko własne wpisy.");
            }
            BoardThread t = requireThread(post.threadId());
            List<BoardPost> first = ctx.store().boardPosts(t.id(), 0, 1);
            if (!first.isEmpty() && first.get(0).id() == postId) {
                ctx.store().deleteBoardThread(t.id());
                return;
            }
            ctx.store().deleteBoardPost(postId);
            List<BoardPost> rest = ctx.store().boardPosts(t.id(), Math.max(0, t.posts() - 2), 1);
            ctx.store().save(t.withCount(t.posts() - 1, rest.isEmpty() ? first.get(0) : rest.get(0)));
        });
    }

    /** Moderacja (administrator): przypiecie, zamkniecie, status zgloszenia bledu. */
    public ThreadView moderate(long playerId, long threadId, Boolean pinned, Boolean locked, String status) {
        return tx(now -> {
            Player p = requireAdmin(playerId);
            BoardThread t = requireThread(threadId);
            BugStatus s = t.status();
            if (status != null) {
                if (t.category() != Category.BUGS) {
                    throw new GameException("not_bug", "Status mają tylko zgłoszenia błędów.");
                }
                try {
                    s = BugStatus.valueOf(status);
                } catch (IllegalArgumentException e) {
                    throw new GameException("invalid_status", "Nieznany status zgłoszenia.");
                }
            }
            BoardThread u = t.withFlags(pinned == null ? t.pinned() : pinned, locked == null ? t.locked() : locked, s);
            ctx.store().save(u);
            return view(p, u);
        });
    }

    public void deleteThread(long playerId, long threadId) {
        txRun(now -> {
            requireAdmin(playerId);
            ctx.store().deleteBoardThread(requireThread(threadId).id());
        });
    }

    // --- pomocnicze

    private Player viewer(Long viewerId) {
        return viewerId == null ? null : ctx.store().player(viewerId).orElse(null);
    }

    private Player writer(long playerId, Instant now) {
        Player p = ctx.requirePlayer(playerId);
        if (p.getLastBoardPostAt() != null && p.getLastBoardPostAt().plus(POST_INTERVAL).isAfter(now)) {
            throw new GameException("post_too_fast", "Odczekaj chwilę przed kolejnym wpisem.");
        }
        return p;
    }

    private Player requireAdmin(long playerId) {
        Player p = ctx.requirePlayer(playerId);
        if (!p.isAdmin()) {
            throw GameException.forbidden("Forum moderuje administracja.");
        }
        return p;
    }

    private static Category category(String key) {
        try {
            return Category.valueOf(key == null ? "" : key.toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new GameException(GameException.Kind.NOT_FOUND, "no_category", "Nie ma takiego działu forum.");
        }
    }

    private BoardThread requireThread(long id) {
        return ctx.store().boardThread(id).orElseThrow(() -> GameException.notFound("wątek " + id));
    }

    private BoardPost requirePost(long id) {
        return ctx.store().boardPost(id).orElseThrow(() -> GameException.notFound("wpis " + id));
    }

    private static boolean unread(Player v, BoardThread t) {
        if (v == null) return false;
        Long seen = v.getBoardRead().get(t.id());
        return seen == null || seen < t.lastPostId();
    }

    private static ThreadView view(Player v, BoardThread t) {
        return new ThreadView(t.id(), t.category().name(), t.title(), t.authorName(), t.createdAt(), t.lastPostAt(),
                t.lastPostAuthor(), t.posts(), t.pinned(), t.locked(), t.status() == null ? null : t.status().name(),
                unread(v, t));
    }

    private void markRead(Player p, BoardThread t) {
        Map<Long, Long> read = new HashMap<>(p.getBoardRead());
        read.put(t.id(), t.lastPostId());
        if (read.size() > MAX_READ_MARKS) {
            // zostawiamy znaczniki najnowszych watkow
            List<Long> ids = new ArrayList<>(read.keySet());
            ids.sort(java.util.Comparator.reverseOrder());
            for (Long id : ids.subList(MAX_READ_MARKS, ids.size())) read.remove(id);
        }
        p.setBoardRead(read);
        ctx.store().save(p);
    }
}
