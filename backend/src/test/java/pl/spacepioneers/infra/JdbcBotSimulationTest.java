package pl.spacepioneers.infra;

import org.junit.Test;
import pl.spacepioneers.game.GameFixture;
import pl.spacepioneers.game.model.Player;

import java.time.Duration;
import java.util.Random;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

/**
 * Boty na PostgreSQL (krotko - pelna wielodniowa symulacja jest w BotSimulationTest na pamieci):
 * zapis "mozgu" w JSONB, tury bez bledow, rozwoj planet.
 */
public class JdbcBotSimulationTest {

    @Test
    public void botsPlayOnPostgres() {
        GameFixture f = JdbcTestSupport.fixture();
        f.register("Czlowiek");
        Random r = new Random(5);
        for (int i = 0; i < 6; i++) f.game.bots().create(r);
        long turns = 0;
        for (int step = 0; step < 2 * 24 * 6; step++) {
            f.clock.advance(Duration.ofMinutes(10));
            f.game.tick();
            turns += f.game.bots().runDue(50);
        }
        assertEquals("tury bez bledow", 0, f.game.bots().failedTurns());
        assertTrue("boty graja: " + turns, turns >= 6 * 8);
        for (Player p : f.store.players()) {
            if (!p.isBot()) continue;
            assertTrue("mozg bota zapisany w bazie", p.getBot().getTurns() > 0 && p.getBot().getNextTurn() != null);
            int levels = f.store.planetsOf(p.getId()).get(0).getBuildings().values().stream().mapToInt(Integer::intValue).sum();
            assertTrue(p.getUsername() + " rozbudowuje planete: " + levels, levels >= 8);
        }
    }
}
