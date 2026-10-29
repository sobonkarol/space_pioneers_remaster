package pl.spacepioneers.engine.special;

import pl.spacepioneers.engine.common.Resources;

/** Powstawanie ksiezycow i zasieg falangi czujnikowej. */
public final class Moons {

    public static final double DEBRIS_PER_PERCENT = 100_000;
    public static final int MAX_CHANCE_PERCENT = 20;
    public static final int MOON_BASE_FIELDS = 1;
    public static final long PHALANX_SCAN_COST = 5_000;
    public static final long JUMP_GATE_COOLDOWN_SECONDS = 3_600;

    private Moons() {
    }

    /** Szansa (procent) na powstanie ksiezyca z pola zniszczen powstalego w walce: 1% za kazde 100 000 surowcow. */
    public static int chancePercent(Resources debris) {
        return (int) Math.min(MAX_CHANCE_PERCENT, Math.floor((debris.metal() + debris.crystal()) / DEBRIS_PER_PERCENT));
    }

    /** Zasieg falangi w systemach: poziom^2 - 1. */
    public static int phalanxRange(int level) {
        return level <= 0 ? -1 : level * level - 1;
    }
}
