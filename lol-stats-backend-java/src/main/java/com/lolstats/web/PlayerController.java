package com.lolstats.web;

import static com.lolstats.common.Api.obj;
import static com.lolstats.common.Api.ok;

import com.lolstats.common.Api;
import com.lolstats.common.AppException;
import com.lolstats.common.Db;
import com.lolstats.common.Domain;
import com.lolstats.common.ErrorCode;
import com.lolstats.common.Q;
import com.lolstats.config.AppProps;
import com.lolstats.data.Catalog;
import com.lolstats.data.Catalog.ChampionIndex;
import com.lolstats.data.Catalog.ChampionRef;
import com.lolstats.data.DDragonClient;
import com.lolstats.ingest.PlayerRow;
import com.lolstats.ingest.PlayerService;
import com.lolstats.jobs.JobRow;
import com.lolstats.jobs.JobService;
import com.lolstats.query.PlayerQueries;
import com.lolstats.query.PlayerQueries.MatchPage;
import com.lolstats.query.PlayerQueries.PlayerFilter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/players/{region}/{gameName}/{tagLine}")
public class PlayerController {
    private static final String PATCH_RE = "^\\d+\\.\\d+$";

    private final Db db;
    private final Catalog catalog;
    private final DDragonClient dd;
    private final PlayerService players;
    private final PlayerQueries queries;
    private final JobService jobs;
    private final AppProps props;

    public PlayerController(Db db, Catalog catalog, DDragonClient dd, PlayerService players, PlayerQueries queries,
                            JobService jobs, AppProps props) {
        this.db = db;
        this.catalog = catalog;
        this.dd = dd;
        this.players = players;
        this.queries = queries;
        this.jobs = jobs;
        this.props = props;
    }

    private record Who(String region, String gameName, String tagLine) {}

    private static Who who(String region, String gameName, String tagLine) {
        Q q = new Q(Map.of("region", region, "gameName", gameName, "tagLine", tagLine));
        return new Who(q.oneOf("region", Domain.REGIONS, null), q.str("gameName", 16, null), q.str("tagLine", 5, null));
    }

    private PlayerRow requirePlayer(Who w) {
        PlayerRow player = players.findPlayer(w.region(), w.gameName(), w.tagLine());
        if (player == null) {
            throw AppException.notFound(ErrorCode.PLAYER_NOT_FOUND,
                    w.gameName() + "#" + w.tagLine() + " is not loaded yet. GET the player profile first.");
        }
        return player;
    }

    private Map<String, Object> profile(PlayerRow player) {
        String version = catalog.latestPatch();
        if (version == null) throw AppException.dataNotReady();
        List<Object> ranked = new ArrayList<>();
        for (Map<String, Object> r : db.rows("SELECT queue, tier, division, league_points, wins, losses "
                + "FROM player_ranks WHERE puuid = ? ORDER BY queue", player.puuid())) {
            int wins = Db.i(r, "wins");
            int losses = Db.i(r, "losses");
            ranked.add(obj("queue", r.get("queue"), "tier", r.get("tier"), "division", r.get("division"),
                    "leaguePoints", r.get("league_points"), "wins", wins, "losses", losses,
                    "winRate", wins + losses > 0 ? Math.round((double) wins / (wins + losses) * 10000) / 10000.0 : 0));
        }
        int indexed = queries.countIndexed(player.puuid());
        JobRow job = jobs.activeJobFor(JobService.playerJobKey(player.puuid()));
        int icon = player.profileIconId() == null ? 0 : player.profileIconId();
        return obj(
                "puuid", player.puuid(),
                "region", player.region(),
                "gameName", player.gameName(),
                "tagLine", player.tagLine(),
                "summonerLevel", player.summonerLevel() == null ? 0 : player.summonerLevel(),
                "profileIconId", icon,
                "profileIconUrl", dd.profileIconUrl(version, icon),
                "ranked", ranked,
                "matchesStatus", job != null ? "pending" : indexed > 0 ? "ready" : "empty",
                "matchesIndexed", indexed,
                "jobId", job == null ? null : job.id(),
                "lastRefreshedAt", player.lastRefreshedAt());
    }

    private JobRow startRefresh(PlayerRow player, boolean skipProfile) {
        db.update("UPDATE players SET last_refresh_requested_at = now() WHERE puuid = ?", player.puuid());
        return jobs.enqueue("player_refresh", obj("puuid", player.puuid(), "skipProfile", skipProfile),
                JobService.playerJobKey(player.puuid()), 10);
    }

    // ---- profile (creates the player on first sight) ----
    @GetMapping
    public ResponseEntity<Object> get(@PathVariable String region, @PathVariable String gameName, @PathVariable String tagLine) {
        Who w = who(region, gameName, tagLine);
        PlayerRow player = players.findPlayer(w.region(), w.gameName(), w.tagLine());
        if (player == null) {
            player = players.fetchAndStorePlayer(w.region(), w.gameName(), w.tagLine());
            startRefresh(player, true);
        }
        return Api.cached(30, ok(profile(player)));
    }

    // ---- refresh ("Update" button) ----
    @PostMapping("/refresh")
    public ResponseEntity<Object> refresh(@PathVariable String region, @PathVariable String gameName, @PathVariable String tagLine) {
        PlayerRow player = requirePlayer(who(region, gameName, tagLine));

        JobRow active = jobs.activeJobFor(JobService.playerJobKey(player.puuid()));
        if (active != null) return ResponseEntity.accepted().body(obj("data", active.toApi()));

        if (player.lastRefreshRequestedAt() != null) {
            double elapsed = (System.currentTimeMillis() - player.lastRefreshRequestedAt().toEpochMilli()) / 1000.0;
            int wait = (int) Math.ceil(props.refreshCooldownSeconds() - elapsed);
            if (wait > 0) {
                throw new AppException(429, ErrorCode.REFRESH_COOLDOWN,
                        "Player was refreshed recently. Try again in " + wait + "s.", null, wait);
            }
        }
        return ResponseEntity.accepted().body(obj("data", startRefresh(player, false).toApi()));
    }

