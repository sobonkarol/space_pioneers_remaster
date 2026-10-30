package pl.spacepioneers.game.model;

import java.time.Instant;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Stan gracza sterowanego przez komputer: charakter, rytm dnia, wagi strategii i pamiec.
 * Zapisywany razem z graczem (pole {@link Player#getBot()}), nigdy nie trafia do API.
 */
public class BotBrain {

    /** Charakter bota - poczatkowe proporcje strategii. */
    public enum Personality { MINER, RAIDER, TURTLE, EXPLORER, BALANCED }

    /** Kierunki rozwoju, miedzy ktorymi bot rozdziela uwage i ktorych skutecznosci sie uczy. */
    public enum Strategy { ECONOMY, RESEARCH, FLEET, DEFENSE, EXPANSION }

    /** Pamiec o obcej planecie: wyniki szpiegowania i atakow. */
    public static class Target {
        public long ownerId;
        public String ownerName;
        public boolean moon;
        public Instant lastSpy;
        public Instant lastAttack;
        public Instant lastReport;
        /** Surowce i sily z ostatniego raportu (null = nie widac w raporcie). */
        public double resources;
        public Map<String, Long> fleet;
        public Map<String, Long> defense;
        public Map<String, Integer> research;
        public int attacks;
        public double loot;
        public double losses;
        /** Ataki odwolane po symulacji (za silny cel) - po kilku cel jest omijany. */
        public int rejected;
        /** Ile sond wyslac (rosnie, gdy raport nie pokazal floty lub obrony - cel ma lepsza technologie). */
        public int probes = 4;
    }

    private Personality personality = Personality.BALANCED;
    /** Jak czesto bot gra: minuty miedzy turami (min-max). */
    private int minInterval = 20;
    private int maxInterval = 90;
    /** Godzina (czas polski), o ktorej bot idzie spac, i dlugosc snu w godzinach. */
    private int sleepHour = 23;
    private int sleepHours = 7;
    private Instant nextTurn;
    private long turns;

    private Map<Strategy, Double> weights = new EnumMap<>(Strategy.class);
    /** Srednia nagroda z okresow, w ktorych dana strategia byla glownym kierunkiem (uczenie). */
    private Map<Strategy, Double> rewards = new EnumMap<>(Strategy.class);
    private Map<Strategy, Integer> rewardCounts = new EnumMap<>(Strategy.class);
    private Strategy focus = Strategy.ECONOMY;
    private Instant focusSince;
    private double focusStartPoints;
    private double focusLoot;
    private double focusLosses;

    private Map<String, Target> targets = new LinkedHashMap<>();
    /** Kto i ile razy zaatakowal bota (sklonnosc do obrony i odwetu). */
    private Map<Long, Integer> attackedBy = new HashMap<>();
    /** Ostatnio przegladany uklad w galaktyce (bot skanuje okolice po kolei). */
    private int scanOffset;

    public Personality getPersonality() { return personality; }
    public void setPersonality(Personality personality) { this.personality = personality; }
    public int getMinInterval() { return minInterval; }
    public void setMinInterval(int minInterval) { this.minInterval = minInterval; }
    public int getMaxInterval() { return maxInterval; }
    public void setMaxInterval(int maxInterval) { this.maxInterval = maxInterval; }
    public int getSleepHour() { return sleepHour; }
    public void setSleepHour(int sleepHour) { this.sleepHour = sleepHour; }
    public int getSleepHours() { return sleepHours; }
    public void setSleepHours(int sleepHours) { this.sleepHours = sleepHours; }
    public Instant getNextTurn() { return nextTurn; }
    public void setNextTurn(Instant nextTurn) { this.nextTurn = nextTurn; }
    public long getTurns() { return turns; }
    public void setTurns(long turns) { this.turns = turns; }
    public Map<Strategy, Double> getWeights() { return weights; }
    public void setWeights(Map<Strategy, Double> weights) { this.weights = weights; }
    public Map<Strategy, Double> getRewards() { return rewards; }
    public Map<Strategy, Integer> getRewardCounts() { return rewardCounts; }
    public Strategy getFocus() { return focus; }
    public void setFocus(Strategy focus) { this.focus = focus; }
    public Instant getFocusSince() { return focusSince; }
    public void setFocusSince(Instant focusSince) { this.focusSince = focusSince; }
    public double getFocusStartPoints() { return focusStartPoints; }
    public void setFocusStartPoints(double focusStartPoints) { this.focusStartPoints = focusStartPoints; }
    public double getFocusLoot() { return focusLoot; }
    public void setFocusLoot(double focusLoot) { this.focusLoot = focusLoot; }
    public double getFocusLosses() { return focusLosses; }
    public void setFocusLosses(double focusLosses) { this.focusLosses = focusLosses; }
    public Map<String, Target> getTargets() { return targets; }
    public Map<Long, Integer> getAttackedBy() { return attackedBy; }
    public int getScanOffset() { return scanOffset; }
    public void setScanOffset(int scanOffset) { this.scanOffset = scanOffset; }

    /** Waga strategii z premia za aktualny kierunek rozwoju. */
    public double weight(Strategy s) {
        double w = weights.getOrDefault(s, 1.0);
        return s == focus ? w * 1.6 : w;
    }
}
