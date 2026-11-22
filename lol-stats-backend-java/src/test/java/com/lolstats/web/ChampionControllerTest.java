package com.lolstats.web;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.Api;
import com.lolstats.common.Db;
import com.lolstats.common.GlobalExceptionHandler;
import com.lolstats.data.Catalog;
import com.lolstats.data.Catalog.ChampionRef;
import com.lolstats.data.DDragonClient;
import com.lolstats.query.StatsQueries;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ChampionControllerTest {
    private static final ObjectMapper OM = new ObjectMapper();

    private Db db;
    private Catalog catalog;
    private DDragonClient dd;
    private StatsQueries stats;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        db = mock(Db.class);
        catalog = mock(Catalog.class);
        dd = mock(DDragonClient.class);
        stats = mock(StatsQueries.class);

        ChampionController controller = new ChampionController(db, catalog, dd, stats);
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listChampionsReturnsMappedList() throws Exception {
        when(catalog.resolveStaticPatch("latest")).thenReturn("14.23.1");
        when(dd.championImageUrl(eq("14.23.1"), any())).thenReturn("https://ddragon/Ahri.png");
        when(dd.splashUrl("Ahri")).thenReturn("https://ddragon/Ahri_splash.jpg");

        when(db.rows(contains("FROM champions WHERE"), any())).thenReturn(List.of(
                Api.obj("key", 103, "id", "Ahri", "name", "Ahri", "title", "Fox", "blurb", "b",
                        "tags", List.of("Mage"), "partype", "Mana", "info", OM.readTree("{}"),
                        "stats", OM.readTree("{}"), "image", OM.readTree("{\"full\":\"Ahri.png\"}"),
                        "patch", "14.23.1")));

        mvc.perform(get("/v1/champions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value("Ahri"))
                .andExpect(jsonPath("$.data[0].key").value(103))
                .andExpect(jsonPath("$.meta.patch").value("14.23.1"));
    }

    @Test
    void detailChampionReturnsFullInfo() throws Exception {
        when(catalog.resolveStaticPatch("latest")).thenReturn("14.23.1");
        when(catalog.resolveChampion("Ahri")).thenReturn(new ChampionRef(103, "Ahri", "Ahri", "Ahri.png"));
        when(dd.championImageUrl(eq("14.23.1"), any())).thenReturn("https://ddragon/Ahri.png");
        when(dd.splashUrl("Ahri")).thenReturn("https://ddragon/Ahri_splash.jpg");

        Map<String, Object> champRow = Api.obj(
                "key", 103, "id", "Ahri", "name", "Ahri", "title", "Fox", "blurb", "b",
                "lore", "Ahri lore", "tags", List.of("Mage"), "partype", "Mana",
                "info", OM.readTree("{}"), "stats", OM.readTree("{}"),
                "image", OM.readTree("{\"full\":\"Ahri.png\"}"),
                "passive", OM.readTree("{}"), "spells", OM.readTree("[]"),
                "skins", OM.readTree("[]"), "patch", "14.23.1");

        when(db.one(contains("FROM champions WHERE key = ? AND patch = ?"), eq(103), eq("14.23.1")))
                .thenReturn(champRow);

        mvc.perform(get("/v1/champions/Ahri"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("Ahri"))
                .andExpect(jsonPath("$.data.lore").value("Ahri lore"));
    }

    @Test
    void statsEndpointReturnsAggregatedData() throws Exception {
        when(catalog.resolveChampion("Ahri")).thenReturn(new ChampionRef(103, "Ahri", "Ahri", "Ahri.png"));
        when(catalog.resolveAnalyticsPatch("latest")).thenReturn("14.23,14.22");

        when(stats.championStats(any(), eq(103))).thenReturn(Map.of(
                "totalMatches", 5000,
                "games", 600,
                "winRate", 0.52));

        mvc.perform(get("/v1/champions/Ahri/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.championId").value("Ahri"))
                .andExpect(jsonPath("$.data.games").value(600))
                .andExpect(jsonPath("$.data.winRate").value(0.52))
                .andExpect(jsonPath("$.meta.totalMatches").value(5000));
    }
}
