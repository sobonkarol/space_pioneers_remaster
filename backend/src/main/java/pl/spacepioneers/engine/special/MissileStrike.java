package pl.spacepioneers.engine.special;

import pl.spacepioneers.engine.data.GameData;
import pl.spacepioneers.engine.data.UnitDef;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Atak rakietami miedzyplanetarnymi na obrone planety.
 * Rakiety przechwytujace niszcza rakiety 1:1; reszta zadaje obrazenia obronie
 * (najpierw wskazany cel glowny, potem pozostale typy w kolejnosci katalogu).
 */
public final class MissileStrike {

    public static final String IPM = "interplanetary_missile";
    public static final String ABM = "anti_ballistic_missile";
    public static final String SILO = "missile_silo";
    public static final int SLOTS_PER_SILO_LEVEL = 10;

    private MissileStrike() {
    }

    public record Result(long intercepted, long hitting, Map<String, Long> destroyed) {
    }

    /** Zasieg w systemach: 5 * naped impulsowy - 1 (0 = brak mozliwosci strzalu). */
    public static int rangeSystems(int impulseDrive) {
        return Math.max(0, impulseDrive * 5 - 1);
    }

    /** Czas lotu rakiety w sekundach. */
    public static long flightSeconds(int systemsDistance, double fleetSpeed) {
        return Math.max(1, Math.round((30 + 60.0 * systemsDistance) / fleetSpeed));
    }

    public static int siloCapacity(int siloLevel) {
        return siloLevel * SLOTS_PER_SILO_LEVEL;
    }

    /** Zajete miejsca w silosie przez zgromadzone i zamowione rakiety. */
    public static long usedSlots(GameData data, Map<String, Long> missiles) {
        long used = 0;
        for (var e : missiles.entrySet()) {
            UnitDef u = data.findUnit(e.getKey()).orElse(null);
            if (u != null && u.isMissile()) {
                used += e.getValue() * (u.missileSlots() == null ? 1 : u.missileSlots());
            }
        }
        return used;
    }

    public static Result strike(GameData data, long missiles, long interceptors, Map<String, Long> targetUnits,
                                String primaryTarget, int attackerWeapons, int defenderArmour) {
        long intercepted = Math.min(missiles, interceptors);
        long hitting = missiles - intercepted;
        UnitDef ipm = data.unit(IPM);
        double damage = hitting * ipm.attack() * (1 + 0.1 * attackerWeapons);
        List<UnitDef> order = new ArrayList<>();
        if (primaryTarget != null) {
            data.findUnit(primaryTarget).filter(UnitDef::isDefense).ifPresent(order::add);
        }
        for (UnitDef d : data.defenses()) {
            if (!order.contains(d)) order.add(d);
        }
        Map<String, Long> destroyed = new LinkedHashMap<>();
        for (UnitDef d : order) {
            long count = targetUnits.getOrDefault(d.key(), 0L);
            if (count <= 0 || damage <= 0) continue;
            double hull = d.baseHull() * (1 + 0.1 * defenderArmour);
            long kill = Math.min(count, (long) Math.floor(damage / hull));
            if (kill > 0) {
                destroyed.put(d.key(), kill);
                damage -= kill * hull;
            }
        }
        return new Result(intercepted, hitting, destroyed);
    }
}
