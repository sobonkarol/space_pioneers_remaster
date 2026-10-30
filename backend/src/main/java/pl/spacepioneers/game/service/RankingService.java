package pl.spacepioneers.game.service;

import pl.spacepioneers.engine.economy.Points;
import pl.spacepioneers.game.GameException;
import pl.spacepioneers.game.model.Alliance;
import pl.spacepioneers.game.model.Fleet;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.Score;
import pl.spacepioneers.game.store.GameStore;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.ToDoubleFunction;

/** Ranking graczy i sojuszy. Punkty przeliczane cyklicznie (harmonogram) oraz na zadanie. */
public final class RankingService extends ServiceBase {

    public static final int PAGE_SIZE = 100;

    public RankingService(GameContext ctx, World world) {
        super(ctx, world);
    }

    /** Przelicza punkty wszystkich graczy i sojuszy. */
    public void recompute() {
        txRun(now -> {
            GameStore store = ctx.store();
            Points points = ctx.points();
            Map<Long, List<Planet>> planetsByOwner = new HashMap<>();
            for (Planet p : store.allPlanets()) {
                planetsByOwner.computeIfAbsent(p.getOwnerId(), k -> new ArrayList<>()).add(p);
            }
            Map<Long, Map<String, Long>> flying = new HashMap<>();
            for (Fleet f : store.allFleets()) {
                Map<String, Long> m = flying.computeIfAbsent(f.getOwnerId(), k -> new HashMap<>());
                f.getShips().forEach((k, v) -> m.merge(k, v, Long::sum));
            }
            List<Player> players = new ArrayList<>(store.players());
            for (Player player : players) {
                double buildings = 0;
                Map<String, Long> units = new HashMap<>(flying.getOrDefault(player.getId(), Map.of()));
                for (Planet planet : planetsByOwner.getOrDefault(player.getId(), List.of())) {
                    world.advance(planet, player, now);
                    store.save(planet);
                    buildings += points.buildingPoints(planet.getBuildings());
                    planet.getUnits().forEach((k, v) -> units.merge(k, v, Long::sum));
                }
                double[] u = points.unitPoints(units);
                player.setScore(new Score(buildings, points.researchPoints(player.getResearch()), u[0], u[1]));
            }
            // administratorzy maja punkty (widza je u siebie), ale nie biora udzialu w rankingu
            players.sort(Comparator.comparingDouble((Player p) -> p.getScore().total()).reversed()
                    .thenComparingLong(Player::getId));
            int rank = 0;
            for (Player player : players) {
                player.setRank(player.isAdmin() ? 0 : ++rank);
                store.save(player);
            }
            List<Alliance> alliances = new ArrayList<>(store.alliances());
            for (Alliance a : alliances) {
                Score s = Score.ZERO;
                for (Player p : players) {
                    if (!p.isAdmin() && p.getAllianceId() != null && p.getAllianceId() == a.getId()) s = s.plus(p.getScore());
                }
                a.setScore(s);
            }
            alliances.sort(Comparator.comparingDouble((Alliance a) -> a.getScore().total()).reversed()
                    .thenComparingLong(Alliance::getId));
            for (int i = 0; i < alliances.size(); i++) {
                alliances.get(i).setRank(i + 1);
                store.save(alliances.get(i));
            }
        });
    }

    /**
     * @param type     "players" albo "alliances"
     * @param category "total", "buildings", "research", "fleet", "defense"
     */
    public Views.RankingPage page(String type, String category, int page) {
        return read(now -> {
            ToDoubleFunction<Score> metric = switch (category == null ? "total" : category) {
                case "total" -> Score::total;
                case "buildings" -> Score::buildings;
                case "research" -> Score::research;
                case "fleet" -> Score::fleet;
                case "defense" -> Score::defense;
                default -> throw new GameException("invalid_category", "Nieznana kategoria rankingu.");
            };
            int p = Math.max(1, page);
            GameStore store = ctx.store();
            List<Views.RankingRow> rows = new ArrayList<>();
            if ("alliances".equals(type)) {
                List<Alliance> all = new ArrayList<>(store.alliances());
                all.sort(Comparator.comparingDouble((Alliance a) -> metric.applyAsDouble(a.getScore())).reversed()
                        .thenComparingLong(Alliance::getId));
                for (int i = (p - 1) * PAGE_SIZE; i < Math.min(all.size(), p * PAGE_SIZE); i++) {
                    Alliance a = all.get(i);
                    rows.add(new Views.RankingRow(i + 1, a.getId(), a.getName(), a.getTag(), a.getId(),
                            Math.floor(metric.applyAsDouble(a.getScore())), store.playersOfAlliance(a.getId()).size()));
                }
                return new Views.RankingPage("alliances", category, p, PAGE_SIZE, all.size(), rows);
            }
            if (type != null && !"players".equals(type)) {
                throw new GameException("invalid_type", "Nieznany typ rankingu.");
            }
            int offset = (p - 1) * PAGE_SIZE;
            List<Player> pagePlayers = store.playersByScore(category == null ? "total" : category, offset, PAGE_SIZE);
            Map<Long, String> tags = new HashMap<>();
            for (int i = 0; i < pagePlayers.size(); i++) {
                Player x = pagePlayers.get(i);
                String tag = x.getAllianceId() == null ? null : tags.computeIfAbsent(x.getAllianceId(),
                        id -> store.alliance(id).map(Alliance::getTag).orElse(null));
                rows.add(new Views.RankingRow(offset + i + 1, x.getId(), x.getUsername(), tag, x.getAllianceId(),
                        Math.floor(metric.applyAsDouble(x.getScore())), null));
            }
            return new Views.RankingPage("players", category, p, PAGE_SIZE, store.rankedPlayerCount(), rows);
        });
    }

    /** Pozycja w rankingu dla gracza - zeby od razu otworzyc wlasciwa strone. */
    public int pageOf(long playerId) {
        return read(now -> {
            Player p = ctx.requirePlayer(playerId);
            return p.getRank() <= 0 ? 1 : (p.getRank() - 1) / PAGE_SIZE + 1;
        });
    }
}
