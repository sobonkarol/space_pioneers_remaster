package pl.spacepioneers.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import pl.spacepioneers.engine.common.Resources;
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
        Long newbieProtectionPoints,
        Long startResources
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

    /**
     * Surowce startowe nowego gracza (metal, krysztal i tryt po tyle samo). Tylko do testow E2E
     * (UNIVERSE_START_RESOURCES) - bez ustawienia gracz dostaje standardowe 500 metalu i 500 krysztalu.
     */
    public Resources startResourcesOrDefault(Resources fallback) {
        return startResources == null ? fallback : Resources.of(startResources, startResources, startResources);
    }

    public String displayName() {
        return name == null ? "Uniwersum 1" : name;
    }
}
