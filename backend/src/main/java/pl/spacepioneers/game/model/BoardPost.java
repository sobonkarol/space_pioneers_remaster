package pl.spacepioneers.game.model;

import java.time.Instant;

/** Wpis na publicznym forum gry. */
public record BoardPost(long id, long threadId, long authorId, String authorName, String text, Instant createdAt,
                        Instant editedAt) {

    public BoardPost edited(String newText, Instant at) {
        return new BoardPost(id, threadId, authorId, authorName, newText, createdAt, at);
    }
}
