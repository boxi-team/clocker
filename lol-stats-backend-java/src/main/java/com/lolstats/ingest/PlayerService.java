package com.lolstats.ingest;

import com.fasterxml.jackson.databind.JsonNode;
import com.lolstats.common.AppException;
import com.lolstats.common.Db;
import com.lolstats.common.Domain;
import com.lolstats.common.Domain.QueueInfo;
import com.lolstats.common.ErrorCode;
import com.lolstats.config.AppProps;
import com.lolstats.jobs.Progress;
import com.lolstats.riot.RiotClient;
import com.lolstats.riot.RiotNotFoundException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/** Player profiles (Riot account, summoner, ranks) and their match imports. */
@Service
public class PlayerService {
    private static final Logger log = LoggerFactory.getLogger(PlayerService.class);
    /** Matches downloaded and stored at the same time for one player import (database pool has 10 connections). */
    private static final int IMPORT_PARALLELISM = 3;
    public record ImportResult(int stored, int skipped, int existing) {}

    private final Db db;
    private final RiotClient riot;
    private final MatchIngestService matches;
    private final AppProps props;
    private final TransactionTemplate tx;

    public PlayerService(Db db, RiotClient riot, MatchIngestService matches, AppProps props, TransactionTemplate tx) {
        this.db = db;
        this.riot = riot;
        this.matches = matches;
        this.props = props;
        this.tx = tx;
    }

    public PlayerRow findPlayer(String region, String gameName, String tagLine) {
        Map<String, Object> r = db.one(
                "SELECT * FROM players WHERE region = ? AND lower(game_name) = lower(?) AND lower(tag_line) = lower(?)",
                region, gameName, tagLine);
        return r == null ? null : PlayerRow.from(r);
    }

    public PlayerRow getPlayerByPuuid(String puuid) {
        Map<String, Object> r = db.one("SELECT * FROM players WHERE puuid = ?", puuid);
        return r == null ? null : PlayerRow.from(r);
    }

    /** Calls Riot (account, summoner, league) and stores the result. Throws PLAYER_NOT_FOUND on a Riot 404. */
    public PlayerRow fetchAndStorePlayer(String region, String gameName, String tagLine) {
        try {
            JsonNode account = riot.account(region, gameName, tagLine);
            String puuid = account.path("puuid").asText();
            JsonNode summoner = riot.summoner(region, puuid);
            JsonNode entries = riot.leagueEntries(region, puuid);

            tx.executeWithoutResult(status -> {
                // A Riot ID can be re-assigned to a different account; free it before inserting.
                db.update("DELETE FROM players WHERE region = ? AND lower(game_name) = lower(?) "
                                + "AND lower(tag_line) = lower(?) AND puuid <> ?",
                        region, account.path("gameName").asText(), account.path("tagLine").asText(), puuid);
                db.update("INSERT INTO players (puuid, region, game_name, tag_line, summoner_level, profile_icon_id) "
                                + "VALUES (?,?,?,?,?,?) ON CONFLICT (puuid) DO UPDATE SET region = EXCLUDED.region, "
                                + "game_name = EXCLUDED.game_name, tag_line = EXCLUDED.tag_line, "
                                + "summoner_level = EXCLUDED.summoner_level, profile_icon_id = EXCLUDED.profile_icon_id",
                        puuid, region, account.path("gameName").asText(), account.path("tagLine").asText(),
                        summoner.path("summonerLevel").asInt(), summoner.path("profileIconId").asInt());
                db.update("DELETE FROM player_ranks WHERE puuid = ?", puuid);
                for (JsonNode e : entries) {
                    QueueInfo queue = Domain.queueFromRiot(e.path("queueType").asText());
                    if (queue == null) continue; // TFT etc.
                    db.update("INSERT INTO player_ranks (puuid, queue, tier, division, league_points, wins, losses) "
                                    + "VALUES (?,?,?,?,?,?,?)",
                            puuid, queue.name(), e.path("tier").asText(), e.path("rank").asText(),
                            e.path("leaguePoints").asInt(), e.path("wins").asInt(), e.path("losses").asInt());
                }
            });
            return getPlayerByPuuid(puuid);
        } catch (RiotNotFoundException e) {
            throw AppException.notFound(ErrorCode.PLAYER_NOT_FOUND,
                    "Player " + gameName + "#" + tagLine + " not found on " + region);
        }
    }

