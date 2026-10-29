package pl.spacepioneers.game.service;

import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.Buddy;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.Player.AllianceRank;
import pl.spacepioneers.game.store.GameStore;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Konto gracza: potwierdzanie adresu e-mail, zmiana adresu, usuwanie konta (z 7-dniowym okresem
 * na rozmyslenie), wygasanie blokad. Tokeny i wysylka poczty sa w warstwie bezpieczenstwa.
 */
public final class AccountService extends ServiceBase {

    public static final Duration DELETION_DELAY = Duration.ofDays(7);
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final Mailer mailer;

    public AccountService(GameContext ctx, World world, Mailer mailer) {
        super(ctx, world);
        this.mailer = mailer;
    }

    public Optional<Player> byEmail(String email) {
        return ctx.store().inTransaction(() -> ctx.store().playerByEmail(email == null ? "" : email.trim().toLowerCase()));
    }

    public Player player(long playerId) {
        return ctx.store().inTransaction(() -> ctx.requirePlayer(playerId));
    }

    public void markEmailVerified(long playerId, String email) {
        txRun(now -> {
            Player p = ctx.requirePlayer(playerId);
            if (!p.getEmail().equalsIgnoreCase(email)) {
                // token wydany dla poprzedniego adresu - po zmianie adresu jest bezwartosciowy
                throw new GameException("token_invalid", "Link jest nieaktualny. Wyślij nowy z ustawień konta.");
            }
            p.setEmailVerified(true);
            ctx.store().save(p);
        });
    }

    public Player changeEmail(long playerId, String email) {
        return tx(now -> {
            String mail = email == null ? "" : email.trim().toLowerCase();
            if (!EMAIL.matcher(mail).matches()) {
                throw new GameException("invalid_email", "Nieprawidłowy adres e-mail.");
            }
            Player p = ctx.requirePlayer(playerId);
            if (mail.equalsIgnoreCase(p.getEmail())) {
                throw new GameException("same_email", "To jest Twój obecny adres.");
            }
            if (ctx.store().playerByEmail(mail).isPresent()) {
                throw new GameException(GameException.Kind.CONFLICT, "email_taken", "Ten adres e-mail jest już używany.");
            }
            p.setEmail(mail);
            p.setEmailVerified(false);
            ctx.store().save(p);
            return p;
        });
    }

    public Instant requestDeletion(long playerId) {
        return tx(now -> {
            Player p = ctx.requirePlayer(playerId);
            if (p.getDeletionAt() != null) {
                throw new GameException("deletion_pending", "Usunięcie konta jest już zaplanowane.");
            }
            p.setDeletionAt(now.plus(DELETION_DELAY));
            ctx.store().save(p);
            mailer.system(playerId, Message.Type.SYSTEM, "Usunięcie konta",
                    "Konto zostanie usunięte " + p.getDeletionAt() + ". Do tego czasu możesz anulować usunięcie w ustawieniach.", now);
            return p.getDeletionAt();
        });
    }

    public void cancelDeletion(long playerId) {
        txRun(now -> {
            Player p = ctx.requirePlayer(playerId);
            if (p.getDeletionAt() == null) {
                throw new GameException("no_deletion", "Usunięcie konta nie jest zaplanowane.");
            }
            p.setDeletionAt(null);
            ctx.store().save(p);
        });
    }

    /** Usuwa konta, ktorych termin usuniecia minal. Zwraca identyfikatory usunietych graczy. */
    public List<Long> purgeDeleted() {
        return tx(now -> {
            List<Long> ids = new ArrayList<>();
            for (Player p : ctx.store().players()) {
                if (p.getDeletionAt() != null && !p.getDeletionAt().isAfter(now)) {
                    deletePlayer(p, now);
                    ids.add(p.getId());
                }
            }
            return ids;
        });
    }

    /**
     * Usuwa konta nieaktywne dluzej niz {@code inactivity} (bez administratorow i kont w trybie urlopowym
     * ustawionym przez gracza). Zwraca identyfikatory usunietych graczy.
     */
    public List<Long> purgeInactive(Duration inactivity) {
        return tx(now -> {
            List<Long> ids = new ArrayList<>();
            Instant cutoff = now.minus(inactivity);
            for (Player p : ctx.store().players()) {
                boolean voluntaryVacation = p.inVacation() && !p.isBanVacation();
                if (!p.isAdmin() && !voluntaryVacation && p.getLastActivity() != null && p.getLastActivity().isBefore(cutoff)) {
                    deletePlayer(p, now);
                    ids.add(p.getId());
                }
            }
            return ids;
        });
    }

    /** Zdejmuje blokade po jej wygasnieciu (wywolywane przy logowaniu). Zwraca aktualny stan gracza. */
    public Player liftExpiredBan(long playerId) {
        return tx(now -> {
            Player p = ctx.requirePlayer(playerId);
            if (p.getBannedUntil() != null && !p.banned(now)) {
                clearBan(ctx, p, now);
                ctx.store().save(p);
            }
            return p;
        });
    }

    static void clearBan(GameContext ctx, Player p, Instant now) {
        if (p.isBanVacation() && p.inVacation()) {
            for (Planet planet : ctx.store().planetsOf(p.getId())) {
                planet.setLastUpdate(now); // w czasie blokady planety nie produkowaly
                ctx.store().save(planet);
            }
            p.setVacationUntil(null);
        }
        p.setBanVacation(false);
        p.setBannedUntil(null);
        p.setBanReason(null);
    }

    /**
     * Trwale usuwa gracza: planety i ksiezyce, floty, wiadomosci, znajomych, zgloszenia, zwiazki ataku.
     * Zalozyciel sojuszu przekazuje go najsilniejszemu oficerowi (albo czlonkowi); pusty sojusz jest rozwiazywany.
     */
    void deletePlayer(Player p, Instant now) {
        GameStore store = ctx.store();
        long id = p.getId();
        if (p.getAllianceId() != null) {
            long allianceId = p.getAllianceId();
            List<Player> rest = store.playersOfAlliance(allianceId).stream().filter(m -> m.getId() != id).toList();
            if (rest.isEmpty()) {
                store.applications(allianceId).forEach(x -> store.deleteApplication(x.id()));
                store.treaties(allianceId).forEach(t -> store.deleteTreaty(t.id()));
                store.deleteAlliance(allianceId);
            } else if (p.getAllianceRank() == AllianceRank.FOUNDER) {
                Player heir = rest.stream()
                        .sorted(Comparator.comparing((Player m) -> m.getAllianceRank() == AllianceRank.OFFICER ? 0 : 1)
                                .thenComparing(m -> -m.getScore().total()))
                        .findFirst().orElseThrow();
                heir.setAllianceRank(AllianceRank.FOUNDER);
                store.save(heir);
                mailer.system(heir.getId(), Message.Type.ALLIANCE, "Przejęcie sojuszu",
                        "Założyciel usunął konto - zostajesz nowym założycielem sojuszu.", now);
            }
        }
        store.applicationOf(id).ifPresent(a -> store.deleteApplication(a.id()));
        for (Buddy b : store.buddiesOf(id)) store.deleteBuddy(b.id());
        store.unions().stream().filter(u -> u.ownerId() == id).forEach(u -> store.deleteUnion(u.id()));
        store.fleetsOf(id).forEach(f -> store.deleteFleet(f.getId()));
        store.planetsOf(id).forEach(pl -> store.deletePlanet(pl.getId()));
        store.deletePlayer(id);
    }
}
