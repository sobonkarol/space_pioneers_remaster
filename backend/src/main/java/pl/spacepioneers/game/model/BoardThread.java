package pl.spacepioneers.game.model;

import java.time.Instant;

/** Watek publicznego forum gry. {@code status} dotyczy tylko kategorii BUGS. */
public record BoardThread(long id, Category category, String title, long authorId, String authorName, Instant createdAt,
                          Instant lastPostAt, String lastPostAuthor, int posts, boolean pinned, boolean locked,
                          long lastPostId, BugStatus status) {

    /** Kategorie forum; w ogloszeniach watki zakladaja tylko administratorzy. */
    public enum Category { ANNOUNCEMENTS, GENERAL, IDEAS, BUGS, HELP }

    public enum BugStatus { NEW, CONFIRMED, FIXED, REJECTED }

    public BoardThread withPost(BoardPost post) {
        return new BoardThread(id, category, title, authorId, authorName, createdAt, post.createdAt(), post.authorName(),
                posts + 1, pinned, locked, post.id(), status);
    }

    public BoardThread withCount(int count, BoardPost last) {
        return new BoardThread(id, category, title, authorId, authorName, createdAt, last.createdAt(), last.authorName(),
                count, pinned, locked, last.id(), status);
    }

    public BoardThread withFlags(boolean pin, boolean lock, BugStatus newStatus) {
        return new BoardThread(id, category, title, authorId, authorName, createdAt, lastPostAt, lastPostAuthor, posts,
                pin, lock, lastPostId, newStatus);
    }
}
