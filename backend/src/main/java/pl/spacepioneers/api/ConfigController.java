package pl.spacepioneers.api;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pl.spacepioneers.config.UniverseProperties;
import pl.spacepioneers.engine.Rules;
import pl.spacepioneers.engine.common.UniverseConfig;
import pl.spacepioneers.engine.data.BuildingDef;
import pl.spacepioneers.engine.data.GameData;
import pl.spacepioneers.engine.data.ResearchDef;
import pl.spacepioneers.engine.data.UnitDef;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/** Publiczne dane konfiguracyjne: parametry galaktyki i katalog definicji (dla frontendu i pomocy gry). */
@RestController
@RequestMapping("/api")
public class ConfigController {

    private final GameData data;
    private final UniverseConfig config;
    private final UniverseProperties props;
    private final JdbcTemplate jdbc;

    public ConfigController(GameData data, UniverseConfig config, UniverseProperties props, JdbcTemplate jdbc) {
        this.data = data;
        this.config = config;
        this.props = props;
        this.jdbc = jdbc;
    }

    public record GameConfigDto(String universeName, UniverseConfig universe, long branchMinPoints,
                                Collection<BuildingDef> buildings, Collection<ResearchDef> research,
                                List<UnitDef> ships, List<UnitDef> defenses) {
    }

    @GetMapping("/config")
    public GameConfigDto config() {
        return new GameConfigDto(props.displayName(), config, Rules.BRANCH_MIN_POINTS, data.buildings(),
                data.research(), data.ships(), data.defenses());
    }

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        Integer players = jdbc.queryForObject("select count(*) from players", Integer.class);
        Integer online = jdbc.queryForObject(
                "select count(*) from players where last_activity > now() - interval '15 minutes'", Integer.class);
        return Map.of("universe", props.displayName(), "players", players == null ? 0 : players,
                "online", online == null ? 0 : online);
    }
}
