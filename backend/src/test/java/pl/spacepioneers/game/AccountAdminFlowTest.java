package pl.spacepioneers.game;

import org.junit.Before;
import org.junit.Test;
import pl.spacepioneers.engine.common.Resources;
import pl.spacepioneers.game.model.Alliance;
import pl.spacepioneers.game.model.Message;
import pl.spacepioneers.game.model.Player;
import pl.spacepioneers.game.model.Player.AllianceRank;
import pl.spacepioneers.game.service.AccountService;
import pl.spacepioneers.game.service.AdminService;
import pl.spacepioneers.game.service.FleetService.SendRequest;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

/** Konto i administracja: e-mail, usuwanie konta, blokady, uprawnienia, ogloszenia. */
public class AccountAdminFlowTest {

    protected final GameFixture f = createFixture();

    protected GameFixture createFixture() {
        return new GameFixture();
    }

    private Player admin;
    private Player alice;
    private Player bob;

    @Before
    public void setUp() {
        admin = f.register("Admin");
        alice = f.register("Alicja");
        bob = f.register("Bogdan");
    }

    @Test
    public void firstPlayerIsAdminAndOthersAreNot() {
        assertTrue(f.player(admin.getId()).isAdmin());
        assertFalse(f.player(alice.getId()).isAdmin());
        GameException e = assertThrows(GameException.class, () -> f.game.admin().stats(alice.getId()));
        assertEquals("not_admin", e.getCode());
    }

    @Test
    public void emailVerificationAndChange() {
        assertFalse(f.player(alice.getId()).isEmailVerified());
        f.game.accounts().markEmailVerified(alice.getId(), "alicja@example.com");
        assertTrue(f.player(alice.getId()).isEmailVerified());
        assertTrue(f.game.players().profile(alice.getId()).emailVerified());

        f.game.accounts().changeEmail(alice.getId(), "Nowy@Example.com");
        Player p = f.player(alice.getId());
        assertEquals("nowy@example.com", p.getEmail());
        assertFalse(p.isEmailVerified());
        // link wydany dla starego adresu nie potwierdza nowego
        assertEquals("token_invalid", assertThrows(GameException.class,
                () -> f.game.accounts().markEmailVerified(alice.getId(), "alicja@example.com")).getCode());
        assertEquals("email_taken", assertThrows(GameException.class,
                () -> f.game.accounts().changeEmail(alice.getId(), "bogdan@example.com")).getCode());
        assertEquals("invalid_email", assertThrows(GameException.class,
                () -> f.game.accounts().changeEmail(alice.getId(), "zly-adres")).getCode());
    }

    @Test
    public void accountDeletionAfterGracePeriodCanBeCancelled() {
        Instant at = f.game.accounts().requestDeletion(alice.getId());
        assertEquals(f.clock.instant().plus(AccountService.DELETION_DELAY), at);
        assertEquals("deletion_pending", assertThrows(GameException.class,
                () -> f.game.accounts().requestDeletion(alice.getId())).getCode());
        f.game.accounts().cancelDeletion(alice.getId());
        assertNull(f.player(alice.getId()).getDeletionAt());

        f.game.accounts().requestDeletion(alice.getId());
        f.advance(Duration.ofDays(6));
        assertTrue(f.game.accounts().purgeDeleted().isEmpty());
        f.advance(Duration.ofDays(1).plusMinutes(1));
        assertEquals(List.of(alice.getId()), f.game.accounts().purgeDeleted());
        assertTrue(f.store.player(alice.getId()).isEmpty());
        assertTrue(f.store.planetsOf(alice.getId()).isEmpty());
        assertTrue(f.store.planet(alice.getHomePlanetId()).isEmpty());
        assertTrue(f.store.messagesOf(alice.getId(), null, 50).isEmpty());
    }

    @Test
    public void deletingFounderHandsAllianceToOfficerAndRemovesFleets() {
        var view = f.game.alliances().create(alice.getId(), "ALI", "Alianci");
        f.game.alliances().apply(bob.getId(), view.id(), "hej");
        long appId = f.store.applicationOf(bob.getId()).orElseThrow().id();
        f.game.alliances().decideApplication(alice.getId(), appId, true);
        f.game.buddies().request(alice.getId(), "Admin", "");

        f.setResearch(alice.getId(), Map.of("combustion_drive", 2));
        f.setUnits(alice.getHomePlanetId(), Map.of("small_cargo", 1L));
        f.giveResources(alice.getHomePlanetId(), 1000, 0, 1000);
        String target = f.home(bob).coordinates().toString();
        f.game.fleets().send(alice.getId(), new SendRequest(alice.getHomePlanetId(), Map.of("small_cargo", 1L), target,
                pl.spacepioneers.game.model.Fleet.Mission.TRANSPORT, 100, Resources.of(100, 0, 0)));
        assertEquals(1, f.store.fleetsOf(alice.getId()).size());

        String name = f.game.admin().deleteNow(admin.getId(), alice.getId());
        assertEquals("Alicja", name);
        Player heir = f.player(bob.getId());
        assertEquals(AllianceRank.FOUNDER, heir.getAllianceRank());
        assertEquals(Long.valueOf(view.id()), heir.getAllianceId());
        assertTrue(f.store.fleetsOf(alice.getId()).isEmpty());
        assertTrue(f.store.buddiesOf(admin.getId()).isEmpty());
        assertTrue(f.store.alliance(view.id()).isPresent());

        // ostatni czlonek usuwa konto - sojusz znika
        f.game.admin().deleteNow(admin.getId(), bob.getId());
        assertTrue(f.store.alliance(view.id()).map(Alliance::getId).isEmpty());
    }

