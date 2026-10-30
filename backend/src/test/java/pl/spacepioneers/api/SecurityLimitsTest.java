package pl.spacepioneers.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import pl.spacepioneers.infra.JdbcTestSupport;
import pl.spacepioneers.security.LoginThrottle;

import java.time.Clock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Limity zapytan i trwala blokada logowania. */
@SpringBootTest(properties = {
        "spacepioneers.rate-limit.auth-per-minute=12",
        "spacepioneers.rate-limit.api-per-minute=60",
        "spacepioneers.rate-limit.api-burst=5"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityLimitsTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void cleanDatabase() {
        JdbcTestSupport.resetSchema();
    }

    private int login(String ip, String login, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").with(r -> {
                    r.setRemoteAddr(ip);
                    return r;
                }).contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"" + login + "\",\"password\":\"" + password + "\"}")).andReturn().getResponse().getStatus();
    }

    @Test
    void loginLockIsPersistentAndSharedAcrossInstances() throws Exception {
        mvc.perform(post("/api/auth/register").with(r -> { r.setRemoteAddr("10.0.0.1"); return r; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"Ofiara\",\"email\":\"ofiara@example.com\",\"password\":\"haslo12345\",\"acceptTerms\":true}"))
                .andExpect(status().isCreated());
        for (int i = 0; i < LoginThrottle.MAX_FAILURES; i++) {
            assertThat(login("10.0.0.2", "Ofiara", "zle-haslo")).isEqualTo(403);
        }
        // nawet poprawne haslo jest odrzucane do konca blokady
        mvc.perform(post("/api/auth/login").with(r -> { r.setRemoteAddr("10.0.0.3"); return r; })
                        .contentType(MediaType.APPLICATION_JSON).content("{\"login\":\"ofiara\",\"password\":\"haslo12345\",\"acceptTerms\":true}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("login_locked"));
        // nowa instancja (np. po restarcie) widzi te sama blokade
        assertThat(new LoginThrottle(jdbc, Clock.systemUTC()).isLocked("OFIARA")).isTrue();
    }

    @Test
    void authEndpointsAreLimitedPerIp() throws Exception {
        int limited = 0;
        for (int i = 0; i < 14; i++) {
            if (login("10.1.1.1", "nikt" + i, "x") == 429) limited++;
        }
        assertThat(limited).isEqualTo(2);
        // inny adres ma wlasny limit
        assertThat(login("10.1.1.2", "nikt", "x")).isEqualTo(403);
    }

    @Test
    void apiIsLimitedPerClient() throws Exception {
        int ok = 0;
        int limited = 0;
        for (int i = 0; i < 8; i++) {
            int s = mvc.perform(get("/api/config").with(r -> { r.setRemoteAddr("10.2.2.2"); return r; }))
                    .andReturn().getResponse().getStatus();
            if (s == 200) ok++;
            if (s == 429) limited++;
        }
        assertThat(ok).isBetween(5, 6);
        assertThat(limited).isEqualTo(8 - ok);
        mvc.perform(get("/api/config").with(r -> { r.setRemoteAddr("10.2.2.3"); return r; })).andExpect(status().isOk());
        mvc.perform(get("/api/config").with(r -> { r.setRemoteAddr("10.2.2.2"); return r; }))
                .andExpect(jsonPath("$.code").value("rate_limited"));
    }
}
