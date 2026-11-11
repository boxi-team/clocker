package com.lolstats.ingest;

import com.fasterxml.jackson.databind.JsonNode;
import com.lolstats.common.Domain;
import com.lolstats.common.Domain.QueueInfo;
import com.lolstats.jobs.Progress;
import com.lolstats.riot.RiotClient;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

/** Seeds the database from a ladder: lists players of a tier, then imports their recent ranked matches. */
@Service
public class CrawlService {
    private static final Set<String> APEX = Set.of("master", "grandmaster", "challenger");

    public record CrawlPayload(String region, String queue, String tier, String division, int pages, int matchesPerPlayer,
                               int maxStored) {}

    public record CrawlResult(int players, int stored, int skipped, int existing) {}

    private final RiotClient riot;
    private final MatchIngestService matches;

    public CrawlService(RiotClient riot, MatchIngestService matches) {
        this.riot = riot;
        this.matches = matches;
    }

    private String puuidOf(String region, JsonNode e) {
        if (e.hasNonNull("puuid")) return e.path("puuid").asText();
        if (!e.hasNonNull("summonerId")) return null;
        return riot.summonerBySummonerId(region, e.path("summonerId").asText()).path("puuid").asText();
    }

    /** Every stored match gets {@code tier} as its tier bucket. */
    public CrawlResult crawlLadder(CrawlPayload p, Progress onProgress) {
        QueueInfo queue = Domain.queue(p.queue());
        List<JsonNode> entries = new ArrayList<>();
        if (APEX.contains(p.tier())) {
            riot.apexEntries(p.region(), queue.riot(), p.tier()).path("entries").forEach(entries::add);
        } else {
            for (int page = 1; page <= p.pages(); page++) {
                JsonNode batch = riot.divisionEntries(p.region(), queue.riot(), p.tier(),
                        p.division() == null ? "I" : p.division(), page);
                if (batch.size() == 0) break;
                batch.forEach(entries::add);
            }
        }
        onProgress.update(0, entries.size());

        int players = 0;
        int stored = 0;
        int skipped = 0;
        int existing = 0;
        int done = 0;
        for (JsonNode e : entries) {
            if (p.maxStored() > 0 && stored >= p.maxStored()) break;
            String puuid = puuidOf(p.region(), e);
            if (puuid != null) {
                JsonNode ids = riot.matchIds(p.region(), puuid, queue.id(), p.matchesPerPlayer(), null);
                for (JsonNode id : ids) {
                    if (p.maxStored() > 0 && stored >= p.maxStored()) break;
                    switch (matches.ingestMatch(p.region(), id.asText(), p.tier())) {
                        case STORED -> stored++;
                        case SKIPPED -> skipped++;
                        case EXISTS -> existing++;
                    }
                }
                players++;
            }
            onProgress.update(++done, entries.size());
        }
        return new CrawlResult(players, stored, skipped, existing);
    }
}