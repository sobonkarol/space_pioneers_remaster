package pl.spacepioneers.infra;

import pl.spacepioneers.game.SocialExtrasFlowTest;
import pl.spacepioneers.game.GameFixture;

/** Te same scenariusze co {@link SocialExtrasFlowTest}, ale na PostgreSQL (klucze obce, unikalnosc, JSONB, zdarzenia SQL). */
public class JdbcSocialExtrasFlowTest extends SocialExtrasFlowTest {

    @Override
    protected GameFixture createFixture() {
        return JdbcTestSupport.fixture();
    }
}
