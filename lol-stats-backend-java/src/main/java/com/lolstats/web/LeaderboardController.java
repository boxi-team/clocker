package com.lolstats.web;

import static com.lolstats.common.Api.obj;
import static com.lolstats.common.Api.ok;
import static com.lolstats.common.Api.ratio;

import com.lolstats.common.Api;
import com.lolstats.common.AppException;
import com.lolstats.common.Db;
import com.lolstats.common.Domain;
import com.lolstats.common.Q;
import com.lolstats.data.Catalog;
import com.lolstats.data.DDragonClient;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/leaderboard")
public class LeaderboardController {
    private final Db db;
    private final Catalog catalog;
    private final DDragonClient dd;

    public LeaderboardController(Db db, Catalog catalog, DDragonClient dd) {
        this.db = db;
        this.catalog = catalog;
        this.dd = dd;
    }

    /** GET /v1/leaderboard?region=euw1&tier=silver&limit=100 - top ranked solo/duo players of one tier by LP. */
    @GetMapping
    public ResponseEntity<Object> leaderboard(@RequestParam Map<String, String> query) {
        Q q = new Q(query);
        String region = q.oneOf("region", Domain.REGIONS, "euw1");
        String tier = q.oneOf("tier", Domain.TIER_BUCKETS, "challenger");
        int limit = q.integer("limit", 1, 100, 100);
        String version = catalog.latestPatch();
        if (version == null) throw AppException.dataNotReady();

        List<Object> data = new ArrayList<>();
        for (Map<String, Object> r : db.rows(
                "SELECT l.rank, l.puuid, p.game_name, p.tag_line, l.division, l.league_points, l.wins, l.losses, "
                        + "p.profile_icon_id FROM leaderboard_entries l JOIN players p ON p.puuid = l.puuid "
                        + "WHERE l.region = ? AND l.tier = ? ORDER BY l.rank LIMIT ?", region, tier, limit)) {
            int wins = Db.i(r, "wins");
            int losses = Db.i(r, "losses");
            int icon = r.get("profile_icon_id") == null ? 0 : Db.i(r, "profile_icon_id");
            data.add(obj(
                    "rank", r.get("rank"),
                    "puuid", r.get("puuid"),
                    "gameName", r.get("game_name"),
                    "tagLine", r.get("tag_line"),
                    "tier", tier.toUpperCase(),
                    "division", r.get("division"),
                    "leaguePoints", r.get("league_points"),
                    "wins", wins,
                    "losses", losses,
                    "winRate", ratio(wins, wins + losses),
                    "profileIconId", icon,
                    "profileIconUrl", dd.profileIconUrl(version, icon)));
        }
        Map<String, Object> updated = db.one(
                "SELECT max(updated_at) AS at FROM leaderboard_entries WHERE region = ? AND tier = ?", region, tier);
        return Api.cached(60, ok(data, obj("region", region, "tier", tier, "total", data.size(),
                "updatedAt", updated == null ? null : updated.get("at"))));
    }
}