package pl.spacepioneers.game;

import org.junit.Test;
import pl.spacepioneers.engine.data.UnitDef;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.service.Views;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public class EconomyFlowTest {

    protected final GameFixture f = createFixture();

    /** Podklasy testow integracyjnych podmieniaja magazyn (np. na PostgreSQL). */
    protected GameFixture createFixture() {
        return new GameFixture();
    }

    @Test
    public void registrationCreatesHomeworldAndWelcome() {
        Player p = f.register("Karol");
        Planet home = f.home(p);
        assertTrue(home.isHomeworld());
        assertEquals(163, home.getFields());
        assertTrue(home.getPosition() >= 4 && home.getPosition() <= 12);
        assertEquals(500, home.getResources().metal(), 1e-9);
        List<Message> inbox = f.game.messages().inbox(p.getId(), null, 10);
        assertEquals(1, inbox.size());
        assertTrue(f.player(p.getId()).isAdmin());
        Player second = f.register("Anna");
        assertTrue(!f.player(second.getId()).isAdmin());
    }

    @Test
    public void duplicateNamesAndInvalidInputRejected() {
        f.register("Karol");
        GameException e = assertThrows(GameException.class, () -> f.register("karol"));
        assertEquals("username_taken", e.getCode());
        assertEquals(GameException.Kind.CONFLICT, e.getKind());
        assertThrows(GameException.class, () -> f.game.players().register("ab", "x@y.pl", "h"));
        assertThrows(GameException.class, () -> f.game.players().register("validname", "nope", "h"));
    }

    @Test
    public void resourcesAccrueOverTime() {
        Player p = f.register("Karol");
        f.advance(Duration.ofHours(2));
        Views.Overview o = f.game.planets().overview(p.getId(), p.getHomePlanetId());
        assertEquals(500 + 60, o.resources().amount().metal(), 1e-9);
        assertEquals(500 + 30, o.resources().amount().crystal(), 1e-9);
    }

    @Test
    public void buildMetalMineThroughQueue() {
        Player p = f.register("Karol");
        long planet = p.getHomePlanetId();
        Views.BuildQueueItem item = f.game.planets().enqueue(p.getId(), planet, "metal_mine");
        assertEquals(1, item.level());
        assertNotNull(item.end());
        Planet after = f.store.planet(planet).orElseThrow();
        assertEquals(440, after.getResources().metal(), 1e-9);
        assertEquals(485, after.getResources().crystal(), 1e-9);

        long seconds = Duration.between(item.start(), item.end()).getSeconds();
        f.advance(Duration.ofSeconds(seconds - 1));
        assertEquals(0, f.store.planet(planet).orElseThrow().level("metal_mine"));
        f.advance(Duration.ofSeconds(1));
        assertEquals(1, f.store.planet(planet).orElseThrow().level("metal_mine"));
    }

    @Test
    public void queueRunsSequentiallyAndCancelRefunds() {
        Player p = f.register("Karol");
        long planet = p.getHomePlanetId();
        f.giveResources(planet, 10_000, 10_000, 10_000);
        var a = f.game.planets().enqueue(p.getId(), planet, "metal_mine");
        var b = f.game.planets().enqueue(p.getId(), planet, "metal_mine");
        var c = f.game.planets().enqueue(p.getId(), planet, "solar_plant");
        assertEquals(2, b.level());
        assertNull(b.start());
        double metalBefore = f.store.planet(planet).orElseThrow().getResources().metal();
        // anulowanie pierwszej pozycji usuwa tez druga (ten sam budynek)
        f.game.planets().cancelBuild(p.getId(), planet, a.id());
        Planet after = f.store.planet(planet).orElseThrow();
        assertEquals(1, after.getBuildQueue().size());
        assertEquals("solar_plant", after.getBuildQueue().get(0).building());
        assertNotNull(after.getBuildQueue().get(0).start());
        assertEquals(metalBefore + 60 + 90, after.getResources().metal(), 1e-6);
        assertTrue(c.id() > 0);
    }

    @Test
    public void notEnoughResourcesLeavesStateUnchanged() {
        Player p = f.register("Karol");
        long planet = p.getHomePlanetId();
        GameException e = assertThrows(GameException.class,
                () -> f.game.planets().enqueue(p.getId(), planet, "robotics_factory"));
        assertEquals("not_enough_resources", e.getCode());
        assertTrue(f.store.planet(planet).orElseThrow().getBuildQueue().isEmpty());
    }

    @Test
    public void requirementsAndBranchEnforced() {
        Player p = f.register("Karol");
        long planet = p.getHomePlanetId();
        f.giveResources(planet, 1e7, 1e7, 1e7);
        assertEquals("requirements", assertThrows(GameException.class,
                () -> f.game.planets().enqueue(p.getId(), planet, "shipyard")).getCode());
        assertEquals("branch_locked", assertThrows(GameException.class,
                () -> f.game.planets().enqueue(p.getId(), planet, "trade_center")).getCode());
    }

    @Test
    public void fieldLimitEnforced() {
        Player p = f.register("Karol");
        long planet = p.getHomePlanetId();
        f.editPlanet(planet, x -> x.setFields(3));
        f.setBuildings(planet, Map.of("metal_mine", 3));
        f.giveResources(planet, 1e6, 1e6, 1e6);
        assertEquals("no_fields", assertThrows(GameException.class,
                () -> f.game.planets().enqueue(p.getId(), planet, "crystal_mine")).getCode());
    }

    @Test
    public void researchFlow() {
        Player p = f.register("Karol");
        long planet = p.getHomePlanetId();
        f.giveResources(planet, 100_000, 100_000, 100_000);
        assertEquals("no_lab", assertThrows(GameException.class,
                () -> f.game.research().start(p.getId(), planet, "energy_tech")).getCode());
        f.setBuildings(planet, Map.of("research_lab", 1));
        var job = f.game.research().start(p.getId(), planet, "energy_tech");
        assertEquals("research_running", assertThrows(GameException.class,
                () -> f.game.research().start(p.getId(), planet, "computer_tech")).getCode());
        // laboratorium nie moze byc rozbudowywane podczas badania
        assertEquals("lab_busy", assertThrows(GameException.class,
                () -> f.game.planets().enqueue(p.getId(), planet, "research_lab")).getCode());
        f.advance(Duration.between(job.start(), job.end()));
        assertEquals(1, f.player(p.getId()).researchLevel("energy_tech"));
        assertNull(f.player(p.getId()).getResearchJob());
    }

    @Test
    public void researchCancelRefunds() {
        Player p = f.register("Karol");
        long planet = p.getHomePlanetId();
        f.setBuildings(planet, Map.of("research_lab", 1));
        f.giveResources(planet, 0, 1000, 1000);
        double before = f.store.planet(planet).orElseThrow().getResources().crystal();
        f.game.research().start(p.getId(), planet, "energy_tech");
        f.game.research().cancel(p.getId());
        assertEquals(before, f.store.planet(planet).orElseThrow().getResources().crystal(), 1e-6);
    }

    @Test
    public void shipyardDeliversUnitsGradually() {
        Player p = f.register("Karol");
        long planet = p.getHomePlanetId();
        f.setBuildings(planet, Map.of("shipyard", 2, "robotics_factory", 2));
        f.setResearch(p.getId(), Map.of("combustion_drive", 2));
        f.giveResources(planet, 100_000, 100_000, 0);
        var order = f.game.shipyard().order(p.getId(), planet, "small_cargo", 5);
        long per = order.secondsPerUnit();
        assertTrue(per > 0);
        f.advance(Duration.ofSeconds(per * 2 + 1));
        // stan planet jest naliczany leniwie - przy odczycie przez serwis
        f.game.planets().overview(p.getId(), planet);
        assertEquals(2, f.store.planet(planet).orElseThrow().count("small_cargo"));
        f.advance(Duration.ofSeconds(per * 10));
        f.game.planets().overview(p.getId(), planet);
        Planet done = f.store.planet(planet).orElseThrow();
        assertEquals(5, done.count("small_cargo"));
        assertTrue(done.getShipyardQueue().isEmpty());
        var options = f.game.shipyard().list(p.getId(), planet, UnitDef.UnitType.SHIP);
        assertTrue(options.stream().anyMatch(o -> o.key().equals("small_cargo") && o.available() == 5));
    }

    @Test
    public void shieldDomeLimitedToOne() {
        Player p = f.register("Karol");
        long planet = p.getHomePlanetId();
        f.setBuildings(planet, Map.of("shipyard", 1));
        f.setResearch(p.getId(), Map.of("shielding_tech", 2));
        f.giveResources(planet, 100_000, 100_000, 0);
        assertEquals("max_count", assertThrows(GameException.class,
                () -> f.game.shipyard().order(p.getId(), planet, "small_shield_dome", 2)).getCode());
        f.game.shipyard().order(p.getId(), planet, "small_shield_dome", 1);
        assertEquals("max_count", assertThrows(GameException.class,
                () -> f.game.shipyard().order(p.getId(), planet, "small_shield_dome", 1)).getCode());
    }

    @Test
    public void satellitesAndProductionSettings() {
        Player p = f.register("Karol");
        long planet = p.getHomePlanetId();
        f.setBuildings(planet, Map.of("metal_mine", 5, "solar_plant", 5));
        var before = f.game.planets().resources(p.getId(), planet);
        assertEquals(1.0, before.efficiency(), 1e-9);
        f.game.planets().setProduction(p.getId(), planet, "solar_plant", 0);
        var after = f.game.planets().resources(p.getId(), planet);
        assertEquals(0.0, after.efficiency(), 1e-9);
        assertThrows(GameException.class, () -> f.game.planets().setProduction(p.getId(), planet, "solar_plant", 55));
        assertThrows(GameException.class, () -> f.game.planets().setProduction(p.getId(), planet, "shipyard", 50));
    }

    @Test
    public void storageCapsProduction() {
        Player p = f.register("Karol");
        long planet = p.getHomePlanetId();
        f.advance(Duration.ofDays(30));
        var o = f.game.planets().overview(p.getId(), planet);
        assertEquals(10_000, o.resources().amount().metal(), 1e-9);
    }

    @Test
    public void demolishLowersLevel() {
        Player p = f.register("Karol");
        long planet = p.getHomePlanetId();
        f.setBuildings(planet, Map.of("metal_mine", 2));
        var item = f.game.planets().demolish(p.getId(), planet, "metal_mine");
        assertEquals(1, item.level());
        f.advance(Duration.between(item.start(), item.end()));
        assertEquals(1, f.store.planet(planet).orElseThrow().level("metal_mine"));
    }

    @Test
    public void empireListsAllPlanets() {
        Player p = f.register("Karol");
        f.setBuildings(p.getHomePlanetId(), Map.of("metal_mine", 3));
        var empire = f.game.planets().empire(p.getId());
        assertEquals(1, empire.size());
        assertEquals(3, (int) empire.get(0).buildings().get("metal_mine"));
        assertTrue(empire.get(0).planet().homeworld());
    }

    @Test
    public void renameAndAccessControl() {
        Player p = f.register("Karol");
        Player other = f.register("Anna");
        f.game.planets().rename(p.getId(), p.getHomePlanetId(), "Kraków");
        assertEquals("Kraków", f.home(p).getName());
        assertThrows(GameException.class, () -> f.game.planets().rename(p.getId(), p.getHomePlanetId(), "<script>"));
        GameException e = assertThrows(GameException.class,
                () -> f.game.planets().overview(other.getId(), p.getHomePlanetId()));
        assertEquals(GameException.Kind.NOT_FOUND, e.getKind());
        assertThrows(GameException.class, () -> f.game.planets().abandon(p.getId(), p.getHomePlanetId()));
    }
}
