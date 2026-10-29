package pl.spacepioneers.infra;

import pl.spacepioneers.game.AdvancedFlowTest;
import pl.spacepioneers.game.GameFixture;

/** Scenariusze mechanik zaawansowanych na PostgreSQL. */
public class JdbcAdvancedFlowTest extends AdvancedFlowTest {

    @Override
    protected GameFixture createFixture() {
        return JdbcTestSupport.fixture();
    }
}
