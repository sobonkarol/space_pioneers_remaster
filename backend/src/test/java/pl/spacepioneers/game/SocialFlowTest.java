package pl.spacepioneers.game;

import org.junit.Test;
import pl.spacepioneers.engine.common.Branch;
import pl.spacepioneers.engine.common.ResourceType;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.game.model.Fleet;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.Treaty;
import pl.spacepioneers.game.service.AllianceService;
import pl.spacepioneers.game.service.FleetService.SendRequest;
import pl.spacepioneers.game.service.Views;

import java.time.Duration;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public class SocialFlowTest {

    protected final GameFixture f = createFixture();

    /** Podklasy testow integracyjnych podmieniaja magazyn (np. na PostgreSQL). */
    protected GameFixture createFixture() {
        return new GameFixture();
    }

    @Test
    public void allianceLifecycle() {
        Player founder = f.register("Founder");
        Player member = f.register("Member");
        AllianceService a = f.game.alliances();
        var view = a.create(founder.getId(), "SPX", "Space Pioneers Elite");
        assertEquals("FOUNDER", view.myRank());
        assertEquals("tag_taken", assertThrows(GameException.class,
                () -> a.create(member.getId(), "spx", "Other")).getCode());

        a.apply(member.getId(), view.id(), "Przyjmijcie mnie");
        var leaderView = a.view(founder.getId(), view.id());
        assertEquals(1, leaderView.applications().size());
        assertTrue("czlonek nie widzi zgloszen", a.view(member.getId(), view.id()).applications().isEmpty());
        a.decideApplication(founder.getId(), leaderView.applications().get(0).id(), true);
        assertEquals(view.id(), (long) f.player(member.getId()).getAllianceId());
        assertEquals(2, a.view(founder.getId(), view.id()).memberCount());

        // zwykly czlonek nie moze wysylac okolnikow
        assertThrows(GameException.class, () -> a.circular(member.getId(), "x", "y"));
        assertEquals(2, a.circular(founder.getId(), "Zbiórka", "Atakujemy o 20:00"));
        assertFalse(f.game.messages().inbox(member.getId(), Message.Type.ALLIANCE, 10).isEmpty());

        // zalozyciel nie moze odejsc, ale moze przekazac przywodztwo
        assertThrows(GameException.class, () -> a.leave(founder.getId()));
        a.setRank(founder.getId(), member.getId(), Player.AllianceRank.FOUNDER);
        assertEquals(Player.AllianceRank.OFFICER, f.player(founder.getId()).getAllianceRank());
        a.leave(founder.getId());
        assertNull(f.player(founder.getId()).getAllianceId());

        a.dissolve(member.getId());
        assertNull(f.player(member.getId()).getAllianceId());
        assertTrue(a.list().isEmpty());
    }

    @Test
    public void diplomacyBlocksAttacksBetweenPacts() {
        Player x = f.register("Xavier");
        Player y = f.register("Yvonne");
        f.moveTo(x.getHomePlanetId(), "1:1:5");
        f.moveTo(y.getHomePlanetId(), "1:2:5");
        f.setPoints(x.getId(), 10_000);
        f.setPoints(y.getId(), 10_000);
        AllianceService a = f.game.alliances();
        var ax = a.create(x.getId(), "AX", "Alliance X");
        var ay = a.create(y.getId(), "AY", "Alliance Y");
        a.proposeTreaty(x.getId(), "AY", Treaty.Type.NON_AGGRESSION);
        var treaties = a.view(y.getId(), ay.id()).treaties();
        assertEquals("PROPOSED", treaties.get(0).status());
        assertThrows(GameException.class, () -> a.acceptTreaty(x.getId(), treaties.get(0).id()));
        a.acceptTreaty(y.getId(), treaties.get(0).id());

        f.setResearch(x.getId(), Map.of("combustion_drive", 1));
        f.setUnits(x.getHomePlanetId(), Map.of("light_fighter", 1L));
        f.giveResources(x.getHomePlanetId(), 0, 0, 1000);
        SendRequest attack = new SendRequest(x.getHomePlanetId(), Map.of("light_fighter", 1L), "1:2:5",
                Fleet.Mission.ATTACK, 100, Resources.ZERO);
        assertEquals("diplomacy", assertThrows(GameException.class,
                () -> f.game.fleets().send(x.getId(), attack)).getCode());

        // zakonczenie paktu i wypowiedzenie wojny
        a.endTreaty(x.getId(), treaties.get(0).id());
        a.proposeTreaty(x.getId(), "AY", Treaty.Type.WAR);
        assertEquals("ACTIVE", a.view(x.getId(), ax.id()).treaties().get(0).status());
        f.game.fleets().send(x.getId(), attack);
    }

    @Test
    public void rankingCountsEverything() {
        // pierwszy gracz serwera jest administratorem - ma punkty, ale nie bierze udzialu w rankingu
        Player admin = f.register("Szef");
        f.setUnits(admin.getHomePlanetId(), Map.of("battleship", 50L));
        Player p = f.register("Karol");
        Player q = f.register("Anna");
        f.setBuildings(p.getHomePlanetId(), Map.of("metal_mine", 2));
        f.setResearch(p.getId(), Map.of("energy_tech", 1));
        f.setUnits(q.getHomePlanetId(), Map.of("small_cargo", 1L));
        f.game.ranking().recompute();
        Player rp = f.player(p.getId());
        Player rq = f.player(q.getId());
        assertEquals(0.187, rp.getScore().buildings(), 1e-9);
        assertEquals(1.2, rp.getScore().research(), 1e-9);
        assertEquals(4.0, rq.getScore().fleet(), 1e-9);
        assertEquals(1, rq.getRank());
        assertEquals(2, rp.getRank());
        Views.RankingPage page = f.game.ranking().page("players", "total", 1);
        assertEquals(2, page.total());
        assertEquals("Anna", page.rows().get(0).name());
        assertEquals(2, page.rows().size());
        assertEquals("specjalizacja widoczna w rankingu", "NONE", page.rows().get(0).branch());
        Player ra = f.player(admin.getId());
        assertTrue("administrator ma punkty", ra.getScore().total() > rq.getScore().total());
        assertEquals(0, ra.getRank());
        assertTrue("administrator poza rankingiem", page.rows().stream().noneMatch(r -> r.name().equals("Szef")));
        Views.RankingPage research = f.game.ranking().page("players", "research", 1);
        assertEquals("Karol", research.rows().get(0).name());
        assertThrows(GameException.class, () -> f.game.ranking().page("players", "bogus", 1));
    }

    @Test
    public void branchAndMarket() {
        Player p = f.register("Trader");
        assertEquals("branch_points", assertThrows(GameException.class,
                () -> f.game.players().chooseBranch(p.getId(), Branch.TRADER)).getCode());
        f.setPoints(p.getId(), 1500);
        f.game.players().chooseBranch(p.getId(), Branch.TRADER);
        assertThrows(GameException.class, () -> f.game.players().chooseBranch(p.getId(), Branch.WARRIOR));
        long planet = p.getHomePlanetId();
        assertEquals("market_unavailable", assertThrows(GameException.class,
                () -> f.game.market().exchange(p.getId(), planet, ResourceType.METAL, ResourceType.CRYSTAL, 300)).getCode());
        f.setBuildings(planet, Map.of("trade_center", 1, "robotics_factory", 2));
        var r = f.game.market().exchange(p.getId(), planet, ResourceType.METAL, ResourceType.CRYSTAL, 300);
        // 300 metalu = 100 wartosci = 200 krysztalu, prowizja 9.5%
        assertEquals(181, r.received());
        assertEquals(200, r.resources().metal(), 1e-9);
        assertEquals(681, r.resources().crystal(), 1e-9);
    }

    @Test
    public void vacationStopsProductionAndBlocksActions() {
        Player p = f.register("Sleeper");
        long planet = p.getHomePlanetId();
        f.game.players().enableVacation(p.getId());
        f.advance(Duration.ofHours(10));
        var o = f.game.planets().overview(p.getId(), planet);
        assertEquals(500, o.resources().amount().metal(), 1e-9);
        assertEquals("vacation_mode", assertThrows(GameException.class,
                () -> f.game.planets().enqueue(p.getId(), planet, "metal_mine")).getCode());
        assertEquals("vacation_minimum", assertThrows(GameException.class,
                () -> f.game.players().disableVacation(p.getId())).getCode());
        f.advance(Duration.ofHours(40));
        f.game.players().disableVacation(p.getId());
        f.advance(Duration.ofHours(1));
        assertEquals(530, f.game.planets().overview(p.getId(), planet).resources().amount().metal(), 1e-9);
    }

    @Test
    public void galaxyViewShowsPlanetsFlagsAndDebris() {
        Player p = f.register("Viewer");
        Player q = f.register("Neighbour");
        f.moveTo(p.getHomePlanetId(), "2:3:4");
        f.moveTo(q.getHomePlanetId(), "2:3:9");
        f.setPoints(p.getId(), 100_000);
        f.setPoints(q.getId(), 10);
        f.editPlayer(q.getId(), x -> x.setLastActivity(f.clock.instant().minus(Duration.ofDays(10))));
        Views.GalaxyView g = f.game.galaxy().system(p.getId(), 2, 3);
        assertEquals(15, g.rows().size());
        assertTrue(g.rows().get(3).own());
        Views.GalaxyRow n = g.rows().get(8);
        assertEquals("Neighbour", n.ownerName());
        assertTrue(n.flags().contains("i"));
        assertNull(g.rows().get(0).planetId());
        assertThrows(GameException.class, () -> f.game.galaxy().system(p.getId(), 3, 1));
    }

    @Test
    public void privateMessages() {
        Player p = f.register("Alice");
        Player q = f.register("Bob");
        f.game.messages().send(p.getId(), "bob", "Cześć", "Handel?");
        var inbox = f.game.messages().inbox(q.getId(), Message.Type.PRIVATE, 10);
        assertEquals(1, inbox.size());
        assertEquals("Alice", inbox.get(0).senderName());
        assertEquals(2, f.game.messages().unread(q.getId()));
        f.game.messages().read(q.getId(), inbox.get(0).id());
        assertEquals(1, f.game.messages().unread(q.getId()));
        assertThrows(GameException.class, () -> f.game.messages().read(p.getId(), inbox.get(0).id()));
        f.game.messages().delete(q.getId(), inbox.get(0).id());
        assertTrue(f.game.messages().inbox(q.getId(), Message.Type.PRIVATE, 10).isEmpty());
        assertThrows(GameException.class, () -> f.game.messages().send(p.getId(), "nobody", "a", "b"));
    }

    @Test
    public void allianceDescriptionAllowsSafeHtml() {
        Player p = f.register("Lider");
        Player q = f.register("Gosc");
        long allianceId = f.game.alliances().create(p.getId(), "HTML", "Sojusz z banerem").id();
        f.game.alliances().update(p.getId(), "<center><font color=\"#f90\"><b>Witaj!</b></font></center>"
                + "<img src=\"https://example.com/b.gif\" onerror=\"alert(1)\"><script>steal()</script>", null, null);
        String desc = f.game.alliances().view(q.getId(), allianceId).description();
        assertTrue(desc, desc.contains("<center>") && desc.contains("<b>Witaj!</b>") && desc.contains("https://example.com/b.gif"));
        assertFalse(desc, desc.contains("script") || desc.contains("onerror") || desc.contains("steal"));
    }
}
