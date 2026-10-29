package pl.spacepioneers.engine.economy;

import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.data.BuildingDef;
import pl.spacepioneers.engine.data.GameData;
import pl.spacepioneers.engine.data.ResearchDef;
import pl.spacepioneers.engine.data.UnitDef;

import java.util.Map;

/**
 * Punkty rankingowe: 1 punkt za kazde 1000 surowcow wydanych na budynki, badania, statki i obrone.
 */
public final class Points {

    public static final double RESOURCES_PER_POINT = 1000.0;

    private final GameData data;

    public Points(GameData data) {
        this.data = data;
    }

    public record Breakdown(double buildings, double research, double fleet, double defense) {
        public double total() {
            return buildings + research + fleet + defense;
        }
    }

    public double buildingPoints(Map<String, Integer> levels) {
        double sum = 0;
        for (var e : levels.entrySet()) {
            BuildingDef def = data.findBuilding(e.getKey()).orElse(null);
            if (def == null) continue;
            for (int l = 1; l <= e.getValue(); l++) {
                sum += def.costForLevel(l).total();
            }
        }
        return sum / RESOURCES_PER_POINT;
    }

    public double researchPoints(Map<String, Integer> levels) {
        double sum = 0;
        for (var e : levels.entrySet()) {
            ResearchDef def = data.findResearch(e.getKey()).orElse(null);
            if (def == null) continue;
            for (int l = 1; l <= e.getValue(); l++) {
                sum += def.costForLevel(l).total();
            }
        }
        return sum / RESOURCES_PER_POINT;
    }

    /** Punkty za jednostki; zwraca [statki, obrona]. */
    public double[] unitPoints(Map<String, Long> counts) {
        double fleet = 0;
        double defense = 0;
        for (var e : counts.entrySet()) {
            UnitDef def = data.findUnit(e.getKey()).orElse(null);
            if (def == null) continue;
            double v = def.cost().total() * e.getValue();
            if (def.isShip()) fleet += v;
            else defense += v;
        }
        return new double[]{fleet / RESOURCES_PER_POINT, defense / RESOURCES_PER_POINT};
    }

    public static double pointsFor(Resources spent) {
        return spent.total() / RESOURCES_PER_POINT;
    }
}
