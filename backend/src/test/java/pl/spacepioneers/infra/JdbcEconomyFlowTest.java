package pl.spacepioneers.infra;

import pl.spacepioneers.game.EconomyFlowTest;
import pl.spacepioneers.game.GameFixture;

/** Te same scenariusze co {@link EconomyFlowTest}, ale na PostgreSQL (klucze obce, unikalnosc, JSONB, zdarzenia SQL). */
public class JdbcEconomyFlowTest extends EconomyFlowTest {

    @Override
    protected GameFixture createFixture() {
        return JdbcTestSupport.fixture();
    }
}