    @Test
    public void banBlocksAttacksStopsProductionAndExpires() {
        f.giveResources(bob.getHomePlanetId(), 0, 0, 0);
        double metalBefore = f.home(bob).getResources().metal();
        assertEquals("invalid_reason", assertThrows(GameException.class,
                () -> f.game.admin().ban(admin.getId(), bob.getId(), 24, " ")).getCode());
        AdminService.PlayerRow row = f.game.admin().ban(admin.getId(), bob.getId(), 24, "Multikonto");
        assertNotNull(row.bannedUntil());
        Player banned = f.player(bob.getId());
        assertTrue(banned.banned(f.clock.instant()));
        assertTrue(banned.inVacation());
        assertTrue(f.store.messagesOf(bob.getId(), Message.Type.SYSTEM, 10).stream()
                .anyMatch(m -> m.subject().equals("Konto zablokowane")));

        // galaktyka pokazuje flage "b", planety nie produkuja
        var gal = f.game.galaxy().system(alice.getId(), f.home(bob).getGalaxy(), f.home(bob).getSystem());
        assertTrue(gal.rows().stream().anyMatch(r -> r.flags().contains("b")));
        f.advance(Duration.ofHours(10));
        f.game.tick();
        f.game.planets().overview(bob.getId(), bob.getHomePlanetId());
        assertEquals(metalBefore, f.home(bob).getResources().metal(), 0.001);

        assertEquals("self_action", assertThrows(GameException.class,
                () -> f.game.admin().ban(admin.getId(), admin.getId(), 1, "x")).getCode());
        f.game.admin().setAdmin(admin.getId(), alice.getId(), true);
        assertEquals("target_admin", assertThrows(GameException.class,
                () -> f.game.admin().ban(admin.getId(), alice.getId(), 1, "x")).getCode());
        assertEquals("target_banned", assertThrows(GameException.class,
                () -> f.game.admin().setAdmin(admin.getId(), bob.getId(), true)).getCode());

        // po uplywie blokady logowanie zdejmuje ja razem z wymuszonym urlopem
        f.advance(Duration.ofHours(15));
        Player lifted = f.game.accounts().liftExpiredBan(bob.getId());
        assertNull(lifted.getBannedUntil());
        assertFalse(lifted.inVacation());
        f.advance(Duration.ofHours(1));
        f.game.planets().overview(bob.getId(), bob.getHomePlanetId());
        assertTrue(f.home(bob).getResources().metal() > metalBefore);
    }

    @Test
    public void unbanAndPermanentBan() {
        f.game.admin().ban(admin.getId(), bob.getId(), null, "Oszustwo");
        assertEquals(AdminService.PERMANENT, f.player(bob.getId()).getBannedUntil());
        f.advance(Duration.ofDays(400));
        assertNotNull(f.game.accounts().liftExpiredBan(bob.getId()).getBannedUntil());
        f.game.admin().unban(admin.getId(), bob.getId());
        Player p = f.player(bob.getId());
        assertNull(p.getBannedUntil());
        assertFalse(p.inVacation());
        assertEquals("not_banned", assertThrows(GameException.class,
                () -> f.game.admin().unban(admin.getId(), bob.getId())).getCode());
    }

    @Test
    public void voluntaryVacationSurvivesBanLift() {
        f.game.players().enableVacation(bob.getId());
        f.game.admin().ban(admin.getId(), bob.getId(), 2, "Obraźliwa nazwa");
        f.game.admin().unban(admin.getId(), bob.getId());
        assertTrue(f.player(bob.getId()).inVacation()); // urlop wlaczony przez gracza zostaje
    }

    @Test
    public void searchStatsAndAnnouncement() {
        assertEquals(1, f.game.admin().search(admin.getId(), "alic").size());
        assertEquals(1, f.game.admin().search(admin.getId(), "bogdan@").size());
        assertEquals(3, f.game.admin().search(admin.getId(), "").size());
        var stats = f.game.admin().stats(admin.getId());
        assertEquals(3, stats.players());
        assertEquals(3, stats.planets());
        assertEquals(0, stats.moons());
        var detail = f.game.admin().detail(admin.getId(), alice.getId());
        assertEquals(1, detail.planets().size());
        assertEquals("Alicja", detail.player().username());

        assertEquals(3, f.game.admin().announce(admin.getId(), "Przerwa techniczna", "Jutro o 3:00."));
        assertTrue(f.store.messagesOf(bob.getId(), Message.Type.SYSTEM, 10).stream()
                .anyMatch(m -> m.subject().equals("Przerwa techniczna") && "Administracja".equals(m.senderName())));
        assertEquals("invalid_message", assertThrows(GameException.class,
                () -> f.game.admin().announce(admin.getId(), "", "x")).getCode());
    }
}
