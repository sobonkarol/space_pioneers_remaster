package pl.spacepioneers.infra;

import pl.spacepioneers.game.ToolsFlowTest;
import pl.spacepioneers.game.GameFixture;

/** Te same scenariusze co {@link ToolsFlowTest}, ale na PostgreSQL (klucze obce, unikalnosc, JSONB, zdarzenia SQL). */
public class JdbcToolsFlowTest extends ToolsFlowTest {

    @Override
    protected GameFixture createFixture() {
        return JdbcTestSupport.fixture();
    }
}
