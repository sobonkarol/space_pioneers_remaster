package pl.spacepioneers.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import pl.spacepioneers.infra.JdbcTestSupport;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Konto przez HTTP: potwierdzenie e-mail, reset hasla, zmiana adresu, usuwanie, blokady i panel administratora. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AccountApiTest {

    private static final Pattern TOKEN = Pattern.compile("token=([A-Za-z0-9_%-]+)");

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @BeforeEach
    void cleanDatabase() {
        JdbcTestSupport.resetSchema();
    }

    private JsonNode register(String name) throws Exception {
        MvcResult r = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + name + "\",\"email\":\"" + name + "@example.com\",\"password\":\"haslo12345\",\"acceptTerms\":true}"))
                .andExpect(status().isCreated()).andReturn();
        return json.readTree(r.getResponse().getContentAsString());
    }

    private String bearer(JsonNode auth) {
        return "Bearer " + auth.get("token").asText();
    }

    /** Najnowszy token z linku w wiadomosci do danego adresu i o danym fragmencie sciezki. */
    private String lastToken(String email, String path) throws Exception {
        JsonNode box = json.readTree(mvc.perform(get("/api/dev/outbox")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        for (JsonNode m : box) {
            String text = m.get("text").asText();
            if (m.get("to").asText().equals(email) && text.contains(path)) {
                Matcher mt = TOKEN.matcher(text);
                if (mt.find()) return java.net.URLDecoder.decode(mt.group(1), java.nio.charset.StandardCharsets.UTF_8);
            }
        }
        throw new AssertionError("Brak wiadomosci do " + email);
    }

    private void login(String login, String password, int expected) throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + login + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().is(expected));
    }

    @Test
    void verifyEmailWithLinkFromMessage() throws Exception {
        JsonNode auth = register("Weryfikator");
        assertThat(auth.at("/profile/emailVerified").asBoolean()).isFalse();
        String token = lastToken("weryfikator@example.com", "/verify");

        mvc.perform(post("/api/auth/verify").contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/me").header("Authorization", bearer(auth)))
                .andExpect(jsonPath("$.emailVerified").value(true));
        // token jednorazowy
        mvc.perform(post("/api/auth/verify").contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("token_invalid"));
        mvc.perform(post("/api/me/verification").header("Authorization", bearer(auth)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("already_verified"));
    }

    @Test
    void resendIsLimitedPerHour() throws Exception {
        JsonNode auth = register("Spamer");
        mvc.perform(post("/api/me/verification").header("Authorization", bearer(auth))).andExpect(status().isNoContent());
        mvc.perform(post("/api/me/verification").header("Authorization", bearer(auth))).andExpect(status().isNoContent());
        mvc.perform(post("/api/me/verification").header("Authorization", bearer(auth)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("too_many_requests"));
    }

    @Test
    void passwordResetRevokesSessions() throws Exception {
        JsonNode auth = register("Zapominalski");
        mvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"nieistnieje@example.com\"}")).andExpect(status().isNoContent());
        mvc.perform(post("/api/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"Zapominalski@example.com\"}")).andExpect(status().isNoContent());
        String token = lastToken("zapominalski@example.com", "/reset-password");

        mvc.perform(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\",\"password\":\"krotkie\",\"acceptTerms\":true}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\",\"password\":\"nowehaslo123\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/me").header("Authorization", bearer(auth))).andExpect(status().isUnauthorized());
        login("Zapominalski", "haslo12345", 403);
        login("Zapominalski", "nowehaslo123", 200);
    }

    @Test
    void changeEmailAndScheduleDeletion() throws Exception {
        JsonNode auth = register("Zmieniacz");
        String t = bearer(auth);
        mvc.perform(post("/api/me/email").header("Authorization", t).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nowy@example.com\",\"password\":\"zle\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/me/email").header("Authorization", t).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nowy@example.com\",\"password\":\"haslo12345\",\"acceptTerms\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.email").value("nowy@example.com"))
                .andExpect(jsonPath("$.emailVerified").value(false));
        assertThat(lastToken("nowy@example.com", "/verify")).isNotBlank();

        mvc.perform(post("/api/me/deletion").header("Authorization", t).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"haslo12345\",\"acceptTerms\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.deletionAt").exists());
        mvc.perform(get("/api/me").header("Authorization", t)).andExpect(jsonPath("$.deletionAt").exists());
        mvc.perform(delete("/api/me/deletion").header("Authorization", t)).andExpect(status().isNoContent());
        mvc.perform(get("/api/me").header("Authorization", t)).andExpect(jsonPath("$.deletionAt").doesNotExist());
    }

    @Test
    void adminBansPlayerAndPilloryShowsIt() throws Exception {
        JsonNode admin = register("Szef");
        JsonNode bad = register("Oszust");
        long badId = bad.at("/profile/id").asLong();
        String a = bearer(admin);

        mvc.perform(get("/api/admin/stats").header("Authorization", bearer(bad))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/stats").header("Authorization", a))
                .andExpect(status().isOk()).andExpect(jsonPath("$.players").value(2));
        mvc.perform(get("/api/admin/players?q=osz").header("Authorization", a))
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].username").value("Oszust"));

        mvc.perform(post("/api/admin/players/" + badId + "/ban").header("Authorization", a)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"hours\":48,\"reason\":\"Multikonto\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.bannedUntil").exists());
        // sesje zablokowanego wygasaja, logowanie odrzucone z powodem
        mvc.perform(get("/api/me").header("Authorization", bearer(bad))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"Oszust\",\"password\":\"haslo12345\",\"acceptTerms\":true}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("account_banned"));

        mvc.perform(get("/api/pillory")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].playerName").value("Oszust"))
                .andExpect(jsonPath("$[0].reason").value("Multikonto"))
                .andExpect(jsonPath("$[0].adminName").value("Szef"));

        mvc.perform(post("/api/admin/players/" + badId + "/unban").header("Authorization", a)).andExpect(status().isOk());
        login("Oszust", "haslo12345", 200);

        mvc.perform(post("/api/admin/announce").header("Authorization", a).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"subject\":\"Nowa wersja\",\"body\":\"Dodano księżyce.\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.recipients").value(2));
        mvc.perform(get("/api/admin/log").header("Authorization", a))
                .andExpect(jsonPath("$[0].action").value("ANNOUNCE"))
                .andExpect(jsonPath("$[1].action").value("UNBAN"))
                .andExpect(jsonPath("$[2].action").value("BAN"));

        mvc.perform(post("/api/admin/players/" + badId + "/delete").header("Authorization", a)).andExpect(status().isNoContent());
        mvc.perform(get("/api/admin/stats").header("Authorization", a)).andExpect(jsonPath("$.players").value(1));
        login("Oszust", "haslo12345", 403);
    }

    @Test
    void publicBoardReadableWithoutLoginWritableOnlyLoggedIn() throws Exception {
        JsonNode auth = register("Forumowicz");
        mvc.perform(get("/api/board")).andExpect(status().isOk()).andExpect(jsonPath("$.loggedIn").value(false));
        mvc.perform(post("/api/board/threads").contentType(MediaType.APPLICATION_JSON)
                .content("{\"category\":\"GENERAL\",\"title\":\"x\",\"text\":\"y\"}")).andExpect(status().isUnauthorized());
        MvcResult r = mvc.perform(post("/api/board/threads").header("Authorization", bearer(auth))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"BUGS\",\"title\":\"Błąd\",\"text\":\"Opis\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("NEW")).andReturn();
        long id = json.readTree(r.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(get("/api/board/threads/" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.posts[0].text").value("Opis")).andExpect(jsonPath("$.canReply").value(false));
        mvc.perform(get("/api/board").header("Authorization", bearer(auth))).andExpect(jsonPath("$.loggedIn").value(true));
    }

    @Test
    void registrationRequiresTermsAndDataCanBeExported() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"Bezzgody\",\"email\":\"bez@example.com\",\"password\":\"haslo12345\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("terms_required"));
        mvc.perform(get("/api/config")).andExpect(jsonPath("$.legal.termsVersion").value(1));

        JsonNode auth = register("Zgodny");
        assertThat(auth.at("/profile/termsAccepted").asBoolean()).isTrue();
        String t = bearer(auth);
        mvc.perform(post("/api/me/terms").header("Authorization", t))
                .andExpect(status().isOk()).andExpect(jsonPath("$.termsAccepted").value(true));

        MvcResult r = mvc.perform(get("/api/me/export").header("Authorization", t))
                .andExpect(status().isOk()).andReturn();
        assertThat(r.getResponse().getHeader("Content-Disposition")).contains("attachment");
        JsonNode data = json.readTree(r.getResponse().getContentAsString());
        assertThat(data.at("/account/username").asText()).isEqualTo("Zgodny");
        assertThat(data.at("/account/email").asText()).isEqualTo("zgodny@example.com");
        assertThat(data.at("/account/termsVersion").asInt()).isEqualTo(1);
        assertThat(data.get("planets").size()).isEqualTo(1);
        assertThat(data.get("messages").size()).isGreaterThan(0);
        assertThat(r.getResponse().getContentAsString()).doesNotContain("passwordHash").doesNotContain("$2a$");
    }
}
