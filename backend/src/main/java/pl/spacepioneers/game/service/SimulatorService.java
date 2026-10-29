package pl.spacepioneers.game.service;

import pl.spacepioneers.engine.Rules;
import pl.spacepioneers.engine.combat.CombatResult;
import pl.spacepioneers.engine.combat.Combatant;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.data.UnitDef;
import pl.spacepioneers.engine.special.Moons;
import pl.spacepioneers.game.GameException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Symulator walki: te same zasady co prawdziwa bitwa, powtorzone wielokrotnie z roznym losowaniem.
 * Nie zmienia stanu gry.
 */
public final class SimulatorService {

    public static final int MAX_RUNS = 50;
    public static final long MAX_UNITS = 10_000_000L;

    private final GameContext ctx;

    public SimulatorService(GameContext ctx) {
        this.ctx = ctx;
    }

    /** Uczestnik symulacji: jednostki i poziomy technologii bojowych; bonus wojownika w procentach. */
    public record Side(Map<String, Long> units, int weapons, int shielding, int armour, int attackBonusPercent) {
    }

    public record Result(int runs, int attackerWins, int defenderWins, int draws, double averageRounds,
                         Map<String, Double> attackerSurvivors, Map<String, Double> defenderSurvivors,
                         Resources attackerLoss, Resources defenderLoss, Resources debris,
                         int moonChancePercent, long recyclersNeeded, CombatResult sample) {
    }

    public Result simulate(Side attacker, Side defender, int runs) {
        int n = Math.max(1, Math.min(MAX_RUNS, runs));
        Combatant a = combatant(1, attacker, true);
        Combatant d = combatant(2, defender, false);
        if (a.units().isEmpty()) {
            throw new GameException("empty_side", "Atakujący musi mieć przynajmniej jeden statek.");
        }
        int aw = 0, dw = 0, dr = 0;
        double rounds = 0;
        Map<String, Double> aSurv = new HashMap<>();
        Map<String, Double> dSurv = new HashMap<>();
        Resources aLoss = Resources.ZERO, dLoss = Resources.ZERO, debris = Resources.ZERO;
        CombatResult sample = null;
        for (int i = 0; i < n; i++) {
            CombatResult r = ctx.combat().simulate(List.of(a), List.of(d), ctx.seed());
            if (sample == null) sample = r;
            switch (r.outcome()) {
                case ATTACKER -> aw++;
                case DEFENDER -> dw++;
                case DRAW -> dr++;
            }
            rounds += r.rounds().size();
            r.attackerSurvivors().get(0).forEach((k, v) -> aSurv.merge(k, (double) v, Double::sum));
            Map<String, Long> defAfter = new HashMap<>(r.defenderSurvivors().get(0));
            r.defenseRebuilt().forEach((k, v) -> defAfter.merge(k, v, Long::sum));
            defAfter.forEach((k, v) -> dSurv.merge(k, (double) v, Double::sum));
            aLoss = aLoss.plus(r.attackerLostValue());
            dLoss = dLoss.plus(r.defenderLostValue());
            debris = debris.plus(r.debris());
        }
        final int runsDone = n;
        aSurv.replaceAll((k, v) -> v / runsDone);
        dSurv.replaceAll((k, v) -> v / runsDone);
        Resources avgDebris = debris.times(1.0 / n).floor();
        long capacity = ctx.data().unit("recycler").cargo();
        long recyclers = capacity <= 0 ? 0 : (long) Math.ceil((avgDebris.metal() + avgDebris.crystal()) / capacity);
        return new Result(n, aw, dw, dr, rounds / n, aSurv, dSurv, aLoss.times(1.0 / n).floor(),
                dLoss.times(1.0 / n).floor(), avgDebris, Moons.chancePercent(avgDebris), recyclers, sample);
    }

    private Combatant combatant(long id, Side side, boolean attacker) {
        if (side == null) {
            return new Combatant(id, Map.of(), 0, 0, 0, 0);
        }
        Map<String, Long> units = new HashMap<>();
        if (side.units() != null) {
            side.units().forEach((k, v) -> {
                if (v == null || v <= 0) return;
                UnitDef u = ctx.data().units().stream().filter(x -> x.key().equals(k)).findFirst()
                        .orElseThrow(() -> new GameException("unknown_unit", "Nieznana jednostka: " + k));
                if (!u.fights()) return; // rakiety nie walcza
                if (attacker && !u.isShip()) {
                    throw new GameException("invalid_attacker", "Atakujący może mieć tylko statki.");
                }
                if (v > MAX_UNITS) {
                    throw new GameException("too_many_units", "Za duża liczba jednostek.");
                }
                units.put(k, v);
            });
        }
        int w = clampTech(side.weapons()), s = clampTech(side.shielding()), ar = clampTech(side.armour());
        double bonus = Math.max(0, Math.min(50, side.attackBonusPercent())) / 100.0;
        return new Combatant(id, units, w, s, ar, bonus);
    }

    private static int clampTech(int level) {
        if (level < 0 || level > 50) {
            throw new GameException("invalid_level", "Poziom technologii: 0-50.");
        }
        return level;
    }

    /** Wartosci ze swojego konta do wstepnego wypelnienia formularza. */
    public Side ownTechnology(long playerId) {
        return ctx.store().inTransaction(() -> {
            var p = ctx.requirePlayer(playerId);
            int academy = ctx.store().planetsOf(playerId).stream()
                    .mapToInt(pl -> pl.getBuildings().getOrDefault("war_academy", 0)).max().orElse(0);
            return new Side(Map.of(), p.researchLevel("weapons_tech"), p.researchLevel("shielding_tech"),
                    p.researchLevel("armour_tech"), (int) Math.round(Rules.attackBonus(p.getBranch(), academy) * 100));
        });
    }
}
