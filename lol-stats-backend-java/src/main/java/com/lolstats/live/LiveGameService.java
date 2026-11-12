package com.lolstats.live;

import static com.lolstats.common.Api.obj;

import com.fasterxml.jackson.databind.JsonNode;
import com.lolstats.common.AppException;
import com.lolstats.common.Db;
import com.lolstats.common.Domain;
import com.lolstats.common.ErrorCode;
import com.lolstats.ingest.PlayerRow;
import com.lolstats.ingest.PlayerService;
import com.lolstats.live.LiveMapper.AvgTier;
import com.lolstats.live.LiveMapper.Rank;
import com.lolstats.live.LiveNames.Names;
import com.lolstats.riot.RiotClient;
import com.lolstats.riot.RiotNotFoundException;
import jakarta.annotation.PreDestroy;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** Live games from the Riot spectator API: one player's active game, and the featured games of a region. */
@Service
public class LiveGameService {
    private static final Logger log = LoggerFactory.getLogger(LiveGameService.class);

    private static final long RANK_TTL_MS = 5 * 60_000;
    private static final long FEATURED_TTL_MS = 30_000;
    private static final int FEATURED_MAX_GAMES = 8;
    private static final int TOP_PLAYERS_TO_CHECK = 40;
    private static final int RANK_LOOKUPS_AT_ONCE = 5;

    private record Cached<T>(long at, T value) {
        boolean fresh(long ttlMs) { return System.currentTimeMillis() - at < ttlMs; }
    }

    private final RiotClient riot;
    private final PlayerService players;
    private final LiveNames names;
    private final Db db;
    private final Map<String, Cached<Rank>> rankCache = new ConcurrentHashMap<>();
    private final Map<String, Cached<List<Object>>> featuredCache = new ConcurrentHashMap<>();
    private final ExecutorService pool = Executors.newFixedThreadPool(RANK_LOOKUPS_AT_ONCE, r -> {
        Thread t = new Thread(r, "live-rank");
        t.setDaemon(true);
        return t;
    });

    public LiveGameService(RiotClient riot, PlayerService players, LiveNames names, Db db) {
        this.riot = riot;
        this.players = players;
        this.names = names;
        this.db = db;
    }

    @PreDestroy
    void stop() {
        pool.shutdownNow();
    }

    // ---------- one player's live game ----------

    /** Throws 404 NOT_IN_GAME when the player is not playing. An unknown player is loaded from Riot first. */
    public Map<String, Object> liveGame(String region, String gameName, String tagLine) {
        PlayerRow player = players.findPlayer(region, gameName, tagLine);
        if (player == null) player = players.fetchAndStorePlayer(region, gameName, tagLine);

        long t0 = System.nanoTime();
        JsonNode game;
        try {
            game = riot.activeGame(region, player.puuid());
        } catch (RiotNotFoundException e) {
            throw new AppException(404, ErrorCode.NOT_IN_GAME, "Player is not currently in an active game.");
        }
        long t1 = System.nanoTime();

        Names n = names.get();
        int queueId = game.path("gameQueueConfigId").asInt();
        List<JsonNode> participants = new ArrayList<>();
        game.path("participants").forEach(participants::add);
        Map<String, Rank> ranks = ranksOf(region, participants, queueId);
        long t2 = System.nanoTime();

        AvgTier avg = LiveMapper.avgTier(ranks.values().stream().toList());
        Map<String, Object> data = obj(
                "gameId", game.path("gameId").asLong(),
                "gameMode", game.path("gameMode").asText(),
                "gameType", game.path("gameType").asText(),
                "gameQueueConfigId", queueId,
                "mode", LiveMapper.modeName(queueId, game.path("gameMode").asText()),
                "region", Domain.REGION_LABEL.getOrDefault(region, region.toUpperCase()),
                "tier", avg.tier(),
                "avgLp", avg.avgLp(),
                "gameTimeSeconds", LiveMapper.gameSeconds(game, System.currentTimeMillis()),
                "phase", LiveMapper.phase(game),
                "blueTeam", team(game, 100, participants, n, ranks),
                "redTeam", team(game, 200, participants, n, ranks));
        log.info("[live] {}#{} in game {}: spectator {} ms, ranks of {} players {} ms", gameName, tagLine,
                game.path("gameId").asLong(), (t1 - t0) / 1_000_000, ranks.size(), (t2 - t1) / 1_000_000);
        return data;
    }

