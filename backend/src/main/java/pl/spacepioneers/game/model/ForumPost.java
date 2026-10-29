package pl.spacepioneers.game.model;

import java.time.Instant;

/** Wpis w watku forum sojuszu. */
public record ForumPost(long id, long threadId, long allianceId, long authorId, String authorName, String text,
                        Instant createdAt, Instant editedAt) {

    public ForumPost edited(String newText, Instant at) {
        return new ForumPost(id, threadId, allianceId, authorId, authorName, newText, createdAt, at);
    }
}
