package pl.spacepioneers.game.service;

import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.Fleet;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** Panel administratora: statystyki serwera, wyszukiwanie graczy, blokady, uprawnienia, ogloszenia. */
public final class AdminService extends ServiceBase {

    /** Blokada "na zawsze". */
    public static final Instant PERMANENT = Instant.parse("9999-12-31T00:00:00Z");
    public static final int MAX_RESULTS = 100;

    private final Mailer mailer;
    private final AccountService accounts;

    public AdminService(GameContext ctx, World world, Mailer mailer, AccountService accounts) {
        super(ctx, world);
        this.mailer = mailer;
        this.accounts = accounts;
    }

    public record ServerStats(int players, int bots, int online15m, int active24h, int banned, int pendingDeletion,
                              int unverified, int planets, int moons, int fleetsInFlight, int alliances, Instant now) {
    }

    public record PlayerRow(long id, String username, String email, boolean emailVerified, boolean admin,
                            double points, int rank, Instant createdAt, Instant lastActivity, Instant bannedUntil,
                            String banReason, boolean vacation, Instant deletionAt, String allianceTag, int planets,
                            String bot) {
    }

    public record PlanetRow(long id, String name, String coordinates, boolean moon, int fieldsUsed, int fields) {
    }

    public record PlayerDetail(PlayerRow player, List<PlanetRow> planets, int fleetsInFlight) {
    }

    private Player requireAdmin(long adminId) {
        Player admin = ctx.requirePlayer(adminId);
        if (!admin.isAdmin()) {
            throw new GameException(GameException.Kind.FORBIDDEN, "not_admin", "Brak uprawnień administratora.");
        }
        return admin;
    }

    private Player requireTarget(Player admin, long targetId, boolean allowSelf) {
        Player target = ctx.store().player(targetId)
                .orElseThrow(() -> new GameException(GameException.Kind.NOT_FOUND, "player_not_found", "Nie ma takiego gracza."));
        if (!allowSelf && target.getId() == admin.getId()) {
            throw new GameException("self_action", "Tej akcji nie można wykonać na własnym koncie.");
        }
        return target;
    }

    public ServerStats stats(long adminId) {
        return tx(now -> {
            requireAdmin(adminId);
            List<Player> players = ctx.store().players();
            List<Planet> planets = ctx.store().allPlanets();
            int moons = (int) planets.stream().filter(Planet::isMoon).count();
            return new ServerStats(players.size(), (int) players.stream().filter(Player::isBot).count(),
                    (int) players.stream().filter(p -> active(p, now, Duration.ofMinutes(15))).count(),
                    (int) players.stream().filter(p -> active(p, now, Duration.ofHours(24))).count(),
                    (int) players.stream().filter(p -> p.banned(now)).count(),
                    (int) players.stream().filter(p -> p.getDeletionAt() != null).count(),
                    (int) players.stream().filter(p -> !p.isEmailVerified()).count(),
                    planets.size() - moons, moons,
                    (int) ctx.store().allFleets().stream().filter(f -> f.getStatus() != Fleet.Status.HOLDING).count(),
                    ctx.store().alliances().size(), now);
        });
    }

    private static boolean active(Player p, Instant now, Duration window) {
        return p.getLastActivity() != null && p.getLastActivity().isAfter(now.minus(window));
    }

    /** Wyszukiwanie po nazwie lub adresie e-mail (fragment, bez rozrozniania wielkosci liter). */
    public List<PlayerRow> search(long adminId, String query) {
        return tx(now -> {
            requireAdmin(adminId);
            String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
            return ctx.store().players().stream()
                    .filter(p -> q.isEmpty() || p.getUsername().toLowerCase(Locale.ROOT).contains(q)
                            || p.getEmail().toLowerCase(Locale.ROOT).contains(q))
                    .sorted(Comparator.comparing(Player::getUsername, String.CASE_INSENSITIVE_ORDER))
                    .limit(MAX_RESULTS)
                    .map(p -> row(p, now))
                    .toList();
        });
    }

    public PlayerDetail detail(long adminId, long playerId) {
        return tx(now -> {
            Player admin = requireAdmin(adminId);
            Player p = requireTarget(admin, playerId, true);
            List<PlanetRow> planets = ctx.store().planetsOf(p.getId()).stream()
                    .sorted(Comparator.comparing((Planet x) -> x.coordinates().toString()).thenComparing(Planet::isMoon))
                    .map(x -> {
                        var snap = x.snapshot();
                        return new PlanetRow(x.getId(), x.getName(), x.coordinates().toString(), x.isMoon(),
                                pl.spacepioneers.engine.economy.Economy.usedFields(snap), ctx.economy().maxFields(snap));
                    })
                    .toList();
            return new PlayerDetail(row(p, now), planets, ctx.store().fleetsOf(p.getId()).size());
        });
    }

