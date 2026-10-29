package pl.spacepioneers.game;

import org.junit.Before;
import org.junit.Test;
import pl.spacepioneers.engine.common.Coordinates;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.engine.data.UnitDef;
import pl.spacepioneers.game.model.Buddy;
import pl.spacepioneers.game.model.Fleet;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.service.FleetService.SendRequest;
import pl.spacepioneers.game.service.Reports;
import pl.spacepioneers.game.service.Views;
import pl.spacepioneers.game.store.Json;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

/** Scenariusze mechanik zaawansowanych: ksiezyce, falanga, teleporter, rakiety, ataki i obrona sojusznicza, ekspedycje. */
public class AdvancedFlowTest {

    protected final GameFixture f = createFixture();

    protected GameFixture createFixture() {
        return new GameFixture();
    }

    private Player a;
    private Player b;
    private Player c;
    private long aHome;
    private long bHome;
    private long cHome;

    @Before
    public void setUp() {
        a = f.register("Alfa");
        b = f.register("Beta");
        c = f.register("Gamma");
        aHome = a.getHomePlanetId();
        bHome = b.getHomePlanetId();
        cHome = c.getHomePlanetId();
        f.moveTo(aHome, "1:5:8");
        f.moveTo(bHome, "1:7:8");
        f.moveTo(cHome, "1:6:4");
        for (Player p : List.of(a, b, c)) {
            f.setPoints(p.getId(), 50_000);
            f.setResearch(p.getId(), Map.of("combustion_drive", 6, "impulse_drive", 6, "computer_tech", 5,
                    "hyperspace_drive", 4, "hyperspace_tech", 7, "astrophysics", 4));
        }
    }

    private Views.FleetMovement send(long player, long planet, Map<String, Long> ships, String target,
                                     Fleet.Mission mission, boolean moon, Long union, Integer hours) {
        return f.game.fleets().send(player, new SendRequest(planet, ships, target, mission, 100, Resources.ZERO, moon, union, hours));
    }

    private void until(Instant at) {
        f.advance(Duration.between(f.clock.instant(), at));
    }

    private Planet makeMoon(long ownerId, String coords) {
        Planet moon = new Planet();
        f.store.inTransaction(() -> {
            moon.setId(f.store.nextId("planet"));
            moon.setOwnerId(ownerId);
            moon.setMoon(true);
            moon.setName("Księżyc");
            moon.setCoordinates(Coordinates.parse(coords));
            moon.setFields(1);
            moon.setPlanetType("moon");
            moon.setImageVariant(1);
            moon.setLastUpdate(f.clock.instant());
            f.store.save(moon);
        });
        return moon;
    }

    @Test
    public void moonIsCreatedFromLargeDebrisField() {
        boolean created = false;
        for (int i = 0; i < 40 && !created; i++) {
            f.setUnits(aHome, Map.of("battleship", 400L));
            f.setUnits(bHome, Map.of("cruiser", 300L));
            f.giveResources(aHome, 0, 0, 1_000_000);
            var m = send(a.getId(), aHome, Map.of("battleship", 400L), "1:7:8", Fleet.Mission.ATTACK, false, null, null);
            until(m.arriveAt());
            created = f.store.moonAt(Coordinates.parse("1:7:8")).isPresent();
            Reports.CombatReport r = Json.read(f.game.messages().inbox(a.getId(), Message.Type.COMBAT, 1).get(0).payload(),
                    Reports.CombatReport.class);
            assertEquals(20, r.moonChancePercent());
            assertEquals(created, r.moonCreated());
            until(f.store.fleetsOf(a.getId()).get(0).getReturnAt());
        }
        assertTrue("ksiezyc powinien powstac przy szansie 20%", created);
        Planet moon = f.store.moonAt(Coordinates.parse("1:7:8")).orElseThrow();
        assertEquals(b.getId(), moon.getOwnerId());
        // ksiezyc pojawia sie na liscie planet i w galaktyce
        assertTrue(f.game.planets().planets(b.getId()).stream().anyMatch(Views.PlanetRef::moon));
        var row = f.game.galaxy().system(a.getId(), 1, 7).rows().get(7);
        assertEquals(moon.getId(), (long) row.moonId());
    }

