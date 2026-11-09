package gg.boxi.web;

import static gg.boxi.common.Api.obj;
import static gg.boxi.common.Api.ok;

import gg.boxi.common.Api;
import gg.boxi.common.AppException;
import gg.boxi.common.Db;
import gg.boxi.common.Domain;
import gg.boxi.common.Domain.QueueInfo;
import gg.boxi.common.ErrorCode;
import gg.boxi.common.Q;
import gg.boxi.data.Catalog;
import gg.boxi.ingest.MatchIngestService;
import gg.boxi.ingest.Outcome;
import gg.boxi.riot.RiotNotFoundException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
public class MatchController {
    private final Db db;
    private final Catalog catalog;
    private final MatchIngestService ingest;

    public MatchController(Db db, Catalog catalog, MatchIngestService ingest) {
        this.db = db;
        this.catalog = catalog;
        this.ingest = ingest;
    }

    private Map<String, Object> load(String matchId) {
        return db.one("SELECT * FROM matches WHERE match_id = ?", matchId);
    }

    @GetMapping("/matches/{region}/{matchId}")
    public ResponseEntity<Object> match(@PathVariable String region, @PathVariable String matchId) {
        Q q = new Q(Map.of("region", region, "matchId", matchId));
        String reg = q.oneOf("region", Domain.REGIONS, null);
        String id = q.regex("matchId", "^[A-Z0-9]+_\\d+$", null);
        if (!reg.equals(Domain.regionFromMatchId(id))) {
            throw AppException.invalidMessage("Match id " + id + " does not belong to region " + reg);
        }

        Map<String, Object> match = load(id);
        if (match == null) {
            try {
                if (ingest.ingestMatch(reg, id, "unranked") == Outcome.SKIPPED) {
                    throw new AppException(422, ErrorCode.UNSUPPORTED_MATCH,
                            "Only ranked Solo/Duo and Flex matches (not remakes) are supported");
                }
            } catch (RiotNotFoundException e) {
                throw AppException.notFound(ErrorCode.MATCH_NOT_FOUND, "Match " + id + " not found");
            }
            match = load(id);
            if (match == null) throw AppException.notFound(ErrorCode.MATCH_NOT_FOUND, "Match " + id + " not found");
        }

        String patch = catalog.latestPatch();
        List<Map<String, Object>> participants = db.rows(
                "SELECT p.*, c.id AS champion_name FROM match_participants p "
                        + "LEFT JOIN champions c ON c.key = p.champion_id AND c.patch = ? "
                        + "WHERE p.match_id = ? ORDER BY p.team_id, "
                        + "array_position(ARRAY['top','jungle','mid','adc','support'], p.role)", patch, id);
        List<Map<String, Object>> bans = db.rows(
                "SELECT team_id, champion_id FROM match_bans WHERE match_id = ? ORDER BY pick_turn", id);

        int winningTeam = Db.i(match, "winning_team");
        List<Object> teams = new ArrayList<>();
        for (int teamId : new int[]{100, 200}) {
            List<Object> parts = new ArrayList<>();
            for (Map<String, Object> p : participants) {
                if (Db.i(p, "team_id") != teamId) continue;
                parts.add(obj(
                        "puuid", p.get("puuid"),
                        "gameName", p.get("game_name"),
                        "tagLine", p.get("tag_line"),
                        "championKey", p.get("champion_id"),
                        "championId", p.get("champion_name"),
                        "role", p.get("role"),
                        "win", p.get("win"),
                        "kills", p.get("kills"), "deaths", p.get("deaths"), "assists", p.get("assists"),
                        "cs", p.get("cs"), "gold", p.get("gold"), "damageToChampions", p.get("damage"),
                        "visionScore", p.get("vision_score"), "champLevel", p.get("champ_level"),
                        "items", p.get("items"),
                        "summonerSpells", List.of(p.get("spell1"), p.get("spell2")),
                        "runes", obj("primaryStyle", p.get("primary_style"), "subStyle", p.get("sub_style"),
                                "keystone", p.get("keystone"), "primaryPerks", p.get("primary_perks"),
                                "secondaryPerks", p.get("secondary_perks"), "statShards", p.get("stat_shards"))));
            }
            teams.add(obj(
                    "teamId", teamId,
                    "win", winningTeam == teamId,
                    "bans", bans.stream().filter(b -> Db.i(b, "team_id") == teamId).map(b -> b.get("champion_id")).toList(),
                    "participants", parts));
        }

        QueueInfo queue = Domain.queueFromId(Db.i(match, "queue_id"));
        return Api.cached(3600, ok(obj(
                "matchId", match.get("match_id"),
                "region", match.get("region"),
                "queue", queue != null ? queue.name() : Domain.QUEUES.get(0).name(),
                "patch", match.get("patch"),
                "gameCreation", Db.l(match, "game_creation"),
                "gameDuration", match.get("game_duration"),
                "winningTeamId", winningTeam,
                "tierBucket", match.get("tier_bucket"),
                "teams", teams), obj("patch", match.get("patch")))); // matches never change
    }
}