    private PlayerRow row(Player p, Instant now) {
        String tag = p.getAllianceId() == null ? null
                : ctx.store().alliance(p.getAllianceId()).map(a -> a.getTag()).orElse(null);
        return new PlayerRow(p.getId(), p.getUsername(), p.getEmail(), p.isEmailVerified(), p.isAdmin(),
                Math.floor(p.getScore().total()), p.getRank(), p.getCreatedAt(), p.getLastActivity(),
                p.banned(now) ? p.getBannedUntil() : null, p.banned(now) ? p.getBanReason() : null,
                p.inVacation(), p.getDeletionAt(), tag, ctx.store().planetsOf(p.getId()).size(),
                p.isBot() ? p.getBot().getPersonality().name() : null);
    }

    /**
     * Blokuje konto do {@code until} (albo na stale, gdy {@code hours == null}). Zablokowany gracz nie moze sie
     * zalogowac, a jego planety sa w wymuszonym trybie urlopowym (bez produkcji, bez atakow).
     */
    public PlayerRow ban(long adminId, long targetId, Integer hours, String reason) {
        return tx(now -> {
            Player admin = requireAdmin(adminId);
            Player p = requireTarget(admin, targetId, false);
            if (p.isAdmin()) {
                throw new GameException("target_admin", "Najpierw odbierz graczowi uprawnienia administratora.");
            }
            String why = reason == null ? "" : reason.trim();
            if (why.isEmpty() || why.length() > 200) {
                throw new GameException("invalid_reason", "Podaj powód blokady (do 200 znaków).");
            }
            if (hours != null && (hours < 1 || hours > 24 * 365)) {
                throw new GameException("invalid_duration", "Czas blokady: od 1 godziny do 365 dni.");
            }
            Instant until = hours == null ? PERMANENT : now.plus(Duration.ofHours(hours));
            if (!p.inVacation()) {
                for (Planet planet : ctx.store().planetsOf(p.getId())) {
                    world.advance(planet, p, now); // produkcja do chwili blokady
                    ctx.store().save(planet);
                }
                p.setVacationUntil(until);
                p.setBanVacation(true);
            }
            p.setBannedUntil(until);
            p.setBanReason(why);
            ctx.store().save(p);
            mailer.system(p.getId(), Message.Type.SYSTEM, "Konto zablokowane",
                    "Konto zostało zablokowane " + (hours == null ? "na stałe" : "do " + until) + ". Powód: " + why, now);
            return row(p, now);
        });
    }

    public PlayerRow unban(long adminId, long targetId) {
        return tx(now -> {
            Player admin = requireAdmin(adminId);
            Player p = requireTarget(admin, targetId, false);
            if (p.getBannedUntil() == null) {
                throw new GameException("not_banned", "Gracz nie jest zablokowany.");
            }
            AccountService.clearBan(ctx, p, now);
            ctx.store().save(p);
            mailer.system(p.getId(), Message.Type.SYSTEM, "Blokada zdjęta", "Blokada konta została zdjęta.", now);
            return row(p, now);
        });
    }

    public PlayerRow setAdmin(long adminId, long targetId, boolean value) {
        return tx(now -> {
            Player admin = requireAdmin(adminId);
            Player p = requireTarget(admin, targetId, false);
            if (value && p.banned(now)) {
                throw new GameException("target_banned", "Nie można nadać uprawnień zablokowanemu graczowi.");
            }
            p.setAdmin(value);
            ctx.store().save(p);
            return row(p, now);
        });
    }

    /** Natychmiastowe usuniecie konta (np. multikonto). */
    public String deleteNow(long adminId, long targetId) {
        return tx(now -> {
            Player admin = requireAdmin(adminId);
            Player p = requireTarget(admin, targetId, false);
            if (p.isAdmin()) {
                throw new GameException("target_admin", "Najpierw odbierz graczowi uprawnienia administratora.");
            }
            accounts.deletePlayer(p, now);
            return p.getUsername();
        });
    }

    /** Ogloszenie systemowe do wszystkich graczy. Zwraca liczbe adresatow. */
    public int announce(long adminId, String subject, String body) {
        return tx(now -> {
            Player admin = requireAdmin(adminId);
            String s = subject == null ? "" : subject.trim();
            String b = body == null ? "" : body.trim();
            if (s.isEmpty() || s.length() > 200 || b.isEmpty() || b.length() > 5000) {
                throw new GameException("invalid_message", "Temat (do 200 znaków) i treść (do 5000 znaków) są wymagane.");
            }
            int n = 0;
            for (Player p : ctx.store().players()) {
                mailer.send(p.getId(), admin.getId(), "Administracja", Message.Type.SYSTEM, s, b, null, now);
                n++;
            }
            return n;
        });
    }
}
