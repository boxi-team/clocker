package com.lolstats.ingest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.common.Db;
import com.lolstats.config.AppProps;
import com.lolstats.riot.RiotClient;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

class MatchIngestServiceTest {
    private static final ObjectMapper OM = new ObjectMapper();

    private Db db;
    private RiotClient riot;
    private ItemService items;
    private AppProps props;
    private TransactionTemplate tx;
    private MatchIngestService service;
    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        db = mock(Db.class);
        jdbc = mock(JdbcTemplate.class);
        when(db.jdbc()).thenReturn(jdbc);
        riot = mock(RiotClient.class);
        items = mock(ItemService.class);
        props = new AppProps("", "", "", "", "en_US", "", true, true, 2, 0.0, 20, 120, 100, 120,
                false, "euw1", 1000, "", false, "euw1", 100);
        tx = mock(TransactionTemplate.class);

        when(tx.execute(any())).thenAnswer(invocation -> {
            TransactionCallback<?> cb = invocation.getArgument(0);
            return cb.doInTransaction(mock(TransactionStatus.class));
        });

        service = new MatchIngestService(db, riot, items, props, tx);
    }

    @Test
    void patchOfExtractsMajorMinor() {
        assertEquals("14.23", MatchIngestService.patchOf("14.23.630.9876"));
        assertEquals("15.1", MatchIngestService.patchOf("15.1.0"));
    }

    @Test
    void parseTimelineHandlesValidEventsAndUndos() throws Exception {
        String json = """
        {
          "metadata": { "participants": ["puuid-1", "puuid-2"] },
          "info": {
            "frames": [
              {
                "events": [
                  { "type": "SKILL_LEVEL_UP", "participantId": 1, "levelUpType": "NORMAL", "skillSlot": 1, "timestamp": 1000 },
                  { "type": "SKILL_LEVEL_UP", "participantId": 1, "levelUpType": "NORMAL", "skillSlot": 2, "timestamp": 2000 },
                  { "type": "ITEM_PURCHASED", "participantId": 1, "itemId": 1055, "timestamp": 15000 },
                  { "type": "ITEM_PURCHASED", "participantId": 1, "itemId": 2003, "timestamp": 20000 },
                  { "type": "ITEM_UNDO", "participantId": 1, "beforeId": 2003, "timestamp": 25000 }
                ]
              }
            ]
          }
        }
        """;
        JsonNode tl = OM.readTree(json);
        MatchIngestService.TimelineInfo info = MatchIngestService.parseTimeline(tl, "puuid-1");

        assertNotNull(info);
        assertEquals("QW", info.skillOrder());
        assertEquals("Q>W>E", info.skillMaxOrder());
        assertEquals(List.of(1055), info.startingItems());
        assertEquals(List.of(1055), info.purchases()); // 2003 was undone
    }

    @Test
    void parseTimelineReturnsNullForUnknownParticipantOrNoSkills() throws Exception {
        String json = "{\"metadata\":{\"participants\":[\"p1\"]},\"info\":{\"frames\":[]}}";
        JsonNode tl = OM.readTree(json);

        assertNull(MatchIngestService.parseTimeline(tl, "p2")); // unknown participant
        assertNull(MatchIngestService.parseTimeline(tl, "p1")); // no skills
    }

    @Test
    void existingMatchIdsChecksDb() {
        assertEquals(Set.of(), service.existingMatchIds(List.of()));

        when(db.rows(contains("FROM matches WHERE match_id = ANY"), any())).thenReturn(List.of(
                Map.of("match_id", "EUW1_100"),
                Map.of("match_id", "EUW1_200")));

        Set<String> result = service.existingMatchIds(List.of("EUW1_100", "EUW1_200", "EUW1_300"));
        assertEquals(Set.of("EUW1_100", "EUW1_200"), result);
    }

    @Test
    void ingestMatchReturnsExistsWhenAlreadyStored() {
        when(db.exists(contains("FROM matches WHERE match_id"), eq("EUW1_123"))).thenReturn(true);
        assertEquals(Outcome.EXISTS, service.ingestMatch("euw1", "EUW1_123", "gold"));
        verify(riot, never()).match(any(), any());
    }

    @Test
    void ingestMatchSkipsUnsupportedQueueOrRemakeOrWrongPlayerCount() throws Exception {
        when(db.exists(anyString(), any())).thenReturn(false);

        // ARAM queue 450
        JsonNode aramMatch = OM.readTree("{\"info\":{\"queueId\":450,\"gameDuration\":1000,\"participants\":[{},{},{},{},{},{},{},{},{},{}]}}");
        when(riot.match("euw1", "M1")).thenReturn(aramMatch);
        assertEquals(Outcome.SKIPPED, service.ingestMatch("euw1", "M1", "gold"));

        // Remake (under 300s)
        JsonNode remake = OM.readTree("{\"info\":{\"queueId\":420,\"gameDuration\":200,\"participants\":[{},{},{},{},{},{},{},{},{},{}]}}");
        when(riot.match("euw1", "M2")).thenReturn(remake);
        assertEquals(Outcome.SKIPPED, service.ingestMatch("euw1", "M2", "gold"));

        // Less than 10 players
        JsonNode invalidPlayerCount = OM.readTree("{\"info\":{\"queueId\":420,\"gameDuration\":1200,\"participants\":[{},{}]}}");
        when(riot.match("euw1", "M3")).thenReturn(invalidPlayerCount);
        assertEquals(Outcome.SKIPPED, service.ingestMatch("euw1", "M3", "gold"));
    }

    @Test
    void ingestMatchStoresValidMatch() throws Exception {
        when(db.exists(anyString(), any())).thenReturn(false);

        StringBuilder participants = new StringBuilder("[");
        for (int i = 0; i < 10; i++) {
            if (i > 0) participants.append(",");
            participants.append(String.format("""
            {
              "puuid": "p-%d", "riotIdGameName": "Player%d", "riotIdTagline": "EUW",
              "teamId": %d, "championId": %d, "teamPosition": "MIDDLE", "win": %b,
              "kills": 5, "deaths": 2, "assists": 8, "totalMinionsKilled": 150, "neutralMinionsKilled": 10,
              "goldEarned": 10000, "totalDamageDealtToChampions": 20000, "visionScore": 25, "champLevel": 14,
              "item0": 3089, "item1": 0, "item2": 0, "item3": 0, "item4": 0, "item5": 0, "item6": 3340,
              "summoner1Id": 4, "summoner2Id": 14,
              "perks": {
                "styles": [
                  { "description": "primaryStyle", "style": 8000, "selections": [{ "perk": 8010 }] },
                  { "description": "subStyle", "style": 8400, "selections": [{ "perk": 8444 }] }
                ],
                "statPerks": { "offense": 5008, "flex": 5008, "defense": 5001 }
              }
            }
            """, i, i, (i < 5 ? 100 : 200), (100 + i), (i < 5)));
        }
        participants.append("]");

        String matchJson = String.format("""
        {
          "info": {
            "queueId": 420,
            "gameDuration": 1500,
            "gameCreation": 1700000000000,
            "gameVersion": "14.23.1",
            "teams": [
              { "teamId": 100, "win": true, "bans": [{ "championId": 1, "pickTurn": 1 }] },
              { "teamId": 200, "win": false, "bans": [{ "championId": 2, "pickTurn": 6 }] }
            ],
            "participants": %s
          }
        }
        """, participants);

        when(riot.match("euw1", "EUW1_VALID")).thenReturn(OM.readTree(matchJson));
        when(db.update(contains("INSERT INTO matches"), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(1);

        Outcome outcome = service.ingestMatch("euw1", "EUW1_VALID", "gold");
        assertEquals(Outcome.STORED, outcome);
        verify(jdbc, atLeastOnce()).batchUpdate(contains("INSERT INTO match_participants"), anyList());
        verify(jdbc, atLeastOnce()).batchUpdate(contains("INSERT INTO match_bans"), anyList());
    }

    @Test
    void ingestMatchReturnsExistsWhenMatchInsertReturnsZero() throws Exception {
        when(db.exists(anyString(), any())).thenReturn(false);

        StringBuilder participants = new StringBuilder("[");
        for (int i = 0; i < 10; i++) {
            if (i > 0) participants.append(",");
            participants.append(String.format("{\"puuid\":\"p-%d\",\"teamPosition\":\"TOP\",\"perks\":{\"styles\":[],\"statPerks\":{}}}", i));
        }
        participants.append("]");

        String matchJson = String.format("""
        {
          "info": {
            "queueId": 420,
            "gameDuration": 1500,
            "gameCreation": 1700000000000,
            "gameVersion": "14.23.1",
            "teams": [],
            "participants": %s
          }
        }
        """, participants);

        when(riot.match("euw1", "EUW1_RACE")).thenReturn(OM.readTree(matchJson));
        when(db.update(contains("INSERT INTO matches"), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(0);

        Outcome outcome = service.ingestMatch("euw1", "EUW1_RACE", "gold");
        assertEquals(Outcome.EXISTS, outcome);
    }
}