    private String tierBucketFor(String puuid, String queue) {
        Map<String, Object> r = db.one("SELECT tier FROM player_ranks WHERE puuid = ? AND queue = ?", puuid, queue);
        return r == null ? "unranked" : Db.s(r, "tier").toLowerCase();
    }

    /**
     * Imports new ranked matches for a player (both queues). First time: the latest
     * {@code firstImportCount} per queue. Afterwards: everything since the newest stored match, up to 100.
     */
    public ImportResult importPlayerMatches(String puuid, Progress onProgress) {
        PlayerRow player = getPlayerByPuuid(puuid);
        if (player == null) throw new AppException(404, ErrorCode.PLAYER_NOT_FOUND, "Unknown player");

        Long lastCreation = player.lastMatchCreation();
        record ToFetch(String id, String queue) {}
        List<ToFetch> toFetch = new ArrayList<>();
        for (QueueInfo queue : Domain.QUEUES) {
            JsonNode ids = riot.matchIds(player.region(), puuid, queue.id(),
                    lastCreation != null ? 100 : props.firstImportCount(),
                    lastCreation != null ? lastCreation / 1000 : null);
            for (JsonNode id : ids) toFetch.add(new ToFetch(id.asText(), queue.name()));
        }

        long t0 = System.nanoTime();
        // One query tells us which matches we already have; only the new ones are downloaded.
        Set<String> known = matches.existingMatchIds(toFetch.stream().map(ToFetch::id).toList());
        List<ToFetch> fresh = toFetch.stream().filter(f -> !known.contains(f.id())).toList();
        Map<String, String> tierByQueue = new HashMap<>();
        for (QueueInfo queue : Domain.QUEUES) tierByQueue.put(queue.name(), tierBucketFor(puuid, queue.name()));

        AtomicInteger stored = new AtomicInteger();
        AtomicInteger skipped = new AtomicInteger();
        AtomicInteger existing = new AtomicInteger(known.size());
        AtomicInteger done = new AtomicInteger();
        if (onProgress != null) onProgress.update(0, fresh.size());

        // Download and store a few matches at a time, so Riot waits and database writes overlap.
        ExecutorService pool = Executors.newFixedThreadPool(Math.max(1, Math.min(IMPORT_PARALLELISM, fresh.size())));
        try {
            List<CompletableFuture<Void>> futures = new ArrayList<>();
            for (ToFetch f : fresh) {
                futures.add(CompletableFuture.runAsync(() -> {
                    Outcome outcome = matches.ingestNewMatch(player.region(), f.id(), tierByQueue.get(f.queue()), false);
                    switch (outcome) {
                        case STORED -> stored.incrementAndGet();
                        case SKIPPED -> skipped.incrementAndGet();
                        case EXISTS -> existing.incrementAndGet();
                    }
                    int n = done.incrementAndGet();
                    if (onProgress != null) {
                        synchronized (onProgress) {
                            onProgress.update(n, fresh.size());
                        }
                    }
                }, pool));
            }
            for (CompletableFuture<Void> fut : futures) {
                try {
                    fut.join();
                } catch (CompletionException e) {
                    futures.forEach(x -> x.cancel(true));
                    if (e.getCause() instanceof RuntimeException re) throw re;
                    throw e;
                }
            }
        } finally {
            pool.shutdownNow();
        }
        log.info("[import] {}: {} listed, {} already stored, {} new ({} stored, {} skipped) in {} ms",
                puuid.substring(0, 8), toFetch.size(), known.size(), fresh.size(), stored.get(), skipped.get(),
                (System.nanoTime() - t0) / 1_000_000);

        db.update("UPDATE players SET last_refreshed_at = now(), "
                + "last_match_creation = COALESCE((SELECT max(game_creation) FROM match_participants WHERE puuid = ?), last_match_creation) "
                + "WHERE puuid = ?", puuid, puuid);
        return new ImportResult(stored.get(), skipped.get(), existing.get());
    }
}