    @Test
    public void moonBuildingsAndProduction() {
        Planet moon = makeMoon(b.getId(), "1:7:8");
        f.giveResources(moon.getId(), 1e7, 1e7, 1e7);
        var options = f.game.planets().buildings(b.getId(), moon.getId());
        assertTrue(options.stream().anyMatch(o -> o.key().equals("lunar_base")));
        assertFalse(options.stream().anyMatch(o -> o.key().equals("metal_mine")));
        assertEquals("wrong_location", assertThrows(GameException.class,
                () -> f.game.planets().enqueue(b.getId(), moon.getId(), "metal_mine")).getCode());
        assertEquals("wrong_location", assertThrows(GameException.class,
                () -> f.game.planets().enqueue(b.getId(), bHome, "lunar_base")).getCode());
        var item = f.game.planets().enqueue(b.getId(), moon.getId(), "lunar_base");
        until(item.end());
        var o = f.game.planets().overview(b.getId(), moon.getId());
        assertEquals(4, o.fieldsMax());
        assertEquals(0, o.resources().perHour().metal(), 1e-9);
    }

    @Test
    public void phalanxSeesFleetsAndCostsTritium() {
        Planet moon = makeMoon(c.getId(), "1:6:4");
        f.setBuildings(moon.getId(), Map.of("lunar_base", 1, "sensor_phalanx", 2));
        f.giveResources(moon.getId(), 0, 0, 6000);
        f.setUnits(aHome, Map.of("small_cargo", 1L));
        f.giveResources(aHome, 1000, 0, 1000);
        f.game.fleets().send(a.getId(), new SendRequest(aHome, Map.of("small_cargo", 1L), "1:7:8",
                Fleet.Mission.TRANSPORT, 100, Resources.of(500, 0, 0)));
        var seen = f.game.fleets().phalanx(c.getId(), moon.getId(), "1:7:8");
        assertEquals(1, seen.size());
        assertEquals("TRANSPORT", seen.get(0).mission());
        assertEquals(1L, (long) seen.get(0).ships().get("small_cargo"));
        assertEquals("not_enough_resources", assertThrows(GameException.class,
                () -> f.game.fleets().phalanx(c.getId(), moon.getId(), "1:7:8")).getCode());
        assertEquals("out_of_range", assertThrows(GameException.class,
                () -> f.game.fleets().phalanx(c.getId(), moon.getId(), "1:15:8")).getCode());
    }

    @Test
    public void jumpGateMovesShipsInstantly() {
        Planet m1 = makeMoon(a.getId(), "1:5:8");
        Planet m2 = makeMoon(a.getId(), "1:9:8");
        f.setBuildings(m1.getId(), Map.of("lunar_base", 1, "jump_gate", 1));
        f.setBuildings(m2.getId(), Map.of("lunar_base", 1, "jump_gate", 1));
        f.setUnits(m1.getId(), Map.of("cruiser", 10L));
        f.game.fleets().jump(a.getId(), m1.getId(), m2.getId(), Map.of("cruiser", 6L));
        assertEquals(6, f.store.planet(m2.getId()).orElseThrow().count("cruiser"));
        assertEquals(4, f.store.planet(m1.getId()).orElseThrow().count("cruiser"));
        assertEquals("jump_cooldown", assertThrows(GameException.class,
                () -> f.game.fleets().jump(a.getId(), m2.getId(), m1.getId(), Map.of("cruiser", 1L))).getCode());
        f.advance(Duration.ofHours(2));
        f.game.fleets().jump(a.getId(), m2.getId(), m1.getId(), Map.of("cruiser", 1L));
    }

