package pl.spacepioneers.engine.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import pl.spacepioneers.engine.common.Branch;
import pl.spacepioneers.engine.common.ResourceType;
import pl.spacepioneers.engine.common.Resources;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BuildingDef(
        String key,
        String category,
        Branch branch,
        Resources baseCost,
        double costFactor,
        Integer maxLevel,
        GrowthFormula production,
        GrowthFormula energyUse,
        GrowthFormula energyProduction,
        GrowthFormula tritiumUse,
        Storage storage,
        Integer fieldsBonus,
        Requirements requirements
) {
    public BuildingDef {
        if (requirements == null) {
            requirements = Requirements.NONE;
        }
        if (branch == null) {
            branch = Branch.NONE;
        }
    }

    public record Storage(ResourceType resource) {
    }

    /** Koszt rozbudowy do poziomu {@code level}. */
    public Resources costForLevel(int level) {
        if (level < 1) {
            throw new IllegalArgumentException("level >= 1");
        }
        return baseCost.times(Math.pow(costFactor, level - 1)).floor();
    }

    public int maxLevelOrDefault() {
        return maxLevel == null ? 60 : maxLevel;
    }
}
