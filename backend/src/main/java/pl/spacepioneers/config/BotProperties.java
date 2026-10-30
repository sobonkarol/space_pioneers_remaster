package pl.spacepioneers.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Gracze sterowani przez komputer (prefiks spacepioneers.bots). Domyslnie wylaczeni.
 *
 * @param enabled       BOTS_ENABLED - czy boty graja i sa zakladane
 * @param target        BOTS_TARGET - docelowa liczba botow
 * @param perWeek       BOTS_PER_WEEK - ile najwyzej nowych botow w ciagu 7 dni (rozlozonych rowno)
 * @param turnsPerTick  ile tur najwyzej w jednym przebiegu harmonogramu (co 15 s)
 */
@ConfigurationProperties(prefix = "spacepioneers.bots")
public record BotProperties(Boolean enabled, Integer target, Integer perWeek, Integer turnsPerTick) {
    public boolean on() { return Boolean.TRUE.equals(enabled); }
    public int targetOrDefault() { return target == null ? 50 : target; }
    public int perWeekOrDefault() { return perWeek == null ? 5 : perWeek; }
    public int turnsOrDefault() { return turnsPerTick == null ? 8 : turnsPerTick; }
}
