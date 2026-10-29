package pl.spacepioneers.engine.common;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Wspolrzedne w formacie galaktyka:system:pozycja. */
public record Coordinates(int galaxy, int system, int position) {

    private static final Pattern PATTERN = Pattern.compile("^\\[?(\\d+):(\\d+):(\\d+)]?$");

    public static Coordinates parse(String text) {
        Matcher m = PATTERN.matcher(text.trim());
        if (!m.matches()) {
            throw new IllegalArgumentException("Nieprawidlowe wspolrzedne: " + text);
        }
        return new Coordinates(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)));
    }

    public boolean isValid(UniverseConfig config) {
        return galaxy >= 1 && galaxy <= config.galaxies()
                && system >= 1 && system <= config.systems()
                && position >= 1 && position <= config.positions();
    }

    @Override
    public String toString() {
        return galaxy + ":" + system + ":" + position;
    }
}
