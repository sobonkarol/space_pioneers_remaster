package pl.spacepioneers.engine.combat;

import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.common.UniverseConfig;
import pl.spacepioneers.engine.data.GameData;
import pl.spacepioneers.engine.data.UnitDef;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Turowa, automatyczna symulacja walki.
 * <ul>
 *   <li>do {@code maxCombatRounds} rund; w kazdej rundzie kazda jednostka z atakiem &gt; 0 oddaje jeden strzal
 *       w losowa zywa jednostke przeciwnika,</li>
 *   <li>strzal slabszy niz 1% maksymalnej oslony celu odbija sie bez efektu,</li>
 *   <li>oslona pochlania obrazenia, nadwyzka trafia w strukture,</li>
 *   <li>po rundzie jednostki z struktura &lt; 70% eksploduja z prawdopodobienstwem 1 - struktura/maks,</li>
 *   <li>oslony odnawiaja sie na poczatku kazdej rundy.</li>
 * </ul>
 * Wynik jest deterministyczny dla danego ziarna RNG.
 */
public final class CombatEngine {

    private static final double BOUNCE_THRESHOLD = 0.01;
    private static final double EXPLOSION_THRESHOLD = 0.7;

    private final GameData data;
    private final UniverseConfig config;

    public CombatEngine(GameData data, UniverseConfig config) {
        this.data = data;
        this.config = config;
    }

    /** Grupa: jeden typ jednostki jednego uczestnika. */
    private record Group(int side, int combatant, String key, double attack, double maxShield, double maxHull) {
    }

    private static final class Army {
        final List<Group> groups = new ArrayList<>();
        int[] group = new int[0];
        double[] hull = new double[0];
        double[] shield = new double[0];
        int size;

        void add(int groupIndex, long count, double maxHull) {
            int needed = size + (int) count;
            if (needed > group.length) {
                int cap = Math.max(needed, group.length * 2);
                group = java.util.Arrays.copyOf(group, cap);
                hull = java.util.Arrays.copyOf(hull, cap);
                shield = java.util.Arrays.copyOf(shield, cap);
            }
            for (int i = 0; i < count; i++) {
                group[size] = groupIndex;
                hull[size] = maxHull;
                size++;
            }
        }

        void compact() {
            int w = 0;
            for (int r = 0; r < size; r++) {
                if (hull[r] > 0) {
                    group[w] = group[r];
                    hull[w] = hull[r];
                    shield[w] = shield[r];
                    w++;
                }
            }
            size = w;
        }

        void restoreShields() {
            for (int i = 0; i < size; i++) {
                shield[i] = groups.get(group[i]).maxShield();
            }
        }
    }

    public CombatResult simulate(List<Combatant> attackers, List<Combatant> defenders, long seed) {
        Random rnd = new Random(seed);
        Army att = build(attackers, 0);
        Army def = build(defenders, 1);

        List<CombatResult.Round> rounds = new ArrayList<>();
        int roundNo = 0;
        while (roundNo < config.maxCombatRounds() && att.size > 0 && def.size > 0) {
            roundNo++;
            att.restoreShields();
            def.restoreShields();
            double[] a = fire(att, def, rnd);
            double[] d = fire(def, att, rnd);
            explode(att, rnd);
            explode(def, rnd);
            att.compact();
            def.compact();
            rounds.add(new CombatResult.Round(roundNo,
                    (long) a[0], a[1], a[2], (long) d[0], d[1], d[2],
                    counts(att, attackers.size()), counts(def, defenders.size())));
        }

        CombatResult.Outcome outcome;
        if (att.size > 0 && def.size == 0) {
            outcome = CombatResult.Outcome.ATTACKER;
        } else if (def.size > 0 && att.size == 0) {
            outcome = CombatResult.Outcome.DEFENDER;
        } else {
            outcome = CombatResult.Outcome.DRAW;
        }

        List<Map<String, Long>> attInit = attackers.stream().map(c -> positive(c.units())).toList();
        List<Map<String, Long>> defInit = defenders.stream().map(c -> positive(c.units())).toList();
        List<Map<String, Long>> attSurv = counts(att, attackers.size());
        List<Map<String, Long>> defSurv = counts(def, defenders.size());
        List<Map<String, Long>> attLoss = diff(attInit, attSurv);
        List<Map<String, Long>> defLoss = diff(defInit, defSurv);

        Resources debris = Resources.ZERO;
        Resources attLost = Resources.ZERO;
        Resources defLost = Resources.ZERO;
        for (Map<String, Long> m : attLoss) {
            for (var e : m.entrySet()) {
                UnitDef u = data.unit(e.getKey());
                Resources v = u.cost().times(e.getValue());
                attLost = attLost.plus(v);
                if (u.isShip()) debris = debris.plus(Resources.of(v.metal(), v.crystal(), 0).times(config.debrisRatio()));
            }
        }

        // Odbudowa obrony dotyczy tylko wlasciciela planety (pierwszy obronca).
        Map<String, Long> rebuilt = new LinkedHashMap<>();
        for (int i = 0; i < defLoss.size(); i++) {
            for (var e : defLoss.get(i).entrySet()) {
                UnitDef u = data.unit(e.getKey());
                long lost = e.getValue();
                long back = 0;
                if (i == 0 && u.isDefense()) {
                    back = binomial(lost, config.defenseRebuildRate(), rnd);
                    if (back > 0) rebuilt.put(u.key(), back);
                }
                defLost = defLost.plus(u.cost().times(lost - back));
                if (u.isShip()) debris = debris.plus(Resources.of(u.cost().metal(), u.cost().crystal(), 0).times(lost * config.debrisRatio()));
            }
        }
        debris = debris.floor();

        return new CombatResult(outcome, rounds, attInit, defInit, attSurv, defSurv, attLoss, defLoss,
                rebuilt, debris, attLost.floor(), defLost.floor());
    }

