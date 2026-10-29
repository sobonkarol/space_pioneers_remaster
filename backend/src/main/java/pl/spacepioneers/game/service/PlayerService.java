package pl.spacepioneers.game.service;

import pl.spacepioneers.engine.Rules;
import pl.spacepioneers.engine.common.Branch;
import pl.spacepioneers.engine.common.Coordinates;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.common.UniverseConfig;
import pl.spacepioneers.engine.economy.PlanetGenerator;
import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.Fleet;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.store.GameStore;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.regex.Pattern;

/** Rejestracja, profil, specjalizacja, tryb urlopowy. */
public final class PlayerService extends ServiceBase {

    public static final Resources START_RESOURCES = Resources.of(500, 500, 0);
    public static final Duration VACATION_MINIMUM = Duration.ofHours(48);
    private static final Pattern USERNAME = Pattern.compile("^[\\p{L}\\p{N}_.-]{3,20}$");
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final Mailer mailer;

    public PlayerService(GameContext ctx, World world, Mailer mailer) {
        super(ctx, world);
        this.mailer = mailer;
    }

    public record Profile(long id, String username, String email, String branch, boolean canChooseBranch,
                          boolean vacation, Instant vacationMinimumEnd, String language, double points, int rank,
                          Long allianceId, String allianceRank, long homePlanetId, boolean admin) {
    }

    /**
     * Tworzy konto i planete macierzysta. {@code passwordHash} jest juz zahashowane przez warstwe bezpieczenstwa.
     */
    public Player register(String username, String email, String passwordHash) {
        return tx(now -> {
            String name = username == null ? "" : username.trim();
            String mail = email == null ? "" : email.trim().toLowerCase();
            if (!USERNAME.matcher(name).matches()) {
                throw new GameException("invalid_username", "Nazwa gracza: 3-20 znaków (litery, cyfry, _ . -).");
            }
            if (!EMAIL.matcher(mail).matches()) {
                throw new GameException("invalid_email", "Nieprawidłowy adres e-mail.");
            }
            GameStore store = ctx.store();
            if (store.playerByName(name).isPresent()) {
                throw new GameException(GameException.Kind.CONFLICT, "username_taken", "Ta nazwa gracza jest zajęta.");
            }
            if (store.playerByEmail(mail).isPresent()) {
                throw new GameException(GameException.Kind.CONFLICT, "email_taken", "Ten adres e-mail jest już używany.");
            }
            Player player = new Player(store.nextId("player"), name, mail, passwordHash, now);
            Coordinates home = findHomePosition(ctx.random());
            Planet planet = new Planet();
            planet.setId(store.nextId("planet"));
            planet.setOwnerId(player.getId());
            planet.setName("Planeta macierzysta");
            planet.setCoordinates(home);
            PlanetGenerator.PlanetTraits traits = PlanetGenerator.homeworld(home.position(), ctx.random());
            planet.setFields(traits.fields());
            planet.setTemperatureMin(traits.temperatureMin());
            planet.setTemperatureMax(traits.temperatureMax());
            planet.setPlanetType(PlanetGenerator.planetType(home.position()));
            planet.setImageVariant(traits.imageVariant());
            planet.setHomeworld(true);
            planet.setResources(START_RESOURCES);
            planet.setCreatedAt(now);
            planet.setLastUpdate(now);
            player.setHomePlanetId(planet.getId());
            if (store.players().isEmpty()) {
                player.setAdmin(true); // pierwszy gracz serwera zostaje administratorem
            }
            store.save(player); // najpierw gracz - planeta odwoluje sie do niego kluczem obcym
            store.save(planet);
            mailer.system(player.getId(), Message.Type.SYSTEM, "Witaj w Space Pioneers!",
                    "Twoja planeta macierzysta znajduje się na pozycji [" + home + "]. Zacznij od rozbudowy kopalni "
                            + "metalu, kopalni kryształu i elektrowni słonecznej.", now);
            return player;
        });
    }

    /**
     * Wybiera pozycje dla nowego gracza: losowy system z najmniejszym zageszczeniem sposrod probki,
     * pozycja 4-12 (planety umiarkowane).
     */
    Coordinates findHomePosition(Random rnd) {
        UniverseConfig cfg = ctx.config();
        GameStore store = ctx.store();
        Coordinates best = null;
        int bestCount = Integer.MAX_VALUE;
        for (int attempt = 0; attempt < 40; attempt++) {
            int g = 1 + rnd.nextInt(cfg.galaxies());
            int s = 1 + rnd.nextInt(cfg.systems());
            List<Planet> inSystem = store.planetsInSystem(g, s);
            List<Integer> free = new ArrayList<>();
            int lo = Math.min(4, cfg.positions());
            int hi = Math.min(12, cfg.positions());
            for (int p = lo; p <= hi; p++) {
                final int pos = p;
                if (inSystem.stream().noneMatch(x -> x.getPosition() == pos)) free.add(p);
            }
            if (free.isEmpty()) continue;
            if (inSystem.size() < bestCount) {
                bestCount = inSystem.size();
                best = new Coordinates(g, s, free.get(rnd.nextInt(free.size())));
                if (bestCount == 0) break;
            }
        }
        if (best == null) {
            // pelne przeszukanie (galaktyka prawie pelna)
            for (int g = 1; g <= cfg.galaxies(); g++) {
                for (int s = 1; s <= cfg.systems(); s++) {
                    for (int p = 1; p <= cfg.positions(); p++) {
                        Coordinates c = new Coordinates(g, s, p);
                        if (store.planetAt(c).isEmpty()) return c;
                    }
                }
            }
            throw new GameException("universe_full", "Galaktyka jest pełna.");
        }
        return best;
    }

