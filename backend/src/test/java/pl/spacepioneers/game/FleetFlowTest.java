package pl.spacepioneers.game;

import org.junit.Before;
import org.junit.Test;
import pl.spacepioneers.engine.common.Coordinates;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.game.model.DebrisField;
import pl.spacepioneers.game.model.Fleet;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.service.FleetService.SendRequest;
import pl.spacepioneers.game.service.Reports;
import pl.spacepioneers.game.service.Views;
import pl.spacepioneers.game.store.Json;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public class FleetFlowTest {

    private final GameFixture f = new GameFixture();
    private Player attacker;
    private Player defender;
    private long aHome;
    private long dHome;

    @Before
    public void setUp() {
        attacker = f.register("Attacker");
        defender = f.register("Defender");
        aHome = attacker.getHomePlanetId();
        dHome = defender.getHomePlanetId();
        f.moveTo(aHome, "1:5:8");
        f.moveTo(dHome, "1:7:8");
        f.setResearch(attacker.getId(), Map.of("combustion_drive", 6, "computer_tech", 3, "impulse_drive", 4));
        // obaj gracze powyzej ochrony poczatkujacych
        f.setPoints(attacker.getId(), 10_000);
        f.setPoints(defender.getId(), 10_000);
    }

    private Views.FleetMovement send(long playerId, long planet, Map<String, Long> ships, String target,
                                     Fleet.Mission mission, Resources cargo) {
        return f.game.fleets().send(playerId, new SendRequest(planet, ships, target, mission, 100, cargo));
    }

    private void land(Views.FleetMovement m) {
        f.advance(Duration.between(f.clock.instant(), m.arriveAt()));
    }

    private void comeHome(Views.FleetMovement m) {
        f.advance(Duration.between(f.clock.instant(), m.returnAt()));
    }

    @Test
    public void transportDeliversAndReturns() {
        f.setUnits(aHome, Map.of("small_cargo", 2L));
        f.giveResources(aHome, 5000, 0, 1000);
        var m = send(attacker.getId(), aHome, Map.of("small_cargo", 2L), "1:7:8", Fleet.Mission.TRANSPORT,
                Resources.of(3000, 0, 0));
        Planet origin = f.store.planet(aHome).orElseThrow();
        assertEquals(0, origin.count("small_cargo"));
        assertEquals(1, f.store.fleetsOf(attacker.getId()).size());
        double defMetalBefore = f.store.planet(dHome).orElseThrow().getResources().metal();
        land(m);
        Planet target = f.store.planet(dHome).orElseThrow();
        assertTrue(target.getResources().metal() >= defMetalBefore + 3000);
        Fleet flying = f.store.fleetsOf(attacker.getId()).get(0);
        assertEquals(Fleet.Status.RETURNING, flying.getStatus());
        assertTrue(flying.getCargo().isZero());
        comeHome(m);
        assertTrue(f.store.fleetsOf(attacker.getId()).isEmpty());
        assertEquals(2, f.store.planet(aHome).orElseThrow().count("small_cargo"));
        assertFalse(f.game.messages().inbox(defender.getId(), Message.Type.FLEET, 10).isEmpty());
    }

    @Test
    public void fuelIsChargedAndCargoLimited() {
        f.setUnits(aHome, Map.of("small_cargo", 1L));
        f.giveResources(aHome, 10_000, 0, 0);
        assertEquals("cargo_exceeded", assertThrows(GameException.class, () -> send(attacker.getId(), aHome,
                Map.of("small_cargo", 1L), "1:7:8", Fleet.Mission.TRANSPORT, Resources.of(6000, 0, 0))).getCode());
        // brak trytu na paliwo
        assertEquals("not_enough_resources", assertThrows(GameException.class, () -> send(attacker.getId(), aHome,
                Map.of("small_cargo", 1L), "1:7:8", Fleet.Mission.TRANSPORT, Resources.of(1000, 0, 0))).getCode());
        var est = f.game.fleets().estimate(attacker.getId(), aHome, Map.of("small_cargo", 1L), "1:7:8", 100);
        f.giveResources(aHome, 0, 0, est.fuel());
        send(attacker.getId(), aHome, Map.of("small_cargo", 1L), "1:7:8", Fleet.Mission.TRANSPORT,
                Resources.of(1000, 0, 0));
        assertEquals(0, f.store.planet(aHome).orElseThrow().getResources().tritium(), 1e-6);
    }

    @Test
    public void attackFightsLootsAndLeavesDebris() {
        f.setUnits(aHome, Map.of("cruiser", 50L, "large_cargo", 10L));
        f.setResearch(attacker.getId(), Map.of("combustion_drive", 6, "impulse_drive", 4, "computer_tech", 3));
        f.giveResources(aHome, 0, 0, 100_000);
        f.setUnits(dHome, Map.of("light_fighter", 10L, "rocket_launcher", 20L));
        f.giveResources(dHome, 50_000, 30_000, 10_000);

        var m = send(attacker.getId(), aHome, Map.of("cruiser", 50L, "large_cargo", 10L), "1:7:8",
                Fleet.Mission.ATTACK, Resources.ZERO);
        land(m);

        List<Message> reports = f.game.messages().inbox(attacker.getId(), Message.Type.COMBAT, 10);
        assertEquals(1, reports.size());
        Reports.CombatReport report = Json.read(reports.get(0).payload(), Reports.CombatReport.class);
        assertEquals("ATTACKER", report.outcome());
        assertTrue(report.loot().total() > 0);
        assertEquals(1, f.game.messages().inbox(defender.getId(), Message.Type.COMBAT, 10).size());

        Planet def = f.store.planet(dHome).orElseThrow();
        assertEquals(0, def.count("light_fighter"));
        assertTrue("czesc obrony odbudowana", def.count("rocket_launcher") > 0);
        DebrisField debris = f.store.debris(Coordinates.parse("1:7:8")).orElseThrow();
        assertEquals(10 * 4000 * 0.3, debris.resources().total(), 1e-6);

        Fleet back = f.store.fleetsOf(attacker.getId()).get(0);
        assertEquals(Fleet.Status.RETURNING, back.getStatus());
        assertEquals(report.loot(), back.getCargo());
        comeHome(m);
        Planet home = f.store.planet(aHome).orElseThrow();
        assertTrue(home.getResources().metal() >= report.loot().metal());
    }

    @Test
    public void defeatedAttackerFleetIsDestroyed() {
        f.setUnits(aHome, Map.of("light_fighter", 2L));
        f.giveResources(aHome, 0, 0, 10_000);
        f.setUnits(dHome, Map.of("plasma_turret", 5L));
        var m = send(attacker.getId(), aHome, Map.of("light_fighter", 2L), "1:7:8", Fleet.Mission.ATTACK, Resources.ZERO);
        land(m);
        assertTrue(f.store.fleetsOf(attacker.getId()).isEmpty());
        assertEquals(5, f.store.planet(dHome).orElseThrow().count("plasma_turret"));
    }

    @Test
    public void protectionsBlockAttacks() {
        f.setUnits(aHome, Map.of("light_fighter", 5L));
        f.giveResources(aHome, 0, 0, 10_000);
        // ochrona poczatkujacych
        f.setPoints(defender.getId(), 100);
        assertEquals("newbie_protection", assertThrows(GameException.class, () -> send(attacker.getId(), aHome,
                Map.of("light_fighter", 5L), "1:7:8", Fleet.Mission.ATTACK, Resources.ZERO)).getCode());
        f.setPoints(defender.getId(), 10_000);
        // urlop
        f.editPlayer(defender.getId(), p -> p.setVacationUntil(f.clock.instant().plusSeconds(3600)));
        assertEquals("target_vacation", assertThrows(GameException.class, () -> send(attacker.getId(), aHome,
                Map.of("light_fighter", 5L), "1:7:8", Fleet.Mission.ATTACK, Resources.ZERO)).getCode());
        // wlasna planeta
        assertEquals("same_planet", assertThrows(GameException.class, () -> send(attacker.getId(), aHome,
                Map.of("light_fighter", 5L), "1:5:8", Fleet.Mission.ATTACK, Resources.ZERO)).getCode());
    }

    @Test
    public void fleetSlotsLimited() {
        f.setResearch(attacker.getId(), Map.of("combustion_drive", 1, "computer_tech", 0));
        f.setUnits(aHome, Map.of("light_fighter", 5L));
        f.giveResources(aHome, 1000, 0, 10_000);
        send(attacker.getId(), aHome, Map.of("light_fighter", 1L), "1:7:8", Fleet.Mission.TRANSPORT, Resources.of(10, 0, 0));
        assertEquals("no_fleet_slots", assertThrows(GameException.class, () -> send(attacker.getId(), aHome,
                Map.of("light_fighter", 1L), "1:7:8", Fleet.Mission.TRANSPORT, Resources.of(10, 0, 0))).getCode());
    }

    @Test
    public void recallReturnsAfterElapsedTime() {
        f.setUnits(aHome, Map.of("light_fighter", 3L));
        f.giveResources(aHome, 0, 0, 10_000);
        var m = send(attacker.getId(), aHome, Map.of("light_fighter", 3L), "1:7:8", Fleet.Mission.ATTACK, Resources.ZERO);
        f.advance(Duration.ofSeconds(100));
        var r = f.game.fleets().recall(attacker.getId(), m.id());
        assertEquals("RETURNING", r.status());
        assertEquals(f.clock.instant().plusSeconds(100), r.returnAt());
        f.advance(Duration.ofSeconds(100));
        assertTrue(f.store.fleetsOf(attacker.getId()).isEmpty());
        assertEquals(3, f.store.planet(aHome).orElseThrow().count("light_fighter"));
        assertTrue(f.game.messages().inbox(defender.getId(), Message.Type.COMBAT, 10).isEmpty());
    }

    @Test
    public void espionageReportDependsOnProbes() {
        f.setUnits(aHome, Map.of("espionage_probe", 8L));
        f.giveResources(aHome, 0, 0, 1000);
        f.setBuildings(dHome, Map.of("metal_mine", 7));
        var m = send(attacker.getId(), aHome, Map.of("espionage_probe", 8L), "1:7:8", Fleet.Mission.ESPIONAGE, Resources.ZERO);
        land(m);
        var msgs = f.game.messages().inbox(attacker.getId(), Message.Type.ESPIONAGE, 10);
        assertEquals(1, msgs.size());
        Reports.EspionageReport report = Json.read(msgs.get(0).payload(), Reports.EspionageReport.class);
        assertNotNull(report.buildings());
        assertEquals(7, (int) report.buildings().get("metal_mine"));
        assertNotNull(report.research());
        assertFalse(report.probesDestroyed());
        assertEquals(1, f.game.messages().inbox(defender.getId(), Message.Type.ESPIONAGE, 10).size());
        // misja szpiegowska wymaga samych sond
        f.setUnits(aHome, Map.of("light_fighter", 1L));
        comeHome(m);
        assertEquals("probes_only", assertThrows(GameException.class, () -> send(attacker.getId(), aHome,
                Map.of("espionage_probe", 1L, "light_fighter", 1L), "1:7:8", Fleet.Mission.ESPIONAGE,
                Resources.ZERO)).getCode());
    }

    @Test
    public void singleProbeSeesOnlyResources() {
        f.setUnits(aHome, Map.of("espionage_probe", 1L));
        f.giveResources(aHome, 0, 0, 1000);
        var m = send(attacker.getId(), aHome, Map.of("espionage_probe", 1L), "1:7:8", Fleet.Mission.ESPIONAGE, Resources.ZERO);
        land(m);
        Reports.EspionageReport report = Json.read(
                f.game.messages().inbox(attacker.getId(), Message.Type.ESPIONAGE, 1).get(0).payload(),
                Reports.EspionageReport.class);
        assertNotNull(report.resources());
        assertNull(report.fleet());
        assertNull(report.buildings());
    }

    @Test
    public void colonizationCreatesPlanetWithinLimit() {
        f.setUnits(aHome, Map.of("colony_ship", 2L, "small_cargo", 1L));
        f.giveResources(aHome, 2000, 0, 50_000);
        assertEquals("planet_limit", assertThrows(GameException.class, () -> send(attacker.getId(), aHome,
                Map.of("colony_ship", 1L), "1:5:3", Fleet.Mission.COLONIZE, Resources.ZERO)).getCode());
        f.setResearch(attacker.getId(), Map.of("astrophysics", 1));
        var m = send(attacker.getId(), aHome, Map.of("colony_ship", 1L, "small_cargo", 1L), "1:5:3",
                Fleet.Mission.COLONIZE, Resources.of(1000, 0, 0));
        land(m);
        List<Planet> planets = f.store.planetsOf(attacker.getId());
        assertEquals(2, planets.size());
        Planet colony = planets.stream().filter(p -> !p.isHomeworld()).findFirst().orElseThrow();
        assertEquals(Coordinates.parse("1:5:3"), colony.coordinates());
        assertEquals(1, colony.count("small_cargo"));
        assertEquals(0, colony.count("colony_ship"));
        assertEquals(1000, colony.getResources().metal(), 1e-9);
        assertTrue(f.store.fleetsOf(attacker.getId()).isEmpty());
        // druga kolonia przekracza limit (astrofizyka 1 -> 2 planety)
        assertEquals("planet_limit", assertThrows(GameException.class, () -> send(attacker.getId(), aHome,
                Map.of("colony_ship", 1L), "1:5:4", Fleet.Mission.COLONIZE, Resources.ZERO)).getCode());
    }

    @Test
    public void colonizationFailsWhenPositionTakenOnArrival() {
        f.setResearch(attacker.getId(), Map.of("astrophysics", 3, "impulse_drive", 3));
        f.setUnits(aHome, Map.of("colony_ship", 1L));
        f.giveResources(aHome, 0, 0, 50_000);
        var m = send(attacker.getId(), aHome, Map.of("colony_ship", 1L), "1:9:9", Fleet.Mission.COLONIZE, Resources.ZERO);
        // ktos inny zajmuje pozycje w trakcie lotu
        Player third = f.register("Third");
        f.moveTo(third.getHomePlanetId(), "1:9:9");
        land(m);
        assertEquals(Fleet.Status.RETURNING, f.store.fleetsOf(attacker.getId()).get(0).getStatus());
        comeHome(m);
        assertEquals(1, f.store.planet(aHome).orElseThrow().count("colony_ship"));
    }

    @Test
    public void recyclersHarvestDebris() {
        f.store.inTransaction(() -> f.store.save(new DebrisField(Coordinates.parse("1:7:8"), Resources.of(30_000, 10_000, 0))));
        f.setUnits(aHome, Map.of("recycler", 1L));
        f.giveResources(aHome, 0, 0, 10_000);
        var m = send(attacker.getId(), aHome, Map.of("recycler", 1L), "1:7:8", Fleet.Mission.RECYCLE, Resources.ZERO);
        land(m);
        DebrisField rest = f.store.debris(Coordinates.parse("1:7:8")).orElseThrow();
        assertEquals(Resources.of(20_000, 0, 0), rest.resources());
        comeHome(m);
        double metal = f.store.planet(aHome).orElseThrow().getResources().metal();
        assertTrue(metal >= 10_000);
        assertEquals("no_debris", assertThrows(GameException.class, () -> send(attacker.getId(), aHome,
                Map.of("recycler", 1L), "1:7:9", Fleet.Mission.RECYCLE, Resources.ZERO)).getCode());
    }

    @Test
    public void deployMovesShipsPermanently() {
        f.setResearch(attacker.getId(), Map.of("astrophysics", 1, "combustion_drive", 6, "computer_tech", 3));
        Planet colony = new Planet();
        f.store.inTransaction(() -> {
            colony.setId(f.store.nextId("planet"));
            colony.setOwnerId(attacker.getId());
            colony.setName("Kolonia");
            colony.setCoordinates(Coordinates.parse("1:5:10"));
            colony.setFields(100);
            colony.setLastUpdate(f.clock.instant());
            f.store.save(colony);
        });
        f.setUnits(aHome, Map.of("light_fighter", 4L));
        f.giveResources(aHome, 0, 0, 1000);
        var m = send(attacker.getId(), aHome, Map.of("light_fighter", 4L), "1:5:10", Fleet.Mission.DEPLOY, Resources.ZERO);
        land(m);
        assertEquals(4, f.store.planet(colony.getId()).orElseThrow().count("light_fighter"));
        assertTrue(f.store.fleetsOf(attacker.getId()).isEmpty());
        assertEquals("not_own_planet", assertThrows(GameException.class, () -> send(attacker.getId(), colony.getId(),
                Map.of("light_fighter", 1L), "1:7:8", Fleet.Mission.DEPLOY, Resources.ZERO)).getCode());
    }

    @Test
    public void overviewShowsIncomingHostileFleetWithoutDetails() {
        f.setUnits(aHome, Map.of("light_fighter", 3L));
        f.giveResources(aHome, 0, 0, 10_000);
        send(attacker.getId(), aHome, Map.of("light_fighter", 3L), "1:7:8", Fleet.Mission.ATTACK, Resources.ZERO);
        Views.Overview o = f.game.planets().overview(defender.getId(), dHome);
        assertEquals(1, o.fleets().size());
        Views.FleetMovement incoming = o.fleets().get(0);
        assertFalse(incoming.own());
        assertEquals("ATTACK", incoming.mission());
        assertTrue(incoming.ships().isEmpty());
    }
}
