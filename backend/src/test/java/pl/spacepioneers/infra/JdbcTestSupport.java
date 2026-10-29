package pl.spacepioneers.infra;

import org.flywaydb.core.Flyway;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import pl.spacepioneers.game.GameFixture;

import javax.sql.DataSource;

/**
 * Testy integracyjne na prawdziwym PostgreSQL. Baza wskazywana zmiennymi TEST_DB_URL / TEST_DB_USER /
 * TEST_DB_PASSWORD (domyslnie lokalna baza spacepioneers_test). Kazdy test zaczyna od czystego schematu.
 */
public final class JdbcTestSupport {

    private static DataSource dataSource;

    private JdbcTestSupport() {
    }

    public static synchronized DataSource dataSource() {
        if (dataSource == null) {
            String url = env("TEST_DB_URL", "jdbc:postgresql://localhost:5432/spacepioneers_test");
            dataSource = new DriverManagerDataSource(url, env("TEST_DB_USER", "postgres"), env("TEST_DB_PASSWORD", ""));
        }
        return dataSource;
    }

    private static String env(String key, String def) {
        String v = System.getenv(key);
        return v == null || v.isBlank() ? def : v;
    }

    public static void resetSchema() {
        Flyway flyway = Flyway.configure().dataSource(dataSource()).cleanDisabled(false).load();
        flyway.clean();
        flyway.migrate();
    }

    public static GameFixture fixture() {
        resetSchema();
        DataSource ds = dataSource();
        return new GameFixture(new JdbcGameStore(new JdbcTemplate(ds), new DataSourceTransactionManager(ds)));
    }
}
