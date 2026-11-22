package com.lolstats.web;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lolstats.common.Db;
import com.lolstats.common.GlobalExceptionHandler;
import com.lolstats.data.Catalog;
import com.lolstats.data.DDragonClient;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class LeaderboardControllerTest {
    private Db db;
    private Catalog catalog;
    private DDragonClient dd;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        db = mock(Db.class);
        catalog = mock(Catalog.class);
        dd = mock(DDragonClient.class);
        LeaderboardController controller = new LeaderboardController(db, catalog, dd);
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void returns503WhenCatalogNotReady() throws Exception {
        when(catalog.latestPatch()).thenReturn(null);

        mvc.perform(get("/v1/leaderboard"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.code").value("DATA_NOT_READY"));
    }

    @Test
    void returnsLeaderboardData() throws Exception {
        when(catalog.latestPatch()).thenReturn("14.23.1");
        when(dd.profileIconUrl(eq("14.23.1"), anyInt())).thenReturn("https://ddragon/icon.png");

        when(db.rows(contains("FROM leaderboard_entries"), any(), any(), any())).thenReturn(List.of(
                Map.of("rank", 1, "puuid", "p1", "game_name", "Faker", "tag_line", "T1",
                        "division", "I", "league_points", 1500, "wins", 100, "losses", 40, "profile_icon_id", 10)));

        when(db.one(contains("SELECT max(updated_at) AS at"), any(), any())).thenReturn(Map.of("at", "2026-11-18T10:00:00Z"));

        mvc.perform(get("/v1/leaderboard").param("region", "kr").param("tier", "challenger"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].rank").value(1))
                .andExpect(jsonPath("$.data[0].gameName").value("Faker"))
                .andExpect(jsonPath("$.meta.region").value("kr"))
                .andExpect(jsonPath("$.meta.total").value(1));
    }
}
