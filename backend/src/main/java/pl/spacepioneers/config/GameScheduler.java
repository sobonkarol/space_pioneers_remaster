package pl.spacepioneers.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import pl.spacepioneers.game.service.Game;
import pl.spacepioneers.account.AccountTokens;
import pl.spacepioneers.security.LoginThrottle;
import pl.spacepioneers.security.RateLimitFilter;
import pl.spacepioneers.security.SessionService;

import java.util.List;

/**
 * Cykliczne zadania: obsluga zdarzen (powroty flot, konce budow - takze dla graczy offline),
 * przeliczanie rankingu i sprzatanie wygaslych sesji.
 */
@Component
@ConditionalOnProperty(prefix = "spacepioneers.scheduler", name = "enabled", havingValue = "true", matchIfMissing = true)
public class GameScheduler {

    private static final Logger log = LoggerFactory.getLogger(GameScheduler.class);

    private final Game game;
    private final SessionService sessions;
    private final AccountTokens tokens;
    private final LoginThrottle throttle;
    private final RateLimitFilter rateLimit;

    @org.springframework.beans.factory.annotation.Value("${spacepioneers.accounts.inactive-delete-days:0}")
    private int inactiveDeleteDays;

    public GameScheduler(Game game, SessionService sessions, AccountTokens tokens, LoginThrottle throttle,
                         RateLimitFilter rateLimit) {
        this.game = game;
        this.sessions = sessions;
        this.tokens = tokens;
        this.throttle = throttle;
        this.rateLimit = rateLimit;
    }

    @Scheduled(fixedDelayString = "${spacepioneers.scheduler.tick-ms:1000}")
    public void tick() {
        try {
            game.tick();
        } catch (RuntimeException e) {
            log.error("Blad obslugi zdarzen gry", e);
        }
    }

    @Scheduled(fixedDelayString = "${spacepioneers.scheduler.ranking-ms:300000}", initialDelay = 5000)
    public void ranking() {
        try {
            game.ranking().recompute();
        } catch (RuntimeException e) {
            log.error("Blad przeliczania rankingu", e);
        }
    }

    @Scheduled(fixedDelay = 3_600_000, initialDelay = 60_000)
    public void cleanupSessions() {
        sessions.deleteExpired();
        tokens.deleteExpired();
        throttle.deleteExpired();
        rateLimit.cleanup();
        try {
            int n = game.messages().purgeOld();
            if (n > 0) log.info("Usunieto stare wiadomosci: {}", n);
        } catch (RuntimeException e) {
            log.error("Blad usuwania starych wiadomosci", e);
        }
    }

    /** Usuwanie kont, ktorych 7-dniowy okres na rozmyslenie minal. */
    @Scheduled(fixedDelayString = "${spacepioneers.scheduler.deletion-ms:600000}", initialDelay = 30_000)
    public void purgeDeletedAccounts() {
        try {
            List<Long> ids = game.accounts().purgeDeleted();
            if (!ids.isEmpty()) log.info("Usunieto konta graczy: {}", ids);
            if (inactiveDeleteDays > 0) {
                List<Long> inactive = game.accounts().purgeInactive(java.time.Duration.ofDays(inactiveDeleteDays));
                if (!inactive.isEmpty()) log.info("Usunieto nieaktywne konta: {}", inactive);
            }
        } catch (RuntimeException e) {
            log.error("Blad usuwania kont", e);
        }
    }
}
