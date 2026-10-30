package pl.spacepioneers.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import pl.spacepioneers.engine.common.UniverseConfig;
import pl.spacepioneers.engine.data.GameData;
import pl.spacepioneers.game.service.Game;
import pl.spacepioneers.game.service.PlayerService;
import pl.spacepioneers.game.service.GameContext;
import pl.spacepioneers.game.store.GameStore;
import pl.spacepioneers.infra.JdbcGameStore;

import java.time.Clock;

@Configuration
public class GameConfiguration {

    @Bean
    public GameData gameData() {
        return GameData.loadDefault();
    }

    @Bean
    public UniverseConfig universeConfig(UniverseProperties props) {
        return props.toConfig();
    }

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    public GameStore gameStore(JdbcTemplate jdbc, PlatformTransactionManager tx) {
        return new JdbcGameStore(jdbc, tx);
    }

    @Bean
    public Game game(GameStore store, GameData data, UniverseConfig config, Clock clock, UniverseProperties props) {
        Game game = new Game(GameContext.withSecureRandom(store, data, config, clock));
        game.players().setStartResources(props.startResourcesOrDefault(PlayerService.START_RESOURCES));
        return game;
    }
}
