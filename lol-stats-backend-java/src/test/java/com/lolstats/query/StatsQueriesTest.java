package com.lolstats.query;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.lolstats.common.Db;
import com.lolstats.config.AppProps;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class StatsQueriesTest {
    private Db db;
    private AppProps props;
    private StatsQueries stats;

    @BeforeEach
    void setUp() {
        db = mock(Db.class);
        props = new AppProps("", "", "", "", "en_US", "", true, true, 2, 0.25, 20, 120, 100, 120,
                false, "euw1", 1000, "", false, "euw1", 100);
        stats = new StatsQueries(db, props);
    }

    @Test
    void mainRolesFiltersOffMetaAndLimitsToMaxTwo() {
        // Champion 103 (Ahri): mid 800 (80%), top 150 (15%), support 50 (5%) -> only mid is >= 20%
        // Champion 266 (Aatrox): top 500 (50%), jungle 300 (30%), mid 200 (20%) -> top and jungle kept (max 2)
        List<Map<String, Object>> rows = List.of(
                Map.of("champion_id", 103, "role", "mid", "games", 800),
                Map.of("champion_id", 103, "role", "top", "games", 150),
                Map.of("champion_id", 103, "role", "support", "games", 50),
                Map.of("champion_id", 266, "role", "top", "games", 500),
                Map.of("champion_id", 266, "role", "jungle", "games", 300),
                Map.of("champion_id", 266, "role", "mid", "games", 200));

        List<Map<String, Object>> kept = StatsQueries.mainRoles(rows);
        assertEquals(3, kept.size());

        List<String> keptKeys = kept.stream().map(r -> r.get("champion_id") + ":" + r.get("role")).toList();
        assertTrue(keptKeys.contains("103:mid"));
        assertTrue(keptKeys.contains("266:top"));
        assertTrue(keptKeys.contains("266:jungle"));
        assertFalse(keptKeys.contains("266:mid")); // dropped because max 2 roles
    }

    @Test
    void totalMatchesQueriesDb() {
        Filter f = new Filter("14.23", 420, List.of("gold"), "euw1", null);
        when(db.one(contains("SELECT count(*)::int AS n FROM matches m WHERE"), any(), any(), any(), any()))
                .thenReturn(Map.of("n", 1500));

        assertEquals(1500, stats.totalMatches(f));
    }
}
