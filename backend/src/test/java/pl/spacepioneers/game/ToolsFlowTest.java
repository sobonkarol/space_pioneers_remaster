package pl.spacepioneers.game;

import org.junit.Before;
import org.junit.Test;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.service.SearchService;
import pl.spacepioneers.game.service.SimulatorService;

import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

/** Wyszukiwarka i symulator walki. */
public class ToolsFlowTest {

    protected final GameFixture f = createFixture();

    protected GameFixture createFixture() {
        return new GameFixture();
    }

    private Player karol;

    @Before
    public void setUp() {
        karol = f.register("Karol_Wielki");
        f.register("Karolina");
        f.register("Zenon");
        f.game.alliances().create(karol.getId(), "KRL", "Królestwo");
        f.game.planets().rename(karol.getId(), karol.getHomePlanetId(), "Stolica_100");
    }

    @Test
    public void searchPlayersAlliancesAndPlanets() {
        List<SearchService.Hit> players = f.game.search().search("players", "karol");
        assertEquals(List.of("Karol_Wielki", "Karolina"), players.stream().map(SearchService.Hit::name).toList());
        assertEquals("KRL", players.get(0).allianceTag());
        assertTrue(players.get(0).coordinates() != null);
        // znaki specjalne nie dzialaja jak wzorzec
        assertTrue(f.game.search().search("players", "l_W").stream().anyMatch(h -> h.name().equals("Karol_Wielki")));
        assertTrue(f.game.search().search("players", "%%").isEmpty());

        assertEquals("KRL", f.game.search().search("alliances", "królest").get(0).tag());
        assertEquals(1, f.game.search().search("alliances", "krl").get(0).members());

        List<SearchService.Hit> planets = f.game.search().search("planets", "a_1");
        assertEquals(1, planets.size());
        assertEquals("Karol_Wielki", planets.get(0).playerName());
        assertEquals(2, f.game.search().search("planets", "macierzysta").size());
        assertTrue(f.game.search().search("planets", "a_m").isEmpty()); // _ nie jest symbolem wieloznacznym

        assertEquals("invalid_query", assertThrows(GameException.class, () -> f.game.search().search("players", "k")).getCode());
        assertEquals("invalid_kind", assertThrows(GameException.class, () -> f.game.search().search("ships", "ka")).getCode());
    }

    @Test
    public void simulatorAveragesManyBattles() {
        var attacker = new SimulatorService.Side(Map.of("cruiser", 20L), 3, 3, 3, 0);
        var defender = new SimulatorService.Side(Map.of("rocket_launcher", 30L, "light_laser", 10L), 0, 0, 0, 0);
        SimulatorService.Result r = f.game.simulator().simulate(attacker, defender, 20);
        assertEquals(20, r.runs());
        assertEquals(20, r.attackerWins() + r.defenderWins() + r.draws());
        assertTrue(r.attackerWins() >= 18); // krazowniki z rapid fire na wyrzutnie
        assertTrue(r.averageRounds() >= 1 && r.averageRounds() <= 6);
        // obrona jest odbudowywana - srednio czesc jednostek zostaje
        assertTrue(r.defenderSurvivors().getOrDefault("rocket_launcher", 0.0) > 0);
        assertTrue(r.sample() != null);

        var fleetVsFleet = f.game.simulator().simulate(
                new SimulatorService.Side(Map.of("battleship", 50L), 0, 0, 0, 0),
                new SimulatorService.Side(Map.of("light_fighter", 500L), 0, 0, 0, 0), 5);
        assertTrue(fleetVsFleet.debris().metal() > 0);
        assertTrue(fleetVsFleet.recyclersNeeded() > 0);
        assertTrue(fleetVsFleet.moonChancePercent() >= 0 && fleetVsFleet.moonChancePercent() <= 20);

        assertEquals("invalid_attacker", assertThrows(GameException.class, () -> f.game.simulator().simulate(
                new SimulatorService.Side(Map.of("rocket_launcher", 1L), 0, 0, 0, 0), defender, 1)).getCode());
        assertEquals("empty_side", assertThrows(GameException.class, () -> f.game.simulator().simulate(
                new SimulatorService.Side(Map.of(), 0, 0, 0, 0), defender, 1)).getCode());
        assertEquals("unknown_unit", assertThrows(GameException.class, () -> f.game.simulator().simulate(
                new SimulatorService.Side(Map.of("x_wing", 1L), 0, 0, 0, 0), defender, 1)).getCode());
    }

    @Test
    public void ownTechnologyPrefillsForm() {
        f.setResearch(karol.getId(), Map.of("weapons_tech", 4, "shielding_tech", 2, "armour_tech", 5));
        SimulatorService.Side s = f.game.simulator().ownTechnology(karol.getId());
        assertEquals(4, s.weapons());
        assertEquals(2, s.shielding());
        assertEquals(5, s.armour());
    }
}
