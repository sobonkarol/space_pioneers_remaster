package pl.spacepioneers.infra;

import pl.spacepioneers.game.FleetFlowTest;
import pl.spacepioneers.game.GameFixture;

/** Te same scenariusze co {@link FleetFlowTest}, ale na PostgreSQL (klucze obce, unikalnosc, JSONB, zdarzenia SQL). */
public class JdbcFleetFlowTest extends FleetFlowTest {

    @Override
    protected GameFixture createFixture() {
        return JdbcTestSupport.fixture();
    }
}
