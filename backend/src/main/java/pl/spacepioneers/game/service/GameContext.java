package pl.spacepioneers.game.service;

import pl.spacepioneers.engine.combat.CombatEngine;
import pl.spacepioneers.engine.common.UniverseConfig;
import pl.spacepioneers.engine.data.GameData;
import pl.spacepioneers.engine.economy.Economy;
import pl.spacepioneers.engine.economy.Points;
import pl.spacepioneers.engine.economy.Timing;
import pl.spacepioneers.engine.fleet.FleetMath;
import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.store.GameStore;

import java.time.Clock;
import java.time.Instant;
import java.util.Random;
import java.util.function.LongSupplier;

/** Wspolne zaleznosci serwisow gry. */
public final class GameContext {

    private final GameStore store;
    private final GameData data;
    private final UniverseConfig config;
    private final Clock clock;
    private final LongSupplier seeds;
    private final Economy economy;
    private final Timing timing;
    private final FleetMath fleetMath;
    private final CombatEngine combat;
    private final Points points;

    public GameContext(GameStore store, GameData data, UniverseConfig config, Clock clock, LongSupplier seeds) {
        this.store = store;
        this.data = data;
        this.config = config;
        this.clock = clock;
        this.seeds = seeds;
        this.economy = new Economy(data, config);
        this.timing = new Timing(config);
        this.fleetMath = new FleetMath(data, config);
        this.combat = new CombatEngine(data, config);
        this.points = new Points(data);
    }

    public static GameContext withSecureRandom(GameStore store, GameData data, UniverseConfig config, Clock clock) {
        java.security.SecureRandom r = new java.security.SecureRandom();
        return new GameContext(store, data, config, clock, r::nextLong);
    }

    /** Czas jest obcinany do sekund - wszystkie zdarzenia gry maja rozdzielczosc sekundowa. */
    public Instant now() {
        return clock.instant().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
    }

    public Random random() {
        return new Random(seeds.getAsLong());
    }

    public long seed() {
        return seeds.getAsLong();
    }

    public Player requirePlayer(long id) {
        return store.player(id).orElseThrow(() -> GameException.notFound("gracz " + id));
    }

    /** Planeta nalezaca do gracza (inaczej NOT_FOUND - nie zdradzamy istnienia cudzych planet). */
    public Planet requireOwnPlanet(long playerId, long planetId) {
        Planet p = store.planet(planetId).orElseThrow(() -> GameException.notFound("planeta " + planetId));
        if (p.getOwnerId() != playerId) {
            throw GameException.notFound("planeta " + planetId);
        }
        return p;
    }

    public GameStore store() { return store; }
    public GameData data() { return data; }
    public UniverseConfig config() { return config; }
    public Economy economy() { return economy; }
    public Timing timing() { return timing; }
    public FleetMath fleetMath() { return fleetMath; }
    public CombatEngine combat() { return combat; }
    public Points points() { return points; }
}
