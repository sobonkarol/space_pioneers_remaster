package pl.spacepioneers.engine.economy;

import java.util.Random;

/** Losuje parametry nowych planet w zaleznosci od pozycji w systemie. */
public final class PlanetGenerator {

    public static final int HOMEWORLD_FIELDS = 163;

    public record PlanetTraits(int fields, int temperatureMin, int temperatureMax, int imageVariant) {
    }

    private PlanetGenerator() {
    }

    public static PlanetTraits homeworld(int position, Random random) {
        int tMax = temperatureFor(position, random);
        return new PlanetTraits(HOMEWORLD_FIELDS, tMax - 40, tMax, 1 + random.nextInt(10));
    }

    public static PlanetTraits colony(int position, Random random) {
        int[] range = fieldRange(position);
        int fields = range[0] + random.nextInt(range[1] - range[0] + 1);
        int tMax = temperatureFor(position, random);
        return new PlanetTraits(fields, tMax - 40, tMax, 1 + random.nextInt(10));
    }

    static int[] fieldRange(int position) {
        if (position <= 3) return new int[]{50, 80};
        if (position <= 6) return new int[]{120, 180};
        if (position <= 9) return new int[]{140, 200};
        if (position <= 12) return new int[]{100, 160};
        return new int[]{60, 140};
    }

    static int temperatureFor(int position, Random random) {
        int base = 240 - 18 * (position - 1);
        return base - 20 + random.nextInt(41);
    }

    /** Typ grafiki planety wg pozycji (zgodnie z konwencja oryginalu: gorace blisko gwiazdy, lodowe daleko). */
    public static String planetType(int position) {
        if (position <= 3) return "hot";
        if (position <= 6) return "dry";
        if (position <= 9) return "normal";
        if (position <= 12) return "water";
        return "ice";
    }
}
