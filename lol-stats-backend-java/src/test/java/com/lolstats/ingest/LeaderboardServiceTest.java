package com.lolstats.ingest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.Db;
import com.lolstats.config.AppProps;
import com.lolstats.jobs.Progress;
import com.lolstats.riot.RiotClient;
import java.util.Map;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionTemplate;

class LeaderboardServiceTest {
    private static final ObjectMapper OM = new ObjectMapper();

    private Db db;
    private RiotClient riot;
    private AppProps props;
    private TransactionTemplate tx;
    private LeaderboardService service;

    @BeforeEach
    void setUp() {
        db = mock(Db.class);
        riot = mock(RiotClient.class);
        props = new AppProps("", "", "", "", "en_US", "", true, true, 2, 0.25, 20, 120, 100, 120,
                false, "euw1", 10, "", false, "euw1", 5); // leaderboardSize = 5
        tx = mock(TransactionTemplate.class);

        doAnswer(invocation -> {
            Consumer<?> callback = invocation.getArgument(0);
            callback.accept(null);
            return null;
        }).when(tx).executeWithoutResult(any());

        service = new LeaderboardService(db, riot, props, tx);
    }

    @Test
    void refreshHandlesApexAndDivisionLadders() throws Exception {
        // Mock apex entries for master/grandmaster/challenger
        when(riot.apexEntries(eq("euw1"), any(), any())).thenReturn(
                OM.readTree("{\"entries\":[{\"puuid\":\"p1\",\"leaguePoints\":1500,\"wins\":50,\"losses\":20}]}"));

        // Mock division entries for non-apex tiers
        when(riot.divisionEntries(eq("euw1"), any(), any(), eq("I"), eq(1))).thenReturn(
                OM.readTree("[{\"puuid\":\"p2\",\"rank\":\"I\",\"leaguePoints\":80,\"wins\":20,\"losses\":10}]"));
        when(riot.divisionEntries(eq("euw1"), any(), any(), eq("I"), eq(2))).thenReturn(OM.readTree("[]"));

        // Existing player check
        when(db.exists(contains("FROM players WHERE puuid = ?"), eq("p1"))).thenReturn(true);
        when(db.exists(contains("FROM players WHERE puuid = ?"), eq("p2"))).thenReturn(false);

        // Fetching new player p2
        when(riot.accountByPuuid("euw1", "p2")).thenReturn(OM.readTree("{\"gameName\":\"G2Caps\",\"tagLine\":\"EUW\"}"));
        when(riot.summoner("euw1", "p2")).thenReturn(OM.readTree("{\"summonerLevel\":500,\"profileIconId\":100}"));

        Progress progress = mock(Progress.class);
        LeaderboardService.RefreshResult result = service.refresh("euw1", progress);

        assertEquals(10, result.tiers()); // all 10 tiers processed
        assertTrue(result.players() > 0);
        assertTrue(result.newPlayers() > 0);
        verify(progress, atLeastOnce()).update(anyInt(), anyInt());
        verify(db, atLeastOnce()).update(contains("DELETE FROM leaderboard_entries"), any(), any());
    }
}
