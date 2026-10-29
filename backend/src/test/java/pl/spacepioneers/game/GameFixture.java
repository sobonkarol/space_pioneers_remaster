package pl.spacepioneers.game;

import pl.spacepioneers.engine.common.Coordinates;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.common.UniverseConfig;
import pl.spacepioneers.engine.data.GameData;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.Score;
import pl.spacepioneers.game.service.Game;
import pl.spacepioneers.game.service.GameContext;
import pl.spacepioneers.game.store.GameStore;
import pl.spacepioneers.game.store.InMemoryGameStore;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/** Srodowisko testowe: gra na magazynie w pamieci ze sterowanym zegarem i deterministycznym RNG. */
public class GameFixture {

    public static final GameData DATA = GameData.loadDefault();

    public final MutableClock clock = new MutableClock(Instant.parse("2026-01-01T12:00:00Z"));
    public final GameStore store;
    public final UniverseConfig config = new UniverseConfig(2, 20, 15, 1.0, 1.0, 1.0, 0.3, 0.7, 0.5, 6, 5000, 5.0);
    private final AtomicLong seeds = new AtomicLong(1234);
    public final Game game;

    public GameFixture() {
        this(new InMemoryGameStore());
    }

    public GameFixture(GameStore store) {
        this.store = store;
        this.game = new Game(new GameContext(store, DATA, config, clock, seeds::incrementAndGet));
    }

    public static final class MutableClock extends Clock {
        private Instant now;

        public MutableClock(Instant start) {
            this.now = start;
        }

        public void advance(Duration d) {
            now = now.plus(d);
        }

        public void advanceSeconds(long s) {
            advance(Duration.ofSeconds(s));
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    public Player register(String name) {
        return game.players().register(name, name.toLowerCase() + "@example.com", "{noop}x");
    }

    public Player player(long id) {
        return store.player(id).orElseThrow();
    }

    public Planet home(Player p) {
        return store.planet(player(p.getId()).getHomePlanetId()).orElseThrow();
    }

    public void editPlanet(long planetId, Consumer<Planet> edit) {
        store.inTransaction(() -> {
            Planet p = store.planet(planetId).orElseThrow();
            edit.accept(p);
            store.save(p);
        });
    }

    public void editPlayer(long playerId, Consumer<Player> edit) {
        store.inTransaction(() -> {
            Player p = store.player(playerId).orElseThrow();
            edit.accept(p);
            store.save(p);
        });
    }

    public void giveResources(long planetId, double m, double c, double t) {
        editPlanet(planetId, p -> p.setResources(p.getResources().plus(Resources.of(m, c, t))));
    }

    public void setBuildings(long planetId, Map<String, Integer> levels) {
        editPlanet(planetId, p -> p.getBuildings().putAll(levels));
    }

    public void setUnits(long planetId, Map<String, Long> units) {
        editPlanet(planetId, p -> units.forEach((k, v) -> p.getUnits().put(k, v)));
    }

    public void setResearch(long playerId, Map<String, Integer> levels) {
        editPlayer(playerId, p -> p.getResearch().putAll(levels));
    }

    public void setPoints(long playerId, double points) {
        editPlayer(playerId, p -> p.setScore(new Score(points, 0, 0, 0)));
    }

    /** Przenosi planete na wskazane wspolrzedne (do testow lotow na znane odleglosci). */
    public void moveTo(long planetId, String coords) {
        editPlanet(planetId, p -> p.setCoordinates(Coordinates.parse(coords)));
    }

    public void advance(Duration d) {
        clock.advance(d);
        game.tick();
    }
}
