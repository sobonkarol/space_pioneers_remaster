package pl.spacepioneers.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import pl.spacepioneers.game.service.Game;
import pl.spacepioneers.security.SessionService;

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

    public GameScheduler(Game game, SessionService sessions) {
        this.game = game;
        this.sessions = sessions;
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
    }
}