    @Test
    public void missilesInterceptedAndDestroyDefense() {
        f.setBuildings(aHome, Map.of("shipyard", 4, "missile_silo", 4));
        f.giveResources(aHome, 1e6, 1e6, 1e6);
        var options = f.game.shipyard().list(a.getId(), aHome, UnitDef.UnitType.DEFENSE);
        var ipm = options.stream().filter(o -> o.key().equals("interplanetary_missile")).findFirst().orElseThrow();
        assertEquals(20, ipm.maxBuildable()); // 40 miejsc / 2
        assertEquals("silo_full", assertThrows(GameException.class,
                () -> f.game.shipyard().order(a.getId(), aHome, "interplanetary_missile", 21)).getCode());
        f.setUnits(aHome, Map.of("interplanetary_missile", 10L));
        f.setResearch(a.getId(), Map.of("impulse_drive", 1)); // zasieg 4 systemy
        f.setUnits(bHome, Map.of("anti_ballistic_missile", 3L, "rocket_launcher", 100L, "heavy_laser", 5L));
        assertEquals("out_of_range", assertThrows(GameException.class,
                () -> f.game.fleets().launchMissiles(a.getId(), aHome, "1:19:8", 5, null)).getCode());
        var m = f.game.fleets().launchMissiles(a.getId(), aHome, "1:7:8", 10, "heavy_laser");
        assertEquals(1, f.game.fleets().dispatchInfo(a.getId(), aHome).slotsUsed() + 1);
        until(m.arriveAt());
        Planet target = f.store.planet(bHome).orElseThrow();
        assertEquals(0, target.count("anti_ballistic_missile"));
        assertEquals(0, target.count("heavy_laser"));
        assertTrue(target.count("rocket_launcher") < 100);
        assertTrue(f.store.fleetsOf(a.getId()).isEmpty());
        assertFalse(f.game.messages().inbox(b.getId(), Message.Type.COMBAT, 5).isEmpty());
    }

    @Test
    public void allianceDefenseJoinsCombat() {
        var ally = f.game.alliances().create(b.getId(), "BC", "Bravo Charlie");
        f.game.alliances().apply(c.getId(), ally.id(), "");
        long appId = f.game.alliances().view(b.getId(), ally.id()).applications().get(0).id();
        f.game.alliances().decideApplication(b.getId(), appId, true);
        // obrona sojusznicza - tylko dla sojusznikow
        f.setUnits(aHome, Map.of("cruiser", 5L));
        f.giveResources(aHome, 0, 0, 10_000);
        assertEquals("not_allied", assertThrows(GameException.class, () -> send(a.getId(), aHome,
                Map.of("cruiser", 1L), "1:7:8", Fleet.Mission.HOLD, false, null, 2)).getCode());

        f.setUnits(cHome, Map.of("battleship", 50L));
        f.giveResources(cHome, 0, 0, 100_000);
        var hold = send(c.getId(), cHome, Map.of("battleship", 50L), "1:7:8", Fleet.Mission.HOLD, false, null, 4);
        until(hold.arriveAt());
        Fleet holding = f.store.fleetsOf(c.getId()).get(0);
        assertEquals(Fleet.Status.HOLDING, holding.getStatus());

        var attack = send(a.getId(), aHome, Map.of("cruiser", 5L), "1:7:8", Fleet.Mission.ATTACK, false, null, null);
        until(attack.arriveAt());
        Reports.CombatReport r = Json.read(f.game.messages().inbox(a.getId(), Message.Type.COMBAT, 1).get(0).payload(),
                Reports.CombatReport.class);
        assertEquals(2, r.defenders().size());
        assertEquals("DEFENDER", r.outcome());
        assertEquals(1, f.game.messages().inbox(c.getId(), Message.Type.COMBAT, 5).size());
        // po czasie postoju flota wraca
        until(holding.getHoldUntil());
        assertEquals(Fleet.Status.RETURNING, f.store.fleetsOf(c.getId()).get(0).getStatus());
    }

