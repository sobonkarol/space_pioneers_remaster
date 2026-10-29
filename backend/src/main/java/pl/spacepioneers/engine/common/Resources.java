package pl.spacepioneers.engine.common;

/**
 * Niezmienny wektor zasobow: metal, krysztal, tryt.
 * Wartosci przechowywane jako double, bo produkcja narasta ulamkowo w czasie.
 */
public record Resources(double metal, double crystal, double tritium) {

    public static final Resources ZERO = new Resources(0, 0, 0);

    public static Resources of(double metal, double crystal, double tritium) {
        return new Resources(metal, crystal, tritium);
    }

    public Resources plus(Resources o) {
        return new Resources(metal + o.metal, crystal + o.crystal, tritium + o.tritium);
    }

    public Resources minus(Resources o) {
        return new Resources(metal - o.metal, crystal - o.crystal, tritium - o.tritium);
    }

    public Resources times(double f) {
        return new Resources(metal * f, crystal * f, tritium * f);
    }

    /** Czy te zasoby pokrywaja koszt {@code cost} (z tolerancja na blad zmiennoprzecinkowy). */
    public boolean covers(Resources cost) {
        double eps = 1e-6;
        return metal + eps >= cost.metal && crystal + eps >= cost.crystal && tritium + eps >= cost.tritium;
    }

    public Resources floor() {
        return new Resources(Math.floor(metal), Math.floor(crystal), Math.floor(tritium));
    }

    public Resources max(Resources o) {
        return new Resources(Math.max(metal, o.metal), Math.max(crystal, o.crystal), Math.max(tritium, o.tritium));
    }

    public Resources min(Resources o) {
        return new Resources(Math.min(metal, o.metal), Math.min(crystal, o.crystal), Math.min(tritium, o.tritium));
    }

    public Resources nonNegative() {
        return max(ZERO);
    }

    public double total() {
        return metal + crystal + tritium;
    }

    public boolean isZero() {
        return metal == 0 && crystal == 0 && tritium == 0;
    }

    public double get(ResourceType type) {
        return switch (type) {
            case METAL -> metal;
            case CRYSTAL -> crystal;
            case TRITIUM -> tritium;
        };
    }

    public Resources with(ResourceType type, double value) {
        return switch (type) {
            case METAL -> new Resources(value, crystal, tritium);
            case CRYSTAL -> new Resources(metal, value, tritium);
            case TRITIUM -> new Resources(metal, crystal, value);
        };
    }
}
