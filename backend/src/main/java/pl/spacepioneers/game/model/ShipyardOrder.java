package pl.spacepioneers.game.model;

import java.time.Instant;

/**
 * Zlecenie stoczni: {@code count} sztuk jednostki, kazda budowana {@code secondsPerUnit} sekund.
 * {@code progressStart} to moment rozpoczecia budowy pierwszej nieukonczonej sztuki.
 */
public record ShipyardOrder(long id, String unit, long count, long done, long secondsPerUnit, Instant progressStart) {

    public long remaining() {
        return count - done;
    }

    public Instant finishAt() {
        return progressStart == null ? null : progressStart.plusSeconds(secondsPerUnit * remaining());
    }
}
