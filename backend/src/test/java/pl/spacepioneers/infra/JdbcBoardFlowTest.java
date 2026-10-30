package pl.spacepioneers.infra;

import pl.spacepioneers.game.BoardFlowTest;
import pl.spacepioneers.game.GameFixture;

/** Te same scenariusze co {@link BoardFlowTest}, ale na PostgreSQL (klucze obce, unikalnosc, JSONB, zdarzenia SQL). */
public class JdbcBoardFlowTest extends BoardFlowTest {

    @Override
    protected GameFixture createFixture() {
        return JdbcTestSupport.fixture();
    }
}
