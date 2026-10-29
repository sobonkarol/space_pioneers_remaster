package pl.spacepioneers.engine.data;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import pl.spacepioneers.engine.common.ResourceType;

/**
 * Formula wzrostu: wartosc(L) = base * L * growth^L  (dla L &gt; 0).
 * Opcjonalnie wzrost zwiekszany przez poziom badania (techBonusKey).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GrowthFormula(
        ResourceType resource,
        double base,
        double growth,
        Boolean temperatureDependent,
        String techBonusKey,
        Double techBonusPerLevel
) {
    public double valueAt(int level, int techLevel) {
        if (level <= 0) {
            return 0;
        }
        double g = growth;
        if (techBonusKey != null && techBonusPerLevel != null) {
            g += techBonusPerLevel * techLevel;
        }
        return base * level * Math.pow(g, level);
    }

    public boolean isTemperatureDependent() {
        return Boolean.TRUE.equals(temperatureDependent);
    }
}
