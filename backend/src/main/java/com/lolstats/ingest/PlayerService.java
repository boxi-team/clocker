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
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/** Player profiles (Riot account, summoner, ranks) and their match imports. */
@Service
public class PlayerService {
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

        int stored = 0;
        int skipped = 0;
        int existing = 0;
        int done = 0;
        if (onProgress != null) onProgress.update(0, toFetch.size());
        for (ToFetch f : toFetch) {
            Outcome outcome = matches.ingestMatch(player.region(), f.id(), tierBucketFor(puuid, f.queue()));
            switch (outcome) {
                case STORED -> stored++;
                case SKIPPED -> skipped++;
                case EXISTS -> existing++;
            }
            if (onProgress != null) onProgress.update(++done, toFetch.size());
        }

        db.update("UPDATE players SET last_refreshed_at = now(), "
                + "last_match_creation = COALESCE((SELECT max(game_creation) FROM match_participants WHERE puuid = ?), last_match_creation) "
                + "WHERE puuid = ?", puuid, puuid);
        return new ImportResult(stored, skipped, existing);
    }
}
