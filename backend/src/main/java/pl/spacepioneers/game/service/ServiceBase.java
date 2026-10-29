package pl.spacepioneers.game.service;

import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;

import java.time.Instant;
import java.util.function.Function;

/** Wspolna obsluga transakcji: kazda operacja najpierw dogania stan swiata do biezacej chwili. */
abstract class ServiceBase {

    protected final GameContext ctx;
    protected final World world;

    protected ServiceBase(GameContext ctx, World world) {
        this.ctx = ctx;
        this.world = world;
    }

    protected <T> T tx(Function<Instant, T> work) {
        return ctx.store().inTransaction(() -> {
            Instant now = ctx.now();
            world.catchUp(now);
            return work.apply(now);
        });
    }

    /**
     * Odczyt bez globalnej blokady: gdy nie ma zaleglych zdarzen, stan w bazie jest aktualny i mozna go czytac
     * rownolegle. W przeciwnym razie zwykla transakcja z dogonieniem swiata. Praca nie moze niczego zapisywac.
     */
    protected <T> T read(Function<Instant, T> work) {
        Instant now = ctx.now();
        Object[] result = new Object[1];
        boolean done = ctx.store().readOnly(() -> {
            if (ctx.store().nextDueEvent(now).isPresent()) return false;
            result[0] = work.apply(now);
            return true;
        });
        if (done) {
            @SuppressWarnings("unchecked")
            T value = (T) result[0];
            return value;
        }
        return tx(work);
    }

    protected void txRun(java.util.function.Consumer<Instant> work) {
        tx(now -> {
            work.accept(now);
            return null;
        });
    }

    /** Wczytuje planete gracza i nalicza jej produkcje do teraz. */
    protected Planet ownPlanet(long playerId, long planetId, Instant now) {
        Planet planet = ctx.requireOwnPlanet(playerId, planetId);
        return world.advance(planet, now);
    }

    protected static void pay(Planet planet, Resources cost) {
        if (!planet.getResources().covers(cost)) {
            throw new GameException("not_enough_resources", "Za mało surowców.");
        }
        planet.setResources(planet.getResources().minus(cost));
    }

    protected static void requireActive(Player player) {
        if (player.inVacation()) {
            throw new GameException("vacation_mode", "W trybie urlopowym ta akcja jest niedostępna.");
        }
    }
}
