package com.lolstats.ingest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lolstats.jobs.Progress;
import com.lolstats.riot.RiotClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class CrawlServiceTest {
    private static final ObjectMapper OM = new ObjectMapper();

    private RiotClient riot;
    private MatchIngestService matches;
    private CrawlService service;

    @BeforeEach
    void setUp() {
        riot = mock(RiotClient.class);
        matches = mock(MatchIngestService.class);
        service = new CrawlService(riot, matches);
    }

    @Test
    void crawlLadderApexTier() throws Exception {
        when(riot.apexEntries("euw1", "RANKED_SOLO_5x5", "challenger")).thenReturn(
                OM.readTree("{\"entries\":[{\"puuid\":\"p1\"}]}"));

        when(riot.matchIds("euw1", "p1", 420, 2, null)).thenReturn(
                OM.readTree("[\"EUW1_1\", \"EUW1_2\"]"));

        when(matches.ingestMatch("euw1", "EUW1_1", "challenger")).thenReturn(Outcome.STORED);
        when(matches.ingestMatch("euw1", "EUW1_2", "challenger")).thenReturn(Outcome.EXISTS);

        Progress progress = mock(Progress.class);
        CrawlService.CrawlPayload payload = new CrawlService.CrawlPayload(
                "euw1", "ranked_solo", "challenger", null, 1, 2, 0);

        CrawlService.CrawlResult result = service.crawlLadder(payload, progress);
        assertEquals(1, result.players());
        assertEquals(1, result.stored());
        assertEquals(1, result.existing());
        assertEquals(0, result.skipped());
        verify(progress, atLeastOnce()).update(anyInt(), anyInt());
    }

    @Test
    void crawlLadderNonApexWithMaxStoredLimit() throws Exception {
        when(riot.divisionEntries("euw1", "RANKED_SOLO_5x5", "gold", "I", 1)).thenReturn(
                OM.readTree("[{\"puuid\":\"p1\"}, {\"puuid\":\"p2\"}]"));

        when(riot.matchIds("euw1", "p1", 420, 5, null)).thenReturn(
                OM.readTree("[\"EUW1_1\", \"EUW1_2\"]"));

        when(matches.ingestMatch("euw1", "EUW1_1", "gold")).thenReturn(Outcome.STORED);
        // maxStored = 1, so it should break after EUW1_1 is stored!

        Progress progress = mock(Progress.class);
        CrawlService.CrawlPayload payload = new CrawlService.CrawlPayload(
                "euw1", "ranked_solo", "gold", "I", 1, 5, 1);

        CrawlService.CrawlResult result = service.crawlLadder(payload, progress);
        assertEquals(1, result.players());
        assertEquals(1, result.stored());
        verify(matches, times(1)).ingestMatch(any(), any(), any());
    }
}
