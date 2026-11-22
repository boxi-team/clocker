package com.lolstats.query;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Map;
import org.junit.jupiter.api.Test;

class StatLinesTest {

    @Test
    void statLineCalculationWithGames() {
        Map<String, Object> row = Map.of(
                "games", 10,
                "wins", 6,
                "k", 50.0,
                "d", 20.0,
                "a", 60.0,
                "cs", 1800.0,
                "secs", 18000.0, // 300 minutes total
                "gold", 120000.0,
                "dmg", 250000.0,
                "vis", 350.0);

        Map<String, Object> stats = StatLines.statLine(row);
        assertEquals(10, stats.get("games"));
        assertEquals(6, stats.get("wins"));
        assertEquals(0.6, stats.get("winRate"));
        assertEquals(5.5, stats.get("kda")); // (50 + 60) / 20 = 5.5
        assertEquals(5.0, stats.get("avgKills"));
        assertEquals(2.0, stats.get("avgDeaths"));
        assertEquals(6.0, stats.get("avgAssists"));
        assertEquals(6.0, stats.get("csPerMin")); // 1800 / (18000/60) = 6.0
        assertEquals(12000L, stats.get("avgGold"));
        assertEquals(25000L, stats.get("avgDamageToChampions"));
        assertEquals(35.0, stats.get("avgVisionScore"));
    }

    @Test
    void statLineCalculationWithZeroGames() {
        Map<String, Object> row = Map.of(
                "games", 0,
                "wins", 0,
                "k", 0.0,
                "d", 0.0,
                "a", 0.0,
                "cs", 0.0,
                "secs", 0.0,
                "gold", 0.0,
                "dmg", 0.0,
                "vis", 0.0);

        Map<String, Object> stats = StatLines.statLine(row);
        assertEquals(0, stats.get("games"));
        assertEquals(0, stats.get("wins"));
        assertEquals(0.0, stats.get("winRate"));
        assertEquals(0.0, stats.get("kda"));
        assertEquals(0.0, stats.get("csPerMin"));
    }

    @Test
    void wilsonScoreBoundaries() {
        assertEquals(0.0, StatLines.wilsonScore(0, 0));
        assertEquals(0.0, StatLines.wilsonScore(0, 10));

        double score1 = StatLines.wilsonScore(60, 100);
        double score2 = StatLines.wilsonScore(600, 1000);

        assertTrue(score1 > 0 && score1 < 60);
        assertTrue(score2 > score1); // Larger sample size tightens confidence interval towards 60%
    }
}
