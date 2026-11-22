package com.lolstats.ingest;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PlayerRowTest {

    @Test
    void playerRowFromMap() {
        Instant now = Instant.now();
        Map<String, Object> map = Map.of(
                "puuid", "puuid-123",
                "region", "euw1",
                "game_name", "Faker",
                "tag_line", "KR1",
                "summoner_level", 500,
                "profile_icon_id", 10,
                "last_refresh_requested_at", now,
                "last_refreshed_at", now,
                "last_match_creation", 1700000000000L);

        PlayerRow row = PlayerRow.from(map);
        assertEquals("puuid-123", row.puuid());
        assertEquals("euw1", row.region());
        assertEquals("Faker", row.gameName());
        assertEquals("KR1", row.tagLine());
        assertEquals(500, row.summonerLevel());
        assertEquals(10, row.profileIconId());
        assertEquals(now, row.lastRefreshRequestedAt());
        assertEquals(now, row.lastRefreshedAt());
        assertEquals(1700000000000L, row.lastMatchCreation());
    }

    @Test
    void playerRowWithNulls() {
        Map<String, Object> map = Map.of(
                "puuid", "puuid-123",
                "region", "euw1",
                "game_name", "Faker",
                "tag_line", "KR1");

        PlayerRow row = PlayerRow.from(map);
        assertEquals("puuid-123", row.puuid());
        assertNull(row.summonerLevel());
        assertNull(row.profileIconId());
        assertNull(row.lastRefreshRequestedAt());
        assertNull(row.lastRefreshedAt());
        assertNull(row.lastMatchCreation());
    }
}
