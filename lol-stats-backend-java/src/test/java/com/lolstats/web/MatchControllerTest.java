package com.lolstats.web;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lolstats.common.Api;
import com.lolstats.common.Db;
import com.lolstats.common.GlobalExceptionHandler;
import com.lolstats.data.Catalog;
import com.lolstats.ingest.MatchIngestService;
import com.lolstats.ingest.Outcome;
import com.lolstats.riot.RiotNotFoundException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class MatchControllerTest {
    private Db db;
    private Catalog catalog;
    private MatchIngestService ingest;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        db = mock(Db.class);
        catalog = mock(Catalog.class);
        ingest = mock(MatchIngestService.class);
        MatchController controller = new MatchController(db, catalog, ingest);
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void rejectsInvalidMatchIdFormat() throws Exception {
        mvc.perform(get("/v1/matches/euw1/invalid-format"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_PARAMETER"));
    }

    @Test
    void rejectsRegionMismatch() throws Exception {
        mvc.perform(get("/v1/matches/eun1/EUW1_123456789"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_PARAMETER"));
    }

    @Test
    void onDemandIngestThrows422WhenUnsupportedQueue() throws Exception {
        when(db.one(contains("FROM matches WHERE match_id = ?"), eq("EUW1_123"))).thenReturn(null);
        when(ingest.ingestMatch("euw1", "EUW1_123", "unranked")).thenReturn(Outcome.SKIPPED);

        mvc.perform(get("/v1/matches/euw1/EUW1_123"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("UNSUPPORTED_MATCH"));
    }

    @Test
    void onDemandIngestThrows404WhenRiotNotFound() throws Exception {
        when(db.one(contains("FROM matches WHERE match_id = ?"), eq("EUW1_123"))).thenReturn(null);
        when(ingest.ingestMatch("euw1", "EUW1_123", "unranked")).thenThrow(new RiotNotFoundException("Match not found"));

        mvc.perform(get("/v1/matches/euw1/EUW1_123"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("MATCH_NOT_FOUND"));
    }

    @Test
    void returnsMatchDetailsWhenFound() throws Exception {
        Map<String, Object> matchRow = Map.of(
                "match_id", "EUW1_123", "queue_id", 420, "patch", "14.23",
                "game_duration", 1500, "game_creation", 1700000000000L,
                "winning_team", 100);

        when(db.one(contains("FROM matches WHERE match_id = ?"), eq("EUW1_123"))).thenReturn(matchRow);
        when(catalog.latestPatch()).thenReturn("14.23.1");

        when(db.rows(contains("FROM match_participants"), any(), any())).thenReturn(List.of(
                Api.obj("puuid", "p1", "game_name", "Player1", "tag_line", "EUW", "champion_id", 103,
                        "champion_name", "Ahri", "team_id", 100, "role", "mid", "win", true,
                        "kills", 5, "deaths", 1, "assists", 10, "cs", 200, "gold", 1200,
                        "damage", 25000, "vision_score", 30, "champ_level", 16,
                        "items", List.of(3089), "spell1", 4, "spell2", 12,
                        "primary_style", 8000, "sub_style", 8400, "keystone", 8010,
                        "primary_perks", List.of(8010), "secondary_perks", List.of(8444),
                        "stat_shards", List.of(5008, 5008, 5001))));

        when(db.rows(contains("FROM match_bans WHERE match_id = ?"), eq("EUW1_123"))).thenReturn(List.of(
                Map.of("team_id", 100, "champion_id", 1)));

        mvc.perform(get("/v1/matches/euw1/EUW1_123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.matchId").value("EUW1_123"))
                .andExpect(jsonPath("$.data.teams[0].win").value(true));
    }
}
