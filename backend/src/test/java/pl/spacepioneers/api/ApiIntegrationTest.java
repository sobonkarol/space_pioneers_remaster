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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Testy API end-to-end: HTTP -> bezpieczenstwo -> logika -> PostgreSQL. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiIntegrationTest {

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
                        .content("{\"username\":\"" + name + "\",\"email\":\"" + name + "@example.com\",\"password\":\"haslo12345\"}"))
                .andExpect(status().isCreated()).andReturn();
        return json.readTree(r.getResponse().getContentAsString());
    }

    private String bearer(JsonNode auth) {
        return "Bearer " + auth.get("token").asText();
    }

    @Test
    void registerLoginAndPlay() throws Exception {
        JsonNode auth = register("Karol");
        long planet = auth.at("/profile/homePlanetId").asLong();
        String token = bearer(auth);

        mvc.perform(get("/api/planets/" + planet + "/overview").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.planet.id").value(planet))
                .andExpect(jsonPath("$.resources.amount.metal").value(500.0))
                .andExpect(jsonPath("$.unreadMessages").value(1));

        mvc.perform(post("/api/planets/" + planet + "/buildings/metal_mine").header("Authorization", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.level").value(1));

        mvc.perform(post("/api/planets/" + planet + "/buildings/nanite_factory").header("Authorization", token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").exists());

        MvcResult buildings = mvc.perform(get("/api/planets/" + planet + "/buildings").header("Authorization", token))
                .andExpect(status().isOk()).andReturn();
        JsonNode list = json.readTree(buildings.getResponse().getContentAsString());
        assertThat(list.size()).isEqualTo(16); // budynki planetarne (bez ksiezycowych)

        mvc.perform(put("/api/planets/" + planet + "/production").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"source\":\"metal_mine\",\"percent\":50}"))
                .andExpect(status().isOk());

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"karol\",\"password\":\"haslo12345\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").exists());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"karol\",\"password\":\"zle-haslo\"}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("bad_credentials"));
    }

    @Test
    void securityAndIsolation() throws Exception {
        JsonNode a = register("Alice");
        JsonNode b = register("Bobby");
        long alicePlanet = a.at("/profile/homePlanetId").asLong();
        mvc.perform(get("/api/planets/" + alicePlanet + "/overview")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/planets/" + alicePlanet + "/overview").header("Authorization", "Bearer nonsense"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/planets/" + alicePlanet + "/overview").header("Authorization", bearer(b)))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/auth/logout").header("Authorization", bearer(a))).andExpect(status().isNoContent());
        mvc.perform(get("/api/me").header("Authorization", bearer(a))).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/config")).andExpect(status().isOk()).andExpect(jsonPath("$.buildings.length()").value(19));
    }

    @Test
    void registrationValidation() throws Exception {
        register("Karol");
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"karol\",\"email\":\"other@example.com\",\"password\":\"haslo12345\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("username_taken"));
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"Nowy\",\"email\":\"n@example.com\",\"password\":\"krotkie\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("validation"));
    }

    @Test
    void messagesAlliancesGalaxyRanking() throws Exception {
        JsonNode a = register("Alice");
        JsonNode b = register("Bobby");
        mvc.perform(post("/api/messages").header("Authorization", bearer(a)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"to\":\"Bobby\",\"subject\":\"Hej\",\"body\":\"Cześć!\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/messages?type=PRIVATE").header("Authorization", bearer(b)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].body").value("Cześć!"));

        MvcResult created = mvc.perform(post("/api/alliances").header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"tag\":\"ALI\",\"name\":\"Alianci\"}"))
                .andExpect(status().isOk()).andReturn();
        long allianceId = json.readTree(created.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(post("/api/alliances/" + allianceId + "/apply").header("Authorization", bearer(b))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"Hej\"}"))
                .andExpect(status().isNoContent());
        MvcResult view = mvc.perform(get("/api/alliances/" + allianceId).header("Authorization", bearer(a)))
                .andExpect(status().isOk()).andReturn();
        long appId = json.readTree(view.getResponse().getContentAsString()).at("/applications/0/id").asLong();
        mvc.perform(post("/api/alliances/applications/" + appId).header("Authorization", bearer(b))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"accept\":true}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/alliances/applications/" + appId).header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"accept\":true}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/alliances/" + allianceId).header("Authorization", bearer(b)))
                .andExpect(jsonPath("$.memberCount").value(2));

        String coords = a.at("/profile/homePlanetId").asText();
        mvc.perform(get("/api/galaxy/1/1").header("Authorization", bearer(a)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.rows.length()").value(15));
        mvc.perform(get("/api/ranking").header("Authorization", bearer(a)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));
        assertThat(coords).isNotBlank();
        mvc.perform(delete("/api/messages/999999").header("Authorization", bearer(a))).andExpect(status().isNotFound());
    }
}
