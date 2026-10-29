package pl.spacepioneers.infra;

import pl.spacepioneers.game.AccountAdminFlowTest;
import pl.spacepioneers.game.GameFixture;

/** Te same scenariusze co {@link AccountAdminFlowTest}, ale na PostgreSQL (klucze obce, unikalnosc, JSONB, zdarzenia SQL). */
public class JdbcAccountAdminFlowTest extends AccountAdminFlowTest {

    @Override
    protected GameFixture createFixture() {
        return JdbcTestSupport.fixture();
    }
}
