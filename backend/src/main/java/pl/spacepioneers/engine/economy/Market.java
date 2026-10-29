package pl.spacepioneers.engine.economy;

import pl.spacepioneers.engine.common.Branch;
import pl.spacepioneers.engine.common.ResourceType;

/**
 * Rynek handlowy dostepny dla specjalizacji handlarza (wymaga Centrum handlowego).
 * Kursy wartosci: metal 3, krysztal 2, tryt 1 (jednostka trytu jest najcenniejsza).
 */
public final class Market {

    public static final String TRADE_CENTER = "trade_center";

    private Market() {
    }

    public static double valueRatio(ResourceType t) {
        return switch (t) {
            case METAL -> 1.0 / 3;
            case CRYSTAL -> 1.0 / 2;
            case TRITIUM -> 1.0;
        };
    }

    /** Prowizja rynku: 10% minus 0,5 pp. za kazdy poziom Centrum handlowego, minimum 5%. */
    public static double fee(int tradeCenterLevel) {
        return Math.max(0.05, 0.10 - 0.005 * tradeCenterLevel);
    }

    public static boolean available(Branch branch, int tradeCenterLevel) {
        return branch == Branch.TRADER && tradeCenterLevel >= 1;
    }

    /** Ile otrzymamy surowca {@code to} za {@code amount} surowca {@code from}. */
    public static long exchange(ResourceType from, ResourceType to, long amount, int tradeCenterLevel) {
        if (from == to) {
            throw new IllegalArgumentException("Nie mozna wymienic surowca na ten sam");
        }
        if (amount <= 0) {
            throw new IllegalArgumentException("Ilosc musi byc dodatnia");
        }
        double value = amount * valueRatio(from);
        double received = value / valueRatio(to) * (1 - fee(tradeCenterLevel));
        return (long) Math.floor(received);
    }
}
