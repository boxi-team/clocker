package com.lolstats.web;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.Db;
import com.lolstats.common.GlobalExceptionHandler;
import com.lolstats.config.AppProps;
import com.lolstats.data.Catalog;
import com.lolstats.data.DDragonClient;
import com.lolstats.ingest.PlayerRow;
import com.lolstats.ingest.PlayerService;
import com.lolstats.jobs.JobRow;
import com.lolstats.jobs.JobService;
import com.lolstats.query.PlayerQueries;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class PlayerControllerTest {
    private static final ObjectMapper OM = new ObjectMapper();

    private Db db;
    private Catalog catalog;
    private DDragonClient dd;
    private PlayerService players;
    private PlayerQueries queries;
    private JobService jobs;
    private AppProps props;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        db = mock(Db.class);
        catalog = mock(Catalog.class);
        dd = mock(DDragonClient.class);
        players = mock(PlayerService.class);
        queries = mock(PlayerQueries.class);
        jobs = mock(JobService.class);
        props = new AppProps("", "", "", "", "en_US", "", true, true, 2, 0.25, 20, 120, 100, 120,
                false, "euw1", 1000, "", false, "euw1", 100);

        PlayerController controller = new PlayerController(db, catalog, dd, players, queries, jobs, props);
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void getProfileReturnsPlayerData() throws Exception {
        PlayerRow player = new PlayerRow("puuid-caps", "euw1", "Caps", "G2", 750, 588, null, null, null);
        when(players.findPlayer("euw1", "Caps", "G2")).thenReturn(player);
        when(catalog.latestPatch()).thenReturn("14.23.1");
        when(dd.profileIconUrl(eq("14.23.1"), eq(588))).thenReturn("https://ddragon/icon.png");

        when(db.rows(contains("FROM player_ranks WHERE puuid = ?"), eq("puuid-caps"))).thenReturn(List.of(
                Map.of("queue", "ranked_solo", "tier", "CHALLENGER", "division", "I", "league_points", 1200, "wins", 100, "losses", 50)));

        when(queries.countIndexed("puuid-caps")).thenReturn(25);
        when(jobs.activeJobFor(anyString())).thenReturn(null);

        mvc.perform(get("/v1/players/euw1/Caps/G2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.puuid").value("puuid-caps"))
                .andExpect(jsonPath("$.data.gameName").value("Caps"))
                .andExpect(jsonPath("$.data.summonerLevel").value(750))
                .andExpect(jsonPath("$.data.matchesIndexed").value(25));
    }

    @Test
    void refreshRejectsWhenWithinCooldown() throws Exception {
        Instant recent = Instant.now().minusSeconds(10);
        PlayerRow player = new PlayerRow("puuid-caps", "euw1", "Caps", "G2", 750, 588, recent, null, null);
        when(players.findPlayer("euw1", "Caps", "G2")).thenReturn(player);

        mvc.perform(post("/v1/players/euw1/Caps/G2/refresh"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error.code").value("REFRESH_COOLDOWN"));
    }

    @Test
    void refreshEnqueuesJobWhenCooldownPassed() throws Exception {
        Instant old = Instant.now().minusSeconds(500);
        PlayerRow player = new PlayerRow("puuid-caps", "euw1", "Caps", "G2", 750, 588, old, null, null);
        when(players.findPlayer("euw1", "Caps", "G2")).thenReturn(player);

        JobRow job = new JobRow("job-123", "player_refresh", OM.readTree("{}"), "queued", 0, 0, null, null, Instant.now(), null);
        when(jobs.enqueue(eq("player_refresh"), any(), eq("player:puuid-caps"), eq(10))).thenReturn(job);

        mvc.perform(post("/v1/players/euw1/Caps/G2/refresh"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.id").value("job-123"))
                .andExpect(jsonPath("$.data.status").value("queued"));
    }
}
