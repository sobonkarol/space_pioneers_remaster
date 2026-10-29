package pl.spacepioneers.game.service;

import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.Buddy;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.store.GameStore;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Lista znajomych: zaproszenia, akceptacja, usuwanie. Znajomi moga sie bronic (obrona sojusznicza) i atakowac wspolnie. */
public final class BuddyService extends ServiceBase {

    public static final int MAX_BUDDIES = 50;

    private final Mailer mailer;

    public BuddyService(GameContext ctx, World world, Mailer mailer) {
        super(ctx, world);
        this.mailer = mailer;
    }

    public record BuddyView(long id, long playerId, String name, String status, boolean incoming, String text,
                            Instant lastActivity, String allianceTag, double points, String homeCoordinates) {
    }

    public List<BuddyView> list(long playerId) {
        return tx(now -> {
            GameStore store = ctx.store();
            List<BuddyView> out = new ArrayList<>();
            for (Buddy b : store.buddiesOf(playerId)) {
                Player other = store.player(b.other(playerId)).orElse(null);
                if (other == null) continue;
                boolean accepted = b.status() == Buddy.Status.ACCEPTED;
                String tag = other.getAllianceId() == null ? null
                        : store.alliance(other.getAllianceId()).map(a -> a.getTag()).orElse(null);
                out.add(new BuddyView(b.id(), other.getId(), other.getUsername(), b.status().name(),
                        b.addresseeId() == playerId, b.text(), accepted ? other.getLastActivity() : null, tag,
                        Math.floor(other.getScore().total()),
                        accepted ? store.planet(other.getHomePlanetId()).map(p -> p.coordinates().toString()).orElse(null) : null));
            }
            return out;
        });
    }

    public void request(long playerId, String username, String text) {
        txRun(now -> {
            GameStore store = ctx.store();
            Player me = ctx.requirePlayer(playerId);
            Player other = store.playerByName(username == null ? "" : username.trim())
                    .orElseThrow(() -> new GameException(GameException.Kind.NOT_FOUND, "no_player", "Nie ma takiego gracza."));
            if (other.getId() == playerId) throw new GameException("self_buddy", "Nie możesz dodać samego siebie.");
            List<Buddy> mine = store.buddiesOf(playerId);
            if (mine.stream().anyMatch(b -> b.other(playerId) == other.getId())) {
                throw new GameException("buddy_exists", "Ten gracz jest już na liście lub czeka na odpowiedź.");
            }
            if (mine.size() >= MAX_BUDDIES) throw new GameException("buddy_limit", "Lista znajomych jest pełna.");
            String t = MessageService.clean(text, 500);
            store.save(new Buddy(store.nextId("buddy"), playerId, other.getId(), Buddy.Status.PENDING, t, now));
            mailer.system(other.getId(), Message.Type.SYSTEM, "Zaproszenie do znajomych",
                    "Gracz " + me.getUsername() + " chce dodać cię do znajomych." + (t.isEmpty() ? "" : " Wiadomość: " + t), now);
        });
    }

    public void respond(long playerId, long buddyId, boolean accept) {
        txRun(now -> {
            GameStore store = ctx.store();
            Buddy b = store.buddy(buddyId).filter(x -> x.addresseeId() == playerId && x.status() == Buddy.Status.PENDING)
                    .orElseThrow(() -> GameException.notFound("zaproszenie " + buddyId));
            Player me = ctx.requirePlayer(playerId);
            if (accept) store.save(b.accept());
            else store.deleteBuddy(b.id());
            mailer.system(b.requesterId(), Message.Type.SYSTEM, accept ? "Nowy znajomy" : "Zaproszenie odrzucone",
                    "Gracz " + me.getUsername() + (accept ? " przyjął" : " odrzucił") + " zaproszenie do znajomych.", now);
        });
    }

    public void remove(long playerId, long buddyId) {
        txRun(now -> {
            Buddy b = ctx.store().buddy(buddyId).filter(x -> x.involves(playerId))
                    .orElseThrow(() -> GameException.notFound("znajomy " + buddyId));
            ctx.store().deleteBuddy(b.id());
        });
    }
}
