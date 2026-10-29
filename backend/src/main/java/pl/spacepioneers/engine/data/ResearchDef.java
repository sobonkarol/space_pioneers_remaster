package pl.spacepioneers.engine.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import pl.spacepioneers.engine.common.Branch;
import pl.spacepioneers.engine.common.Resources;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ResearchDef(
        String key,
        Branch branch,
        Resources baseCost,
        double costFactor,
        Integer maxLevel,
        Requirements requirements
) {
    public ResearchDef {
        if (requirements == null) {
            requirements = Requirements.NONE;
        }
        if (branch == null) {
            branch = Branch.NONE;
        }
    }

    public Resources costForLevel(int level) {
        if (level < 1) {
            throw new IllegalArgumentException("level >= 1");
        }
        return baseCost.times(Math.pow(costFactor, level - 1)).floor();
    }

    public int maxLevelOrDefault() {
        return maxLevel == null ? 40 : maxLevel;
    }
}
