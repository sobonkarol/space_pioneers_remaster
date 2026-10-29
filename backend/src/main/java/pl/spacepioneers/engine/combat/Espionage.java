package pl.spacepioneers.engine.combat;

import java.util.EnumSet;
import java.util.Random;
import java.util.Set;

/** Zasady szpiegostwa sondami. */
public final class Espionage {

    public enum Section { RESOURCES, FLEET, DEFENSE, BUILDINGS, RESEARCH }

    private Espionage() {
    }

    /**
     * Zakres raportu zalezy od liczby sond i roznicy poziomow technologii szpiegowskiej.
     * Skutecznosc = sondy + roznica*|roznica| (przewaga technologii dziala kwadratowo, w obie strony).
     */
    public static Set<Section> visibleSections(long probes, int attackerTech, int defenderTech) {
        int diff = attackerTech - defenderTech;
        long effective = probes + (long) diff * Math.abs(diff);
        Set<Section> out = EnumSet.noneOf(Section.class);
        if (effective >= 1 || probes >= 1) out.add(Section.RESOURCES);
        if (effective >= 2) out.add(Section.FLEET);
        if (effective >= 3) out.add(Section.DEFENSE);
        if (effective >= 5) out.add(Section.BUILDINGS);
        if (effective >= 7) out.add(Section.RESEARCH);
        return out;
    }

    /** Szansa (0..1) na wykrycie i zestrzelenie sond przez floty obroncy. */
    public static double counterEspionageChance(long probes, long defenderShips, int attackerTech, int defenderTech) {
        if (defenderShips <= 0 || probes <= 0) return 0;
        int diff = defenderTech - attackerTech;
        double chance = defenderShips * probes * Math.pow(2, diff) / 400.0;
        return Math.min(1.0, chance);
    }

    public static boolean detected(double chance, Random rnd) {
        return rnd.nextDouble() < chance;
    }
}
