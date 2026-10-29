package pl.spacepioneers.engine;

import pl.spacepioneers.engine.common.Branch;
import pl.spacepioneers.engine.common.UniverseConfig;

/** Zasady ogolne niezwiazane z konkretnym podsystemem. */
public final class Rules {

    /** Minimalna liczba punktow, od ktorej mozna wybrac specjalizacje. */
    public static final long BRANCH_MIN_POINTS = 1000;
    /** Premia do ataku dla wojownika (+10%) oraz +1 pp. za kazdy poziom Akademii wojennej. */
    public static final double WARRIOR_ATTACK_BONUS = 0.10;
    public static final double WAR_ACADEMY_BONUS_PER_LEVEL = 0.01;
    public static final int MAX_PLANETS_CAP = 9;

    private Rules() {
    }

    /** Liczba jednoczesnych misji flot = 1 + poziom technologii komputerowej. */
    public static int fleetSlots(int computerTech) {
        return 1 + computerTech;
    }

    /** Maksymalna liczba planet (z macierzysta) = 1 + ceil(astrofizyka / 2), limit 9. */
    public static int maxPlanets(int astrophysics) {
        return Math.min(MAX_PLANETS_CAP, 1 + (astrophysics + 1) / 2);
    }

    public static double attackBonus(Branch branch, int warAcademyLevel) {
        if (branch != Branch.WARRIOR) return 0;
        return WARRIOR_ATTACK_BONUS + WAR_ACADEMY_BONUS_PER_LEVEL * warAcademyLevel;
    }

    /**
     * Ochrona poczatkujacych: gracz ponizej progu punktow nie moze byc atakowany przez
     * gracza majacego wiecej niz {@code newbieRatio} razy tyle punktow (i nie moze atakowac duzo slabszych).
     * Gracz nieaktywny (inactive) nie jest chroniony.
     */
    public static boolean attackAllowed(double attackerPoints, double defenderPoints, boolean defenderInactive,
                                        UniverseConfig config) {
        if (defenderInactive) return true;
        double ratio = config.newbieRatio();
        boolean defenderProtected = defenderPoints < config.newbieProtectionPoints()
                && attackerPoints > defenderPoints * ratio;
        boolean attackerProtected = attackerPoints < config.newbieProtectionPoints()
                && defenderPoints > attackerPoints * ratio;
        return !defenderProtected && !attackerProtected;
    }
}
