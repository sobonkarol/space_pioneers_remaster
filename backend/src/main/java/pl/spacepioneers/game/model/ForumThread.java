package pl.spacepioneers.game.model;

import java.time.Instant;

/** Watek forum sojuszu. {@code lastPostId} sluzy do oznaczania nowych wpisow (identyfikatory rosna). */
public record ForumThread(long id, long allianceId, String title, long authorId, String authorName, Instant createdAt,
                          Instant lastPostAt, String lastPostAuthor, int posts, boolean pinned, boolean locked,
                          long lastPostId) {

    public ForumThread withPost(ForumPost post) {
        return new ForumThread(id, allianceId, title, authorId, authorName, createdAt, post.createdAt(), post.authorName(),
                posts + 1, pinned, locked, post.id());
    }

    public ForumThread withCount(int count, ForumPost last) {
        return new ForumThread(id, allianceId, title, authorId, authorName, createdAt, last.createdAt(), last.authorName(),
                count, pinned, locked, last.id());
    }

    public ForumThread withFlags(boolean pin, boolean lock) {
        return new ForumThread(id, allianceId, title, authorId, authorName, createdAt, lastPostAt, lastPostAuthor, posts,
                pin, lock, lastPostId);
    }
}
