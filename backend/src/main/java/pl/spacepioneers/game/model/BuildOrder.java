package pl.spacepioneers.game.model;

import pl.spacepioneers.engine.common.Resources;

import java.time.Instant;

/**
 * Pozycja kolejki budowy. Koszt pobierany jest przy dodaniu do kolejki; czas liczony jest
 * dopiero w chwili rozpoczecia (aby uwzglednic ukonczone wczesniej fabryki robotow).
 *
 * @param demolish true = rozbiorka (poziom w dol)
 * @param start    null, dopoki pozycja czeka w kolejce
 */
public record BuildOrder(long id, String building, int level, boolean demolish, Resources cost, Instant start, Instant end) {

    public boolean started() {
        return start != null;
    }

    public BuildOrder startAt(Instant start, long seconds) {
        return new BuildOrder(id, building, level, demolish, cost, start, start.plusSeconds(seconds));
    }
}
