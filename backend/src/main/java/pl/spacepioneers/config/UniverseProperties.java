package pl.spacepioneers.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import pl.spacepioneers.engine.common.UniverseConfig;

/** Ustawienia galaktyki z application.yml (prefiks spacepioneers.universe). */
@ConfigurationProperties(prefix = "spacepioneers.universe")
public record UniverseProperties(
        String name,
        Integer galaxies,
        Integer systems,
        Integer positions,
        Double speed,
        Double fleetSpeed,
        Double debrisRatio,
        Double defenseRebuildRate,
        Double lootRatio,
        Long newbieProtectionPoints
) {
    public UniverseConfig toConfig() {
        UniverseConfig d = UniverseConfig.defaults();
        double s = speed == null ? d.economySpeed() : speed;
        return new UniverseConfig(
                galaxies == null ? d.galaxies() : galaxies,
                systems == null ? d.systems() : systems,
                positions == null ? d.positions() : positions,
                s, s,
                fleetSpeed == null ? s : fleetSpeed,
                debrisRatio == null ? d.debrisRatio() : debrisRatio,
                defenseRebuildRate == null ? d.defenseRebuildRate() : defenseRebuildRate,
                lootRatio == null ? d.lootRatio() : lootRatio,
                d.maxCombatRounds(),
                newbieProtectionPoints == null ? d.newbieProtectionPoints() : newbieProtectionPoints,
                d.newbieRatio());
    }

    public String displayName() {
        return name == null ? "Uniwersum 1" : name;
    }
}
