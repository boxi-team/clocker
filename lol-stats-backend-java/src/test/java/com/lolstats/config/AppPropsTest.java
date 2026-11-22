package com.lolstats.config;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class AppPropsTest {

    @Test
    void limitsParsing() {
        AppProps props = new AppProps("jdbc:...", "user", "pass", "20:1000, 100:120000", "en_US", "https://ddragon",
                true, true, 2, 0.25, 20, 120, 100, 120, false, "euw1", 1000, "iron:500, gold:1200", false, "euw1, eun1, na1", 50);

        List<AppProps.Limit> limits = props.limits();
        assertEquals(2, limits.size());
        assertEquals(20, limits.get(0).max());
        assertEquals(1000, limits.get(0).windowMs());
        assertEquals(100, limits.get(1).max());
        assertEquals(120000, limits.get(1).windowMs());
    }

    @Test
    void dailyMatchesForTiers() {
        AppProps props = new AppProps("jdbc:...", "user", "pass", "", "en_US", "https://ddragon",
                true, true, 2, 0.25, 20, 120, 100, 120, false, "euw1", 1000, "iron:500, gold:1200", false, "euw1, eun1, na1", 50);

        assertEquals(500, props.dailyMatchesFor("iron"));
        assertEquals(1200, props.dailyMatchesFor("gold"));
        assertEquals(1000, props.dailyMatchesFor("challenger")); // fallback to default
    }

    @Test
    void leaderboardRegionListParsing() {
        AppProps props = new AppProps("jdbc:...", "user", "pass", "", "en_US", "https://ddragon",
                true, true, 2, 0.25, 20, 120, 100, 120, false, "euw1", 1000, "", false, "euw1, eun1, na1", 50);

        List<String> regions = props.leaderboardRegionList();
        assertEquals(List.of("euw1", "eun1", "na1"), regions);
    }
}
