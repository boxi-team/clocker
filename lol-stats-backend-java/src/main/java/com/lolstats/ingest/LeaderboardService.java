package com.lolstats.ingest;

import com.fasterxml.jackson.databind.JsonNode;
import com.lolstats.common.Db;
import com.lolstats.common.Domain;
import com.lolstats.config.AppProps;
import com.lolstats.jobs.Progress;
import com.lolstats.riot.RiotClient;
import com.lolstats.riot.RiotNotFoundException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Rebuilds the leaderboard of a region: the top ranked solo/duo players of every tier by LP.
 * Riot IDs and icons are looked up only for players not yet in the players table, so after the
 * first run a refresh costs little more than one ladder request per tier.
 */
@Service
public class LeaderboardService {
    private static final Set<String> APEX = Set.of("master", "grandmaster", "challenger");
    // Division I ladder pages read per tier (about 200 players each); the highest LP among them are kept.
    private static final int PAGES = 3;

    public record RefreshResult(int tiers, int players, int newPlayers) {}

    private record Entry(String puuid, String division, int leaguePoints, int wins, int losses) {}

    private final Db db;
    private final RiotClient riot;
    private final AppProps props;
    private final TransactionTemplate tx;

    public LeaderboardService(Db db, RiotClient riot, AppProps props, TransactionTemplate tx) {
        this.db = db;
        this.riot = riot;
        this.props = props;
        this.tx = tx;
    }

    public RefreshResult refresh(String region, Progress onProgress) {
        String queue = Domain.queue("ranked_solo").riot();
        int players = 0;
        int newPlayers = 0;
        int done = 0;
        onProgress.update(0, Domain.TIER_BUCKETS.size());
        for (String tier : Domain.TIER_BUCKETS) {
            List<JsonNode> ladder = new ArrayList<>();
            if (APEX.contains(tier)) {
                riot.apexEntries(region, queue, tier).path("entries").forEach(ladder::add);
            } else {
                for (int page = 1; page <= PAGES; page++) {
                    JsonNode batch = riot.divisionEntries(region, queue, tier, "I", page);
                    if (batch.size() == 0) break;
                    batch.forEach(ladder::add);
                }
            }
            ladder.sort(Comparator.comparingInt((JsonNode e) -> e.path("leaguePoints").asInt()).reversed());

            List<Entry> top = new ArrayList<>();
            for (JsonNode e : ladder) {
                if (top.size() >= props.leaderboardSize()) break;
                String puuid = e.path("puuid").asText("");
                if (puuid.isEmpty()) continue;
                if (!db.exists("SELECT 1 FROM players WHERE puuid = ?", puuid)) {
                    if (!storePlayer(region, puuid)) continue;
                    newPlayers++;
                }
                top.add(new Entry(puuid, APEX.contains(tier) ? null : e.path("rank").asText("I"),
                        e.path("leaguePoints").asInt(), e.path("wins").asInt(), e.path("losses").asInt()));
            }
            save(region, tier, top);
            players += top.size();
            onProgress.update(++done, Domain.TIER_BUCKETS.size());
        }
        return new RefreshResult(done, players, newPlayers);
    }

    /** Saves Riot ID, level and icon of a player seen on the ladder. False if Riot no longer knows the account. */
    private boolean storePlayer(String region, String puuid) {
        try {
            JsonNode account = riot.accountByPuuid(region, puuid);
            JsonNode summoner = riot.summoner(region, puuid);
            String gameName = account.path("gameName").asText("");
            String tagLine = account.path("tagLine").asText("");
            if (gameName.isEmpty() || tagLine.isEmpty()) return false;
            tx.executeWithoutResult(status -> {
                // A Riot ID can be re-assigned to a different account; free it before inserting.
                db.update("DELETE FROM players WHERE region = ? AND lower(game_name) = lower(?) "
                        + "AND lower(tag_line) = lower(?) AND puuid <> ?", region, gameName, tagLine, puuid);
                db.update("INSERT INTO players (puuid, region, game_name, tag_line, summoner_level, profile_icon_id) "
                                + "VALUES (?,?,?,?,?,?) ON CONFLICT (puuid) DO UPDATE SET game_name = EXCLUDED.game_name, "
                                + "tag_line = EXCLUDED.tag_line, summoner_level = EXCLUDED.summoner_level, "
                                + "profile_icon_id = EXCLUDED.profile_icon_id",
                        puuid, region, gameName, tagLine,
                        summoner.path("summonerLevel").asInt(), summoner.path("profileIconId").asInt());
            });
            return true;
        } catch (RiotNotFoundException e) {
            return false;
        }
    }

    /** Replaces the stored leaderboard of one tier in a single transaction, so readers never see it half written. */
    private void save(String region, String tier, List<Entry> top) {
        tx.executeWithoutResult(status -> {
            db.update("DELETE FROM leaderboard_entries WHERE region = ? AND tier = ?", region, tier);
            int rank = 0;
            for (Entry e : top) {
                db.update("INSERT INTO leaderboard_entries (region, tier, rank, puuid, division, league_points, wins, losses) "
                                + "VALUES (?,?,?,?,?,?,?,?)",
                        region, tier, ++rank, e.puuid(), e.division(), e.leaguePoints(), e.wins(), e.losses());
            }
        });
    }
}