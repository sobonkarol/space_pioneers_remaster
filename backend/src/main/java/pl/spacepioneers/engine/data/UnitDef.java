package pl.spacepioneers.engine.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import pl.spacepioneers.engine.common.Branch;
import pl.spacepioneers.engine.common.Resources;

/** Statek lub budowla obronna. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record UnitDef(
        String key,
        UnitType type,
        Branch branch,
        Resources cost,
        double attack,
        double shield,
        long cargo,
        long speed,
        String drive,
        long fuel,
        Boolean stationary,
        Integer maxCount,
        Requirements requirements
) {
    public UnitDef {
        if (requirements == null) {
            requirements = Requirements.NONE;
        }
        if (branch == null) {
            branch = Branch.NONE;
        }
    }

    public enum UnitType { SHIP, DEFENSE }

    public boolean isShip() {
        return type == UnitType.SHIP;
    }

    public boolean isDefense() {
        return type == UnitType.DEFENSE;
    }

    /** Czy jednostka moze latac (statki poza satelitami). */
    public boolean canFly() {
        return isShip() && !Boolean.TRUE.equals(stationary) && speed > 0;
    }

    /** Bazowa struktura (punkty kadluba) przed bonusem z technologii pancerza. */
    public double baseHull() {
        return (cost.metal() + cost.crystal()) / 10.0;
    }
}
