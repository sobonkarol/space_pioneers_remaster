package pl.spacepioneers.game.service;

import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.data.UnitDef;
import pl.spacepioneers.engine.economy.RequirementChecker;
import pl.spacepioneers.engine.economy.TechLevels;
import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.BuildOrder;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.ShipyardOrder;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Stocznia: budowa statkow i obrony. */
public final class ShipyardService extends ServiceBase {

    public static final int MAX_ORDERS = 10;
    public static final long MAX_PER_ORDER = 1_000_000;

    public ShipyardService(GameContext ctx, World world) {
        super(ctx, world);
    }

    /** @param type "SHIP" albo "DEFENSE" */
    public List<Views.UnitOption> list(long playerId, long planetId, UnitDef.UnitType type) {
        return tx(now -> {
            Player player = ctx.requirePlayer(playerId);
            Planet planet = ownPlanet(playerId, planetId, now);
            ctx.store().save(planet);
            TechLevels tech = new TechLevels(player.getResearch());
            int armour = player.researchLevel("armour_tech");
            List<Views.UnitOption> out = new ArrayList<>();
            for (UnitDef def : ctx.data().units()) {
                if (def.type() != type) continue;
                List<String> missing = RequirementChecker.missing(def.requirements(), planet.snapshot(), tech);
                String blocker = blocker(player, planet, def);
                long max = maxBuildable(planet, def);
                out.add(new Views.UnitOption(def.key(), def.type().name(), planet.count(def.key()), def.cost(),
                        ctx.timing().unitSeconds(def.cost(), planet.snapshot()), missing, blocker, max,
                        def.attack(), def.shield(), def.baseHull() * (1 + 0.1 * armour), def.cargo(),
                        def.isShip() ? ctx.fleetMath().unitSpeed(def, tech, player.getBranch()) : 0,
                        def.branch().name()));
            }
            return out;
        });
    }

    private String blocker(Player player, Planet planet, UnitDef def) {
        if (!RequirementChecker.branchAllows(def.branch(), player.getBranch())) return "branch_locked";
        BuildOrder active = planet.activeBuild();
        if (active != null && ("shipyard".equals(active.building()) || "nanite_factory".equals(active.building()))) {
            return "shipyard_upgrading";
        }
        if (planet.getShipyardQueue().size() >= MAX_ORDERS) return "queue_full";
        if (def.maxCount() != null && planned(planet, def.key()) >= def.maxCount()) return "max_count";
        return null;
    }

    private static long planned(Planet planet, String unit) {
        long n = planet.count(unit);
        for (ShipyardOrder o : planet.getShipyardQueue()) {
            if (o.unit().equals(unit)) n += o.remaining();
        }
        return n;
    }

    private static long maxBuildable(Planet planet, UnitDef def) {
        Resources r = planet.getResources();
        Resources c = def.cost();
        long max = Long.MAX_VALUE;
        if (c.metal() > 0) max = Math.min(max, (long) (r.metal() / c.metal()));
        if (c.crystal() > 0) max = Math.min(max, (long) (r.crystal() / c.crystal()));
        if (c.tritium() > 0) max = Math.min(max, (long) (r.tritium() / c.tritium()));
        if (max == Long.MAX_VALUE) max = 0;
        if (def.maxCount() != null) {
            max = Math.min(max, Math.max(0, def.maxCount() - planned(planet, def.key())));
        }
        return Math.min(max, MAX_PER_ORDER);
    }

    public Views.ShipyardItem order(long playerId, long planetId, String unitKey, long count) {
        return tx(now -> {
            if (count < 1 || count > MAX_PER_ORDER) {
                throw new GameException("invalid_count", "Nieprawidłowa liczba jednostek.");
            }
            Player player = ctx.requirePlayer(playerId);
            requireActive(player);
            Planet planet = ownPlanet(playerId, planetId, now);
            UnitDef def = ctx.data().findUnit(unitKey).orElseThrow(() -> GameException.notFound("jednostka " + unitKey));
            String blocker = blocker(player, planet, def);
            if (blocker != null) {
                String msg = "max_count".equals(blocker) ? "Można posiadać tylko jedną taką budowlę."
                        : PlanetService.blockerMessage(blocker);
                throw new GameException(blocker, msg);
            }
            if (def.maxCount() != null && planned(planet, unitKey) + count > def.maxCount()) {
                throw new GameException("max_count", "Można posiadać tylko jedną taką budowlę.");
            }
            List<String> missing = RequirementChecker.missing(def.requirements(), planet.snapshot(),
                    new TechLevels(player.getResearch()));
            if (!missing.isEmpty()) {
                throw new GameException("requirements", "Niespełnione wymagania: " + String.join(", ", missing));
            }
            pay(planet, def.cost().times(count));
            long perUnit = ctx.timing().unitSeconds(def.cost(), planet.snapshot());
            Instant start = planet.getShipyardQueue().isEmpty() ? now : null;
            ShipyardOrder order = new ShipyardOrder(ctx.store().nextId("shipyard"), unitKey, count, 0, perUnit, start);
            planet.getShipyardQueue().add(order);
            ctx.store().save(planet);
            return new Views.ShipyardItem(order.id(), unitKey, count, 0, perUnit, start, order.finishAt());
        });
    }
}
