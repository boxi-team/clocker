package com.lolstats.query;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.lolstats.common.Api;
import com.lolstats.common.Db;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PlayerQueriesTest {
    private Db db;
    private PlayerQueries queries;

    @BeforeEach
    void setUp() {
        db = mock(Db.class);
        queries = new PlayerQueries(db);
    }

    @Test
    void playerFilterRecordWithoutModifiers() {
        PlayerQueries.PlayerFilter filter = new PlayerQueries.PlayerFilter("puuid-1", List.of(420), "14.23", 103, "mid");
        assertEquals("puuid-1", filter.puuid());
        assertEquals(List.of(420), filter.queueIds());
        assertEquals("14.23", filter.patch());
        assertEquals(103, filter.championKey());
        assertEquals("mid", filter.role());

        PlayerQueries.PlayerFilter noChamp = filter.without(true, false);
        assertNull(noChamp.championKey());
        assertEquals("mid", noChamp.role());

        PlayerQueries.PlayerFilter noRole = filter.without(true, true);
        assertNull(noRole.championKey());
        assertNull(noRole.role());
    }

    @Test
    void countIndexedReturnsPlayerMatchesCount() {
        when(db.one(contains("SELECT count(*)::int AS n FROM match_participants WHERE puuid = ?"), eq("p1")))
                .thenReturn(Map.of("n", 42));

        assertEquals(42, queries.countIndexed("p1"));
    }

    @Test
    void listMatchesReturnsTotalAndRows() {
        PlayerQueries.PlayerFilter filter = new PlayerQueries.PlayerFilter("p1", List.of(420), null, null, null);

        when(db.one(contains("SELECT count(*)::int AS n FROM match_participants p WHERE"), any(), any()))
                .thenReturn(Map.of("n", 25));

        when(db.rows(contains("SELECT p.*, c.id AS champion_name FROM match_participants p"), any(), any(), any(), any(), any()))
                .thenReturn(List.of(
                        Map.of("match_id", "M1", "champion_name", "Ahri"),
                        Map.of("match_id", "M2", "champion_name", "Zed")));

        PlayerQueries.MatchPage page = queries.listMatches(filter, 0, 10, "14.23.1");
        assertEquals(25, page.total());
        assertEquals(2, page.rows().size());
        assertEquals("Ahri", page.rows().get(0).get("champion_name"));
    }

    @Test
    void playerStatsAggregatesSummaryAndLast20() {
        PlayerQueries.PlayerFilter filter = new PlayerQueries.PlayerFilter("p1", List.of(420), null, null, null);

        Map<String, Object> summaryRow = Api.obj(
                "games", 10, "wins", 6, "k", 50.0, "d", 20.0, "a", 60.0,
                "cs", 1800.0, "secs", 18000.0, "gold", 120000.0, "dmg", 250000.0, "vis", 350.0);

        when(db.one(contains("LIMIT 20) t"), any(), any()))
                .thenReturn(Map.of("games", 20, "wins", 12));

        when(db.one(argThat(sql -> sql != null && !sql.contains("LIMIT 20")), any(), any()))
                .thenReturn(summaryRow);

        when(db.rows(contains("GROUP BY p.role ORDER BY games DESC"), any(), any()))
                .thenReturn(List.of(
                        Api.obj("role", "mid", "games", 8, "wins", 5, "k", 40.0, "d", 15.0, "a", 45.0,
                                "cs", 1500.0, "secs", 15000.0, "gold", 100000.0, "dmg", 200000.0, "vis", 300.0)));

        Map<String, Object> stats = queries.playerStats(filter);
        assertNotNull(stats);
        assertTrue(stats.containsKey("summary"));
        assertTrue(stats.containsKey("byRole"));
        assertTrue(stats.containsKey("last20"));

        @SuppressWarnings("unchecked")
        Map<String, Object> last20 = (Map<String, Object>) stats.get("last20");
        assertEquals(20, last20.get("games"));
        assertEquals(12, last20.get("wins"));
        assertEquals(0.6, last20.get("winRate"));
    }
}