    private Map<String, Object> team(JsonNode game, int teamId, List<JsonNode> all, Names n, Map<String, Rank> ranks) {
        List<JsonNode> members = all.stream().filter(p -> p.path("teamId").asInt() == teamId).toList();
        List<List<String>> tags = new ArrayList<>();
        List<Boolean> smite = new ArrayList<>();
        for (JsonNode p : members) {
            LiveNames.Champ c = n.champions().get(p.path("championId").asInt());
            tags.add(c == null ? List.of() : c.tags());
            smite.add(LiveMapper.hasSmite(p));
        }
        List<String> roles = LiveMapper.assignRoles(tags, smite);

        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = 0; i < members.size(); i++) {
            JsonNode p = members.get(i);
            String[] id = LiveMapper.parseRiotId(p.path("riotId").asText(""));
            Rank rank = ranks.getOrDefault(p.path("puuid").asText(""), Rank.UNRANKED);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("puuid", p.path("puuid").asText(null));
            m.put("name", id[0]);
            m.put("tag", id[1]);
            m.put("role", roles.get(i));
            m.put("champ", n.champion(p.path("championId").asInt()));
            m.put("rank", rank.tier());
            m.put("lp", rank.lp());
            m.put("wr", rank.winRate() == null ? 0.0 : rank.winRate());
            m.put("games", rank.games());
            m.put("spells", List.of(n.spell(p.path("spell1Id").asInt()), n.spell(p.path("spell2Id").asInt())));
            // Spectator has no items, and runes can be missing: those keys are left out.
            Map<String, Object> page = LiveMapper.runePage(p.path("perks"), n);
            if (page != null) {
                m.put("rune", page.get("keystone"));
                m.put("runePage", page);
            }
            out.add(m);
        }
        // Role order top, jungle, mid, adc, support when every role is known.
        if (roles.stream().allMatch(r -> r != null)) {
            out.sort(Comparator.comparingInt(m -> Domain.ROLES.indexOf((String) m.get("role"))));
        }
        return obj("bans", LiveMapper.bans(game, teamId, n), "players", out);
    }

    /** puuid -> rank for every real player of the game. Looked up a few at a time; a failed lookup means unranked. */
    private Map<String, Rank> ranksOf(String region, List<JsonNode> participants, int queueId) {
        Map<String, CompletableFuture<Rank>> futures = new LinkedHashMap<>();
        for (JsonNode p : participants) {
            String puuid = p.path("puuid").asText("");
            if (puuid.isEmpty() || p.path("bot").asBoolean(false) || futures.containsKey(puuid)) continue;
            futures.put(puuid, CompletableFuture.supplyAsync(() -> rankOf(region, puuid, queueId), pool));
        }
        Map<String, Rank> out = new HashMap<>();
        futures.forEach((puuid, f) -> out.put(puuid, f.join()));
        return out;
    }

    private Rank rankOf(String region, String puuid, int queueId) {
        String key = region + ":" + puuid + ":" + (queueId == 440 ? "flex" : "solo");
        Cached<Rank> hit = rankCache.get(key);
        if (hit != null && hit.fresh(RANK_TTL_MS)) return hit.value();
        try {
            Rank r = LiveMapper.rankFromEntries(riot.leagueEntries(region, puuid), queueId);
            rankCache.put(key, new Cached<>(System.currentTimeMillis(), r));
            return r;
        } catch (RuntimeException e) {
            log.warn("[live] rank lookup failed for a player on {}: {}", region, e.getMessage());
            return Rank.UNRANKED;
        }
    }

    // ---------- featured games ----------

    /** Featured live games of a region (Riot refreshes them every few minutes), cached for 30 seconds. */
    public List<Object> featured(String region) {
        Cached<List<Object>> hit = featuredCache.get(region);
        if (hit != null && hit.fresh(FEATURED_TTL_MS)) return hit.value();

        List<JsonNode> games = new ArrayList<>();
        Map<String, Rank> known = new HashMap<>();
        try {
            riot.featuredGames(region).path("gameList").forEach(games::add);
            known.putAll(knownRanks(games));
        } catch (RiotNotFoundException e) {
            // no featured games right now
        } catch (AppException e) {
            // Riot refuses featured-games for some API keys (403). Look at the best players of the live ladder instead.
            log.info("[live] featured-games not available ({}), checking top Challenger players instead", e.getMessage());
            games = gamesOfTopPlayers(region, known);
        }
        if (games.size() > FEATURED_MAX_GAMES) games = games.subList(0, FEATURED_MAX_GAMES);

        Names n = names.get();
        List<Object> out = new ArrayList<>();
        for (JsonNode g : games) out.add(featuredGame(g, region, n, known));
        featuredCache.put(region, new Cached<>(System.currentTimeMillis(), out));
        return out;
    }

    /**
     * Fallback for featured games: takes the top Challenger players from Riot's live ladder and asks for their
     * active games, returning the distinct games found. The ladder is read with the current API key on purpose:
     * Riot puuids are encrypted per key, so puuids stored by someone else's key would be rejected (400).
     * The ladder ranks are added to {@code ranks} (puuid -> Challenger rank) for the tier shown on each game.
     */
    private List<JsonNode> gamesOfTopPlayers(String region, Map<String, Rank> ranks) {
        List<JsonNode> ladder = new ArrayList<>();
        riot.apexEntries(region, Domain.queue("ranked_solo").riot(), "challenger").path("entries").forEach(ladder::add);
        ladder.sort(Comparator.comparingInt((JsonNode e) -> e.path("leaguePoints").asInt()).reversed());

        int challenger = Domain.TIER_BUCKETS.indexOf("challenger");
        List<String> puuids = new ArrayList<>();
        for (JsonNode e : ladder) {
            String puuid = e.path("puuid").asText("");
            if (puuid.isEmpty() || puuids.size() >= TOP_PLAYERS_TO_CHECK) continue;
            puuids.add(puuid);
            ranks.put(puuid, new Rank(challenger, "Challenger", e.path("leaguePoints").asInt(),
                    e.path("wins").asInt(), e.path("losses").asInt()));
        }
        List<CompletableFuture<JsonNode>> futures = new ArrayList<>();
        for (String puuid : puuids) {
            futures.add(CompletableFuture.supplyAsync(() -> {
                try {
                    return riot.activeGame(region, puuid);
                } catch (RuntimeException e) { // 404 = not playing; anything else = skip this player
                    return null;
                }
            }, pool));
        }
        Map<Long, JsonNode> byGame = new LinkedHashMap<>();
        for (CompletableFuture<JsonNode> f : futures) {
            JsonNode g = f.join();
            if (g != null) byGame.putIfAbsent(g.path("gameId").asLong(), g);
        }
        return new ArrayList<>(byGame.values());
    }

    /** Ranks of featured players that are on our stored leaderboards (no extra Riot calls). */
    private Map<String, Rank> knownRanks(List<JsonNode> games) {
        List<String> puuids = new ArrayList<>();
        for (JsonNode g : games) g.path("participants").forEach(p -> puuids.add(p.path("puuid").asText("")));
        Map<String, Rank> out = new HashMap<>();
        if (puuids.isEmpty()) return out;
        for (Map<String, Object> r : db.rows(
                "SELECT puuid, tier, league_points FROM leaderboard_entries WHERE puuid = ANY(?::text[])",
                Db.textArray(puuids))) {
            int idx = Domain.TIER_BUCKETS.indexOf(Db.s(r, "tier"));
            if (idx >= 0) out.put(Db.s(r, "puuid"), new Rank(idx, LiveMapper.cap(Db.s(r, "tier")), Db.i(r, "league_points"), 0, 0));
        }
        return out;
    }

    private Map<String, Object> featuredGame(JsonNode g, String region, Names n, Map<String, Rank> known) {
        int queueId = g.path("gameQueueConfigId").asInt();
        List<Rank> ranks = new ArrayList<>();
        g.path("participants").forEach(p -> {
            Rank r = known.get(p.path("puuid").asText(""));
            if (r != null) ranks.add(r);
        });
        AvgTier avg = LiveMapper.avgTier(ranks);
        return obj(
                "id", String.valueOf(g.path("gameId").asLong()),
                "region", Domain.REGION_LABEL.getOrDefault(region, region.toUpperCase()),
                "mode", LiveMapper.modeName(queueId, g.path("gameMode").asText()),
                "tier", avg.tier(),
                "avgLp", avg.tier() == null ? null : avg.avgLp(),
                "gameTimeSeconds", LiveMapper.gameSeconds(g, System.currentTimeMillis()),
                "phase", LiveMapper.phase(g),
                "blueTeam", featuredTeam(g, 100, n),
                "redTeam", featuredTeam(g, 200, n));
    }

    private Map<String, Object> featuredTeam(JsonNode g, int teamId, Names n) {
        List<Object> players = new ArrayList<>();
        for (JsonNode p : g.path("participants")) {
            if (p.path("teamId").asInt() != teamId) continue;
            String[] id = LiveMapper.parseRiotId(p.path("riotId").asText(""));
            players.add(obj("champ", n.champion(p.path("championId").asInt()), "name", id[0], "tag", id[1]));
        }
        return obj("bans", LiveMapper.bans(g, teamId, n), "players", players);
    }
}