    // ---- match list ----
    @GetMapping("/matches")
    public Object matches(@PathVariable String region, @PathVariable String gameName, @PathVariable String tagLine,
                          @RequestParam Map<String, String> query) {
        PlayerRow player = requirePlayer(who(region, gameName, tagLine));
        Q q = new Q(query);
        String queue = q.oneOf("queue", Domain.QUEUE_NAMES, "ranked_solo");
        String championId = q.str("championId", Integer.MAX_VALUE, null);
        String role = q.oneOf("role", Domain.ROLES, null);
        int start = q.integer("start", 0, Integer.MAX_VALUE, 0);
        int count = q.integer("count", 1, 100, 20);

        ChampionRef champ = championId == null ? null : catalog.resolveChampion(championId);
        PlayerFilter filter = new PlayerFilter(player.puuid(), Domain.queue(queue).id(), null,
                champ == null ? null : champ.key(), role);
        MatchPage page = queries.listMatches(filter, start, count, catalog.latestPatch());

        List<Object> data = new ArrayList<>();
        for (Map<String, Object> r : page.rows()) {
            int duration = Db.i(r, "game_duration");
            data.add(obj(
                    "matchId", r.get("match_id"),
                    "queue", queue,
                    "patch", r.get("patch"),
                    "gameCreation", Db.l(r, "game_creation"),
                    "gameDuration", duration,
                    "win", r.get("win"),
                    "championKey", r.get("champion_id"),
                    "championId", r.get("champion_name"),
                    "role", r.get("role"),
                    "kills", r.get("kills"), "deaths", r.get("deaths"), "assists", r.get("assists"),
                    "cs", r.get("cs"),
                    "csPerMin", Math.round(Db.d(r, "cs") / (duration / 60.0) * 100) / 100.0,
                    "gold", r.get("gold"),
                    "damageToChampions", r.get("damage"),
                    "visionScore", r.get("vision_score"),
                    "champLevel", r.get("champ_level"),
                    "items", r.get("items"),
                    "summonerSpells", List.of(r.get("spell1"), r.get("spell2")),
                    "keystone", r.get("keystone")));
        }
        return ok(data, obj("start", start, "count", data.size(), "total", page.total()));
    }

    // ---- aggregate stats ----
    @GetMapping("/stats")
    public Object stats(@PathVariable String region, @PathVariable String gameName, @PathVariable String tagLine,
                        @RequestParam Map<String, String> query) {
        PlayerRow player = requirePlayer(who(region, gameName, tagLine));
        Q q = new Q(query);
        String queue = q.oneOf("queue", Domain.QUEUE_NAMES, "ranked_solo");
        String patch = q.regex("patch", PATCH_RE, null);
        return ok(queries.playerStats(new PlayerFilter(player.puuid(), Domain.queue(queue).id(), patch, null, null)),
                obj("patch", patch));
    }

    // ---- per champion ----
    @GetMapping("/champions")
    public Object champions(@PathVariable String region, @PathVariable String gameName, @PathVariable String tagLine,
                            @RequestParam Map<String, String> query) {
        PlayerRow player = requirePlayer(who(region, gameName, tagLine));
        Q q = new Q(query);
        String queue = q.oneOf("queue", Domain.QUEUE_NAMES, "ranked_solo");
        String patch = q.regex("patch", PATCH_RE, null);
        String role = q.oneOf("role", Domain.ROLES, null);
        String sort = q.oneOf("sort", List.of("games", "winRate", "kda"), "games");
        int limit = q.integer("limit", 1, 200, 50);

        List<Map<String, Object>> rows = queries.playerChampions(
                new PlayerFilter(player.puuid(), Domain.queue(queue).id(), patch, null, role), sort, limit);
        ChampionIndex index = catalog.championIndex();
        List<Object> data = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            ChampionRef c = index.byKey().get(Db.i(r, "championKey"));
            Map<String, Object> m = new LinkedHashMap<>(r);
            m.put("championId", c == null ? null : c.id());
            m.put("name", c == null ? null : c.name());
            m.put("iconUrl", c == null ? null : dd.championImageUrl(index.patch(), c.imageFull()));
            data.add(m);
        }
        return ok(data, obj("patch", patch));
    }

    @GetMapping("/champions/{idOrKey}")
    public Object championDetail(@PathVariable String region, @PathVariable String gameName, @PathVariable String tagLine,
                                 @PathVariable String idOrKey, @RequestParam Map<String, String> query) {
        PlayerRow player = requirePlayer(who(region, gameName, tagLine));
        Q q = new Q(query);
        String queue = q.oneOf("queue", Domain.QUEUE_NAMES, "ranked_solo");
        String patch = q.regex("patch", PATCH_RE, null);
        ChampionRef champ = catalog.resolveChampion(idOrKey);
        Map<String, Object> data = obj("championKey", champ.key(), "championId", champ.id());
        data.putAll(queries.playerChampionDetail(
                new PlayerFilter(player.puuid(), Domain.queue(queue).id(), patch, champ.key(), null)));
        return ok(data, obj("patch", patch));
    }
}
