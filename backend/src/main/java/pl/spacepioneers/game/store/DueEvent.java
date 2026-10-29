package pl.spacepioneers.game.store;

import java.time.Instant;
import java.util.Comparator;

/**
 * Zdarzenie do obsluzenia: zakonczenie budowy na planecie, zakonczenie badania gracza
 * albo przylot/powrot floty.
 */
public record DueEvent(Type type, long id, Instant at) {

    public enum Type { BUILDING, RESEARCH, FLEET }

    public static final Comparator<DueEvent> ORDER = Comparator
            .comparing(DueEvent::at)
            .thenComparing(DueEvent::type)
            .thenComparingLong(DueEvent::id);
}
