package pl.spacepioneers.game.bot;

import org.junit.Test;
import pl.spacepioneers.game.GameFixture;
import pl.spacepioneers.game.model.BotBrain;
import pl.spacepioneers.game.model.Planet;
import pl.spacepioneers.game.model.Player;

import java.time.Duration;
import java.util.List;
import java.util.Random;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/**
 * Symulacja swiata z botami: kilka dni gry w przyspieszonym zegarze. Sprawdza, ze boty rozwijaja sie
 * (budynki, badania, flota), szpieguja i atakuja, ucza sie (zmieniaja kierunek) i nie lamia zasad.
 */
public class BotSimulationTest {

    protected GameFixture createFixture() {
        return new GameFixture();
    }

    protected int days() {
        return Integer.getInteger("botDays", 16);
    }

    @Test
    public void botsGrowFightAndLearn() {
        GameFixture f = createFixture();
        Player human = f.register("Czlowiek");
        Random r = new Random(7);
        int n = 24;
        for (int i = 0; i < n; i++) f.game.bots().create(r);
        assertEquals(n, f.game.bots().botCount());
        assertTrue("czlowiek pozostaje administratorem", f.player(human.getId()).isAdmin());

        long turns = 0;
        int days = days();
        long t0 = System.currentTimeMillis();
        for (int step = 0; step < days * 24 * 6; step++) {
            f.clock.advance(Duration.ofMinutes(10));
            f.game.tick();
            turns += f.game.bots().runDue(100);
            if (step % 6 == 0) f.game.ranking().recompute();
        }
        f.game.ranking().recompute();
        long ms = System.currentTimeMillis() - t0;

        List<Player> bots = f.store.players().stream().filter(Player::isBot).toList();
        double minPoints = Double.MAX_VALUE, sumPoints = 0;
        int withShipyard = 0, withResearch = 0, withFleet = 0, colonies = 0, spied = 0, attacked = 0, refocused = 0;
        for (Player b : bots) {
            BotBrain brain = b.getBot();
            minPoints = Math.min(minPoints, b.getScore().total());
            sumPoints += b.getScore().total();
            List<Planet> planets = f.store.planetsOf(b.getId());
            colonies += planets.size() - 1;
            if (planets.stream().anyMatch(p -> p.level("shipyard") > 0)) withShipyard++;
            if (b.getResearch().values().stream().mapToInt(Integer::intValue).sum() > 0) withResearch++;
            if (b.getScore().fleet() > 0) withFleet++;
            if (brain.getTargets().values().stream().anyMatch(t -> t.lastSpy != null)) spied++;
            if (brain.getTargets().values().stream().anyMatch(t -> t.attacks > 0)) attacked++;
            if (brain.getRewardCounts().values().stream().mapToInt(Integer::intValue).sum() > 1) refocused++;
            assertFalse("bot nie zostaje administratorem", b.isAdmin());
            assertTrue("bot jest aktywny", b.getLastActivity().isAfter(f.clock.instant().minus(Duration.ofDays(1))));
        }
        System.out.printf("Symulacja %d dni, %d botow: %d tur w %d ms%n", days, n, turns, ms);
        System.out.printf("punkty: min %.0f, srednio %.0f; stocznia %d, badania %d, flota %d, kolonie %d, szpiegowali %d, atakowali %d, zmienili kierunek %d%n",
                minPoints, sumPoints / n, withShipyard, withResearch, withFleet, colonies, spied, attacked, refocused);
        for (Player b : bots.subList(0, 6)) {
            System.out.printf("  %-20s %-9s %6.0f pkt, cel: %s, wagi %s%n", b.getUsername(), b.getBot().getPersonality(),
                    b.getScore().total(), b.getBot().getFocus(), b.getBot().getWeights());
        }

        assertEquals("tury bez bledow", 0, f.game.bots().failedTurns());
        assertTrue("boty rozgrywaja tury", turns > n * days * 5L);
        assertTrue("kazdy bot sie rozwija", minPoints > 5);
        assertTrue("wiekszosc ma stocznie", withShipyard >= n * 0.7);
        assertTrue("wiekszosc prowadzi badania", withResearch >= n * 0.8);
        assertTrue("czesc buduje flote", withFleet >= n * 0.4);
        assertTrue("boty szpieguja", spied >= n / 4);
        assertTrue("boty atakuja", attacked >= 2);
        assertTrue("boty zmieniaja kierunek rozwoju (uczenie)", refocused >= n / 2);
    }

    @Test
    public void spawningIsGradualAndNeedsHumanAdmin() {
        GameFixture f = new GameFixture();
        assertEquals("pusty serwer - bez botow", 0, f.game.bots().spawnDue(7, 5));
        Player human = f.register("Admin");
        int afterWeek = -1;
        for (int min = 0; min < 14 * 24 * 60; min += 5) {
            f.clock.advance(Duration.ofMinutes(5));
            f.game.bots().spawnDue(7, 5);
            if (min == 7 * 24 * 60) afterWeek = f.game.bots().botCount();
        }
        assertTrue("najwyzej 5 na tydzien: " + afterWeek, afterWeek >= 3 && afterWeek <= 5);
        assertEquals("docelowo 7", 7, f.game.bots().botCount());
        assertTrue(f.player(human.getId()).isAdmin());
        for (Player p : f.store.players()) {
            if (!p.isBot()) continue;
            assertTrue("bot ma potwierdzony adres i zgode", p.isEmailVerified() && p.getTermsVersion() > 0);
            assertTrue("nick zgodny z zasadami", p.getUsername().matches("^[\\p{L}\\p{N}_.-]{3,20}$"));
        }
    }
}