    private Army build(List<Combatant> combatants, int side) {
        Army army = new Army();
        for (int c = 0; c < combatants.size(); c++) {
            Combatant cb = combatants.get(c);
            for (var e : cb.units().entrySet()) {
                long n = e.getValue();
                if (n <= 0) continue;
                UnitDef u = data.unit(e.getKey());
                double attack = u.attack() * (1 + 0.1 * cb.weapons() + cb.attackBonus());
                double shield = u.shield() * (1 + 0.1 * cb.shielding());
                double hull = u.baseHull() * (1 + 0.1 * cb.armour());
                army.groups.add(new Group(side, c, u.key(), attack, shield, hull));
                army.add(army.groups.size() - 1, n, hull);
            }
        }
        return army;
    }

    /** Zwraca [liczba strzalow, obrazenia, pochloniete przez oslony]. */
    private static double[] fire(Army shooters, Army targets, Random rnd) {
        long shots = 0;
        double damage = 0;
        double absorbed = 0;
        int targetCount = targets.size;
        if (targetCount == 0) {
            return new double[]{0, 0, 0};
        }
        for (int i = 0; i < shooters.size; i++) {
            Group g = shooters.groups.get(shooters.group[i]);
            if (g.attack() <= 0) continue;
            int t = rnd.nextInt(targetCount);
            if (targets.hull[t] <= 0) {
                // cel zniszczony wczesniej w tej rundzie - strzal trafia we wrak i przepada
                shots++;
                continue;
            }
            Group tg = targets.groups.get(targets.group[t]);
            shots++;
            double dmg = g.attack();
            if (dmg < tg.maxShield() * BOUNCE_THRESHOLD) {
                absorbed += dmg;
                continue;
            }
            if (targets.shield[t] >= dmg) {
                targets.shield[t] -= dmg;
                absorbed += dmg;
                continue;
            }
            double through = dmg - targets.shield[t];
            absorbed += targets.shield[t];
            targets.shield[t] = 0;
            targets.hull[t] -= through;
            damage += through;
        }
        return new double[]{shots, damage, absorbed};
    }

    private static void explode(Army army, Random rnd) {
        for (int i = 0; i < army.size; i++) {
            double h = army.hull[i];
            if (h <= 0) continue;
            double max = army.groups.get(army.group[i]).maxHull();
            if (h < max * EXPLOSION_THRESHOLD && rnd.nextDouble() < 1 - h / max) {
                army.hull[i] = 0;
            }
        }
    }

    private static List<Map<String, Long>> counts(Army army, int combatants) {
        List<Map<String, Long>> out = new ArrayList<>();
        for (int i = 0; i < combatants; i++) out.add(new LinkedHashMap<>());
        for (int i = 0; i < army.size; i++) {
            if (army.hull[i] <= 0) continue;
            Group g = army.groups.get(army.group[i]);
            out.get(g.combatant()).merge(g.key(), 1L, Long::sum);
        }
        return out;
    }

    private static Map<String, Long> positive(Map<String, Long> m) {
        Map<String, Long> out = new LinkedHashMap<>();
        m.forEach((k, v) -> {
            if (v > 0) out.put(k, v);
        });
        return out;
    }

    private static List<Map<String, Long>> diff(List<Map<String, Long>> before, List<Map<String, Long>> after) {
        List<Map<String, Long>> out = new ArrayList<>();
        for (int i = 0; i < before.size(); i++) {
            Map<String, Long> loss = new LinkedHashMap<>();
            Map<String, Long> a = after.get(i);
            before.get(i).forEach((k, v) -> {
                long l = v - a.getOrDefault(k, 0L);
                if (l > 0) loss.put(k, l);
            });
            out.add(loss);
        }
        return out;
    }

    private static long binomial(long n, double p, Random rnd) {
        if (n <= 0) return 0;
        if (n > 10_000) {
            double mean = n * p;
            double sd = Math.sqrt(n * p * (1 - p));
            return Math.max(0, Math.min(n, Math.round(mean + sd * rnd.nextGaussian())));
        }
        long k = 0;
        for (long i = 0; i < n; i++) if (rnd.nextDouble() < p) k++;
        return k;
    }
}
