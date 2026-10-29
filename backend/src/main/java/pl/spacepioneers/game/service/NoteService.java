package pl.spacepioneers.game.service;

import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.Note;

import java.util.List;

/** Prywatne notatki gracza. */
public final class NoteService extends ServiceBase {

    public static final int MAX_NOTES = 100;
    public static final int MAX_TITLE = 100;
    public static final int MAX_TEXT = 5000;

    public NoteService(GameContext ctx, World world) {
        super(ctx, world);
    }

    public List<Note> list(long playerId) {
        return tx(now -> ctx.store().notesOf(playerId));
    }

    /** Tworzy notatke ({@code noteId == null}) albo ja zmienia. */
    public Note save(long playerId, Long noteId, String title, String text, int priority) {
        return tx(now -> {
            String t = MessageService.clean(title, MAX_TITLE);
            String x = MessageService.clean(text, MAX_TEXT);
            if (t.isEmpty()) {
                throw new GameException("empty_title", "Podaj tytuł notatki.");
            }
            if (priority < 0 || priority > 2) {
                throw new GameException("invalid_priority", "Nieprawidłowy priorytet.");
            }
            if (noteId == null) {
                if (ctx.store().notesOf(playerId).size() >= MAX_NOTES) {
                    throw new GameException("notes_full", "Osiągnięto limit " + MAX_NOTES + " notatek.");
                }
                Note n = new Note(ctx.store().nextId("note"), playerId, t, x, priority, now, now);
                ctx.store().save(n);
                return n;
            }
            Note old = own(playerId, noteId);
            Note n = new Note(old.id(), playerId, t, x, priority, old.createdAt(), now);
            ctx.store().save(n);
            return n;
        });
    }

    public void delete(long playerId, long noteId) {
        txRun(now -> {
            own(playerId, noteId);
            ctx.store().deleteNote(noteId);
        });
    }

    private Note own(long playerId, long noteId) {
        return ctx.store().note(noteId).filter(n -> n.ownerId() == playerId)
                .orElseThrow(() -> GameException.notFound("notatka " + noteId));
    }
}