    @Test
    public void allianceAttackSynchronisesArrivalAndSharesLoot() {
        var ally = f.game.alliances().create(a.getId(), "AC", "Alfa Gamma");
        f.game.alliances().apply(c.getId(), ally.id(), "");
        long appId = f.game.alliances().view(a.getId(), ally.id()).applications().get(0).id();
        f.game.alliances().decideApplication(a.getId(), appId, true);
        f.giveResources(bHome, 100_000, 100_000, 100_000);
        f.setUnits(aHome, Map.of("large_cargo", 5L, "cruiser", 10L));
        f.setUnits(cHome, Map.of("large_cargo", 5L, "cruiser", 10L));
        f.giveResources(aHome, 0, 0, 100_000);
        f.giveResources(cHome, 0, 0, 100_000);
        var first = send(a.getId(), aHome, Map.of("large_cargo", 5L, "cruiser", 10L), "1:7:8", Fleet.Mission.ATTACK, false, null, null);
        var union = f.game.fleets().createUnion(a.getId(), first.id(), "Wspólny");
        assertEquals("forbidden", assertThrows(GameException.class, () -> send(c.getId(), cHome,
                Map.of("cruiser", 1L), "1:7:8", Fleet.Mission.ATTACK, false, union.id(), null)).getCode());
        f.game.fleets().invite(a.getId(), union.id(), "Gamma");
        assertEquals(1, f.game.fleets().unions(c.getId()).size());
        var second = send(c.getId(), cHome, Map.of("large_cargo", 5L, "cruiser", 10L), "1:7:8", Fleet.Mission.ATTACK,
                false, union.id(), null);
        Fleet fa = f.store.fleet(first.id()).orElseThrow();
        Fleet fc = f.store.fleet(second.id()).orElseThrow();
        assertEquals(fa.getArriveAt(), fc.getArriveAt());
        until(fa.getArriveAt());
        Reports.CombatReport r = Json.read(f.game.messages().inbox(c.getId(), Message.Type.COMBAT, 1).get(0).payload(),
                Reports.CombatReport.class);
        assertEquals(2, r.attackers().size());
        assertEquals("ATTACKER", r.outcome());
        Fleet ra = f.store.fleet(first.id()).orElseThrow();
        Fleet rc = f.store.fleet(second.id()).orElseThrow();
        assertTrue(ra.getCargo().total() > 0 && rc.getCargo().total() > 0);
        assertEquals(r.loot().total(), ra.getCargo().total() + rc.getCargo().total(), 1.0);
        assertTrue(f.store.unions().isEmpty());
    }

    @Test
    public void buddiesCanHold() {
        f.game.buddies().request(a.getId(), "Beta", "Cześć");
        var list = f.game.buddies().list(b.getId());
        assertEquals(1, list.size());
        assertTrue(list.get(0).incoming());
        f.game.buddies().respond(b.getId(), list.get(0).id(), true);
        assertEquals("ACCEPTED", f.game.buddies().list(a.getId()).get(0).status());
        assertTrue(f.store.buddiesOf(a.getId()).stream().allMatch(x -> x.status() == Buddy.Status.ACCEPTED));
        f.setUnits(aHome, Map.of("cruiser", 2L));
        f.giveResources(aHome, 0, 0, 10_000);
        var hold = send(a.getId(), aHome, Map.of("cruiser", 2L), "1:7:8", Fleet.Mission.HOLD, false, null, 1);
        until(hold.arriveAt());
        assertEquals(Fleet.Status.HOLDING, f.store.fleetsOf(a.getId()).get(0).getStatus());
        // zawrocenie z postoju
        var back = f.game.fleets().recall(a.getId(), hold.id());
        assertEquals("RETURNING", back.status());
        assertThrows(GameException.class, () -> f.game.buddies().request(a.getId(), "Beta", ""));
    }

    @Test
    public void expeditionsReturnWithOutcome() {
        f.setResearch(a.getId(), Map.of("astrophysics", 1, "combustion_drive", 6));
        f.setUnits(aHome, Map.of("large_cargo", 20L));
        f.giveResources(aHome, 0, 0, 1_000_000);
        assertEquals("invalid_expedition", assertThrows(GameException.class, () -> send(a.getId(), aHome,
                Map.of("large_cargo", 1L), "1:5:15", Fleet.Mission.EXPEDITION, false, null, 1)).getCode());
        int outcomes = 0;
        for (int i = 0; i < 6; i++) {
            if (f.store.planet(aHome).orElseThrow().count("large_cargo") < 2) break;
            var e = send(a.getId(), aHome, Map.of("large_cargo", 2L), "1:5:16", Fleet.Mission.EXPEDITION, false, null, 1);
            assertEquals("expedition_limit", assertThrows(GameException.class, () -> send(a.getId(), aHome,
                    Map.of("large_cargo", 1L), "1:5:16", Fleet.Mission.EXPEDITION, false, null, 1)).getCode());
            until(e.arriveAt());
            assertEquals(Fleet.Status.HOLDING, f.store.fleet(e.id()).orElseThrow().getStatus());
            f.advance(Duration.ofHours(2));
            outcomes++;
            f.store.fleet(e.id()).ifPresent(fl -> until(fl.getReturnAt()));
            f.advance(Duration.ofHours(4));
        }
        assertTrue(outcomes >= 3);
        long reports = f.game.messages().inbox(a.getId(), null, 100).stream()
                .filter(m -> m.subject().contains("ekspedycji") || m.subject().contains("piratów")).count();
        assertEquals(outcomes, reports);
        assertNotNull(f.player(a.getId()));
    }
}
