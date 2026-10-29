package pl.spacepioneers.infra;

import pl.spacepioneers.game.SocialFlowTest;
import pl.spacepioneers.game.GameFixture;

/** Te same scenariusze co {@link SocialFlowTest}, ale na PostgreSQL (klucze obce, unikalnosc, JSONB, zdarzenia SQL). */
public class JdbcSocialFlowTest extends SocialFlowTest {

    @Override
    protected GameFixture createFixture() {
        return JdbcTestSupport.fixture();
    }
}
