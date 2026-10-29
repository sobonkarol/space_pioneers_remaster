package pl.spacepioneers.game.service;

import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.Alliance;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Wyszukiwarka graczy, sojuszy i planet (po fragmencie nazwy). */
public final class SearchService extends ServiceBase {

    public static final int LIMIT = 50;

    public SearchService(GameContext ctx, World world) {
        super(ctx, world);
    }

    public record Hit(String kind, long id, String name, String tag, String playerName, Long allianceId,
                      String allianceTag, String coordinates, double points, int rank, int members) {
    }

    public List<Hit> search(String kind, String query) {
        String q = query == null ? "" : query.trim();
        if (q.length() < 2 || q.length() > 30) {
            throw new GameException("invalid_query", "Wpisz od 2 do 30 znaków.");
        }
        return read(now -> {
            Map<Long, String> tags = new HashMap<>();
            java.util.function.Function<Long, String> tagOf = id -> id == null ? null
                    : tags.computeIfAbsent(id, x -> ctx.store().alliance(x).map(Alliance::getTag).orElse(null));
            return switch (kind == null ? "players" : kind) {
                case "players" -> ctx.store().searchPlayers(q, LIMIT).stream()
                        .map(p -> new Hit("player", p.getId(), p.getUsername(), null, p.getUsername(), p.getAllianceId(),
                                tagOf.apply(p.getAllianceId()), home(p), Math.floor(p.getScore().total()), p.getRank(), 0))
                        .toList();
                case "alliances" -> ctx.store().searchAlliances(q, LIMIT).stream()
                        .map(a -> new Hit("alliance", a.getId(), a.getName(), a.getTag(), null, a.getId(), a.getTag(), null,
                                Math.floor(a.getScore().total()), 0, ctx.store().playersOfAlliance(a.getId()).size()))
                        .toList();
                case "planets" -> ctx.store().searchPlanets(q, LIMIT).stream()
                        .map(pl -> {
                            Player o = ctx.requirePlayer(pl.getOwnerId());
                            return new Hit(pl.isMoon() ? "moon" : "planet", pl.getId(), pl.getName(), null, o.getUsername(),
                                    o.getAllianceId(), tagOf.apply(o.getAllianceId()), pl.coordinates().toString(),
                                    Math.floor(o.getScore().total()), o.getRank(), 0);
                        })
                        .toList();
                default -> throw new GameException("invalid_kind", "Nieznany rodzaj wyszukiwania.");
            };
        });
    }

    private String home(Player p) {
        return ctx.store().planet(p.getHomePlanetId()).map(Planet::coordinates).map(Object::toString).orElse(null);
    }
}