    public Profile profile(long playerId) {
        return tx(now -> toProfile(ctx.requirePlayer(playerId)));
    }

    private Profile toProfile(Player p) {
        return new Profile(p.getId(), p.getUsername(), p.getEmail(), p.getBranch().name(),
                p.getBranch() == Branch.NONE && p.getScore().total() >= Rules.BRANCH_MIN_POINTS,
                p.inVacation(), p.getVacationUntil(), p.getLanguage(), Math.floor(p.getScore().total()), p.getRank(),
                p.getAllianceId(), p.getAllianceRank() == null ? null : p.getAllianceRank().name(),
                p.getHomePlanetId(), p.isAdmin());
    }

    /** Aktualizuje czas ostatniej aktywnosci (co najwyzej raz na minute, aby ograniczyc zapisy). */
    public void touch(long playerId) {
        ctx.store().inTransaction(() -> {
            Instant now = ctx.now();
            ctx.store().player(playerId).ifPresent(p -> {
                if (p.getLastActivity() == null || Duration.between(p.getLastActivity(), now).getSeconds() >= 60) {
                    p.setLastActivity(now);
                    ctx.store().save(p);
                }
            });
        });
    }

    public Profile chooseBranch(long playerId, Branch branch) {
        return tx(now -> {
            Player p = ctx.requirePlayer(playerId);
            if (branch == null || branch == Branch.NONE) {
                throw new GameException("invalid_branch", "Wybierz handlarza albo wojownika.");
            }
            if (p.getBranch() != Branch.NONE) {
                throw new GameException("branch_chosen", "Specjalizacja została już wybrana.");
            }
            if (p.getScore().total() < Rules.BRANCH_MIN_POINTS) {
                throw new GameException("branch_points", "Specjalizację można wybrać od " + Rules.BRANCH_MIN_POINTS + " punktów.");
            }
            p.setBranch(branch);
            ctx.store().save(p);
            return toProfile(p);
        });
    }

    public Profile enableVacation(long playerId) {
        return tx(now -> {
            Player p = ctx.requirePlayer(playerId);
            if (p.inVacation()) {
                throw new GameException("already_vacation", "Tryb urlopowy jest już aktywny.");
            }
            List<Fleet> fleets = ctx.store().fleetsOf(playerId);
            if (!fleets.isEmpty()) {
                throw new GameException("fleets_in_flight", "Nie można włączyć urlopu, gdy floty są w locie.");
            }
            if (!ctx.store().fleetsTargeting(playerId).isEmpty()) {
                throw new GameException("incoming_fleets", "Nie można włączyć urlopu, gdy zbliżają się obce floty.");
            }
            for (Planet planet : ctx.store().planetsOf(playerId)) {
                if (!planet.getBuildQueue().isEmpty() || !planet.getShipyardQueue().isEmpty()) {
                    throw new GameException("queues_active", "Najpierw zakończ budowy i produkcję w stoczni.");
                }
                // naliczenie produkcji do chwili wlaczenia urlopu
                world.advance(planet, p, now);
                ctx.store().save(planet);
            }
            if (p.getResearchJob() != null) {
                throw new GameException("research_running", "Najpierw zakończ badanie.");
            }
            p.setVacationUntil(now.plus(VACATION_MINIMUM));
            ctx.store().save(p);
            return toProfile(p);
        });
    }

    public Profile disableVacation(long playerId) {
        return tx(now -> {
            Player p = ctx.requirePlayer(playerId);
            if (!p.inVacation()) {
                throw new GameException("no_vacation", "Tryb urlopowy nie jest aktywny.");
            }
            if (now.isBefore(p.getVacationUntil())) {
                throw new GameException("vacation_minimum", "Urlop trwa minimum 48 godzin.");
            }
            // planety nie produkowaly w trakcie urlopu - przesuwamy znacznik czasu bez naliczania
            for (Planet planet : ctx.store().planetsOf(playerId)) {
                planet.setLastUpdate(now);
                ctx.store().save(planet);
            }
            p.setVacationUntil(null);
            ctx.store().save(p);
            return toProfile(p);
        });
    }

    public Profile setLanguage(long playerId, String language) {
        return tx(now -> {
            if (!List.of("pl", "en", "de", "fr", "it", "es").contains(language)) {
                throw new GameException("invalid_language", "Nieobsługiwany język.");
            }
            Player p = ctx.requirePlayer(playerId);
            p.setLanguage(language);
            ctx.store().save(p);
            return toProfile(p);
        });
    }

    /** Dane logowania dla warstwy bezpieczenstwa. */
    public java.util.Optional<Player> findForLogin(String usernameOrEmail) {
        return ctx.store().inTransaction(() -> {
            String v = usernameOrEmail == null ? "" : usernameOrEmail.trim();
            return v.contains("@") ? ctx.store().playerByEmail(v.toLowerCase()) : ctx.store().playerByName(v);
        });
    }

    public void changePasswordHash(long playerId, String newHash) {
        txRun(now -> {
            Player p = ctx.requirePlayer(playerId);
            p.setPasswordHash(newHash);
            ctx.store().save(p);
        });
    }
}
