package pl.spacepioneers.game.service;

import pl.spacepioneers.engine.Rules;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.common.UniverseConfig;
import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.Alliance;
import pl.spacepioneers.game.model.DebrisField;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Widok galaktyki (uklad slonczny). */
public final class GalaxyService extends ServiceBase {

    public GalaxyService(GameContext ctx, World world) {
        super(ctx, world);
    }

    public Views.GalaxyView system(long viewerId, int galaxy, int system) {
        return tx(now -> {
            UniverseConfig cfg = ctx.config();
            if (galaxy < 1 || galaxy > cfg.galaxies() || system < 1 || system > cfg.systems()) {
                throw new GameException("invalid_coordinates", "Współrzędne poza zakresem galaktyki.");
            }
            Player viewer = ctx.requirePlayer(viewerId);
            Map<Integer, Planet> planets = new HashMap<>();
            for (Planet p : ctx.store().planetsInSystem(galaxy, system)) planets.put(p.getPosition(), p);
            Map<Integer, Resources> debris = new HashMap<>();
            for (DebrisField d : ctx.store().debrisInSystem(galaxy, system)) {
                debris.put(d.coordinates().position(), d.resources());
            }
            Map<Long, Player> owners = new HashMap<>();
            Map<Long, Alliance> alliances = new HashMap<>();
            List<Views.GalaxyRow> rows = new ArrayList<>();
            for (int pos = 1; pos <= cfg.positions(); pos++) {
                Planet p = planets.get(pos);
                Resources d = debris.get(pos);
                if (p == null) {
                    rows.add(new Views.GalaxyRow(pos, null, null, null, 0, null, null, null, null, null,
                            List.of(), d, false));
                    continue;
                }
                Player owner = owners.computeIfAbsent(p.getOwnerId(), ctx::requirePlayer);
                Alliance alliance = owner.getAllianceId() == null ? null
                        : alliances.computeIfAbsent(owner.getAllianceId(),
                        id -> ctx.store().alliance(id).orElse(null));
                rows.add(new Views.GalaxyRow(pos, p.getId(), p.getName(), p.getPlanetType(), p.getImageVariant(),
                        owner.getId(), owner.getUsername(), owner.getRank() > 0 ? owner.getRank() : null,
                        alliance == null ? null : alliance.getId(), alliance == null ? null : alliance.getTag(),
                        flags(viewer, owner, now), d, owner.getId() == viewerId));
            }
            return new Views.GalaxyView(galaxy, system, cfg.galaxies(), cfg.systems(), rows);
        });
    }

    /** Oznaczenia: v - urlop, i/I - nieaktywny, n - chroniony (slabszy), s - silniejszy (ty jestes chroniony). */
    private List<String> flags(Player viewer, Player owner, Instant now) {
        List<String> flags = new ArrayList<>();
        if (owner.getId() == viewer.getId()) return flags;
        if (owner.inVacation()) flags.add("v");
        String inactive = owner.inactivity(now);
        if (inactive != null) flags.add(inactive);
        double vp = viewer.getScore().total();
        double op = owner.getScore().total();
        if (!Rules.attackAllowed(vp, op, inactive != null, ctx.config())) {
            flags.add(op < vp ? "n" : "s");
        }
        if (owner.isAdmin()) flags.add("A");
        return flags;
    }
}
