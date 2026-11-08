package com.lolstats.web;

import static com.lolstats.common.Api.obj;
import static com.lolstats.common.Api.ok;

import com.fasterxml.jackson.databind.JsonNode;
import com.lolstats.common.Api;
import com.lolstats.common.AppException;
import com.lolstats.common.Db;
import com.lolstats.common.Domain;
import com.lolstats.common.ErrorCode;
import com.lolstats.common.Q;
import com.lolstats.data.Catalog;
import com.lolstats.data.Catalog.ChampionIndex;
import com.lolstats.data.Catalog.ChampionRef;
import com.lolstats.data.DDragonClient;
import com.lolstats.query.Filter;
import com.lolstats.query.StatsQueries;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
public class ChampionController {
    private static final List<String> TAGS = List.of("Assassin", "Fighter", "Mage", "Marksman", "Support", "Tank");
    private static final List<String> TIER_SORTS = List.of("score", "winRate", "pickRate", "banRate", "games");
    private static final int TTL = 300;

    private final Db db;
    private final Catalog catalog;
    private final DDragonClient dd;
    private final StatsQueries stats;

    public ChampionController(Db db, Catalog catalog, DDragonClient dd, StatsQueries stats) {
        this.db = db;
        this.catalog = catalog;
        this.dd = dd;
        this.stats = stats;
    }

    private record FilterAndMeta(Filter filter, Map<String, Object> meta) {}

    private FilterAndMeta toFilter(Map<String, String> query) {
        Q q = new Q(query);
        String patchParam = q.regex("patch", "^(latest|\\d+\\.\\d+)$", "latest");
        String tier = q.oneOf("tier", Domain.TIER_FILTERS, "master_plus");
        String queue = q.oneOf("queue", Domain.QUEUE_NAMES, "ranked_solo");
        List<String> regions = new ArrayList<>(Domain.REGIONS);
        regions.add("all");
        String region = q.oneOf("region", regions, "all");
        String role = q.oneOf("role", Domain.ROLES, null);

        String patch = catalog.resolveAnalyticsPatch(patchParam);
        Filter filter = new Filter(patch, Domain.queue(queue).id(), Domain.tierFilterToBuckets(tier),
                region.equals("all") ? null : region, role);
        return new FilterAndMeta(filter, obj("patch", patch, "tier", tier, "queue", queue, "region", region));
    }

    private Map<String, Object> summary(Map<String, Object> r) {
        JsonNode image = Db.json(r, "image");
        return obj("key", r.get("key"), "id", r.get("id"), "name", r.get("name"), "title", r.get("title"),
                "blurb", r.get("blurb"), "tags", r.get("tags"), "partype", r.get("partype"),
                "info", r.get("info"), "stats", r.get("stats"),
                "iconUrl", dd.championImageUrl(Db.s(r, "patch"), image.path("full").asText()),
                "splashUrl", dd.splashUrl(Db.s(r, "id")));
    }

    private static Map<String, Object> meta(Map<String, Object> m, int total) {
        Map<String, Object> out = new LinkedHashMap<>(m);
        out.put("totalMatches", total);
        return out;
    }

    // ---- static ----
    @GetMapping("/champions")
    public ResponseEntity<Object> list(@RequestParam Map<String, String> query) {
        Q q = new Q(query);
        String patch = catalog.resolveStaticPatch(q.regex("patch", "^(latest|\\d+\\.\\d+\\.\\d+)$", "latest"));
        String tag = q.oneOf("tag", TAGS, null);
        String search = q.str("search", 32, null);

        List<Object> params = new ArrayList<>();
        params.add(patch);
        String where = "patch = ?";
        if (tag != null) {
            where += " AND ? = ANY(tags)";
            params.add(tag);
        }
        if (search != null) {
            where += " AND name ILIKE ?";
            params.add("%" + search + "%");
        }
        List<Map<String, Object>> rows = db.rows("SELECT key, patch, id, name, title, blurb, tags, partype, info, stats, image "
                + "FROM champions WHERE " + where + " ORDER BY name", params.toArray());
        return Api.cached(TTL, ok(rows.stream().map(this::summary).toList(), obj("patch", patch)));
    }

    @GetMapping("/champions/{idOrKey}")
    public ResponseEntity<Object> detail(@PathVariable String idOrKey, @RequestParam Map<String, String> query) {
        String patch = catalog.resolveStaticPatch(new Q(query).regex("patch", "^(latest|\\d+\\.\\d+\\.\\d+)$", "latest"));
        ChampionRef ref = catalog.resolveChampion(idOrKey);
        Map<String, Object> row = db.one("SELECT * FROM champions WHERE key = ? AND patch = ?", ref.key(), patch);
        if (row == null) {
            throw AppException.notFound(ErrorCode.CHAMPION_NOT_FOUND, ref.name() + " does not exist in patch " + patch);
        }
        Map<String, Object> data = summary(row);
        data.put("lore", row.get("lore"));
        data.put("passive", row.get("passive"));
        data.put("spells", row.get("spells"));
        data.put("skins", row.get("skins"));
        return Api.cached(TTL, ok(data, obj("patch", patch)));
    }

    // ---- analytics ----
    @GetMapping("/champions/{idOrKey}/stats")
    public ResponseEntity<Object> stats(@PathVariable String idOrKey, @RequestParam Map<String, String> query) {
        ChampionRef champ = catalog.resolveChampion(idOrKey);
        FilterAndMeta fm = toFilter(query);
        Map<String, Object> result = stats.championStats(fm.filter(), champ.key());
        Map<String, Object> data = obj("championKey", champ.key(), "championId", champ.id());
        result.forEach((k, v) -> {
            if (!k.equals("totalMatches")) data.put(k, v);
        });
        return Api.cached(TTL, ok(data, meta(fm.meta(), (Integer) result.get("totalMatches"))));
    }

    @GetMapping("/champions/{idOrKey}/builds")
    public ResponseEntity<Object> builds(@PathVariable String idOrKey, @RequestParam Map<String, String> query) {
        ChampionRef champ = catalog.resolveChampion(idOrKey);
        FilterAndMeta fm = toFilter(query);
        String vs = query.get("vs");
        ChampionRef opponent = vs == null || vs.isEmpty() ? null : catalog.resolveChampion(vs);
        Map<String, Object> built = stats.championBuilds(fm.filter(), champ.key(), opponent == null ? null : opponent.key());
        int total = stats.totalMatches(fm.filter());
        Map<String, Object> data = obj(
                "championKey", champ.key(), "championId", champ.id(),
                "vsChampionKey", opponent == null ? null : opponent.key(),
                "vsChampionId", opponent == null ? null : opponent.id());
        data.putAll(built);
        return Api.cached(TTL, ok(data, meta(fm.meta(), total)));
    }

    @GetMapping("/champions/{idOrKey}/matchups")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Object> matchups(@PathVariable String idOrKey, @RequestParam Map<String, String> query) {
        ChampionRef champ = catalog.resolveChampion(idOrKey);
        int minGames = new Q(query).integer("minGames", 1, Integer.MAX_VALUE, 100);
        FilterAndMeta fm = toFilter(query);
        Map<String, Object> result = stats.championMatchups(fm.filter(), champ.key(), minGames);
        ChampionIndex index = catalog.championIndex();
        int total = stats.totalMatches(fm.filter());

        List<Object> matchups = new ArrayList<>();
        for (Map<String, Object> r : (List<Map<String, Object>>) result.get("rows")) {
            Map<String, Object> m = new LinkedHashMap<>(r);
            ChampionRef opp = index.byKey().get(Db.i(r, "opponentKey"));
            m.put("opponentId", opp != null ? opp.id() : String.valueOf(r.get("opponentKey")));
            matchups.add(m);
        }
        return Api.cached(TTL, ok(obj("championKey", champ.key(), "championId", champ.id(),
                "role", result.get("role"), "matchups", matchups), meta(fm.meta(), total)));
    }

    @GetMapping("/tier-list")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Object> tierList(@RequestParam Map<String, String> query) {
        Q q = new Q(query);
        int minGames = q.integer("minGames", 1, Integer.MAX_VALUE, 100);
        String sort = q.oneOf("sort", TIER_SORTS, "score");
        int limit = q.integer("limit", 1, 500, 200);
        FilterAndMeta fm = toFilter(query);

        Map<String, Object> result = stats.tierList(fm.filter(), minGames);
        ChampionIndex index = catalog.championIndex();

        List<Map<String, Object>> rows = new ArrayList<>((List<Map<String, Object>>) result.get("rows"));
        rows.removeIf(r -> !index.byKey().containsKey(Db.i(r, "championKey")));
        rows.sort(Comparator.<Map<String, Object>>comparingDouble(r -> Db.d(r, sort))
                .thenComparingInt(r -> Db.i(r, "games")).reversed());

        List<Object> out = new ArrayList<>();
        for (int i = 0; i < Math.min(limit, rows.size()); i++) {
            Map<String, Object> r = rows.get(i);
            ChampionRef c = index.byKey().get(Db.i(r, "championKey"));
            out.add(obj("rank", i + 1, "championKey", r.get("championKey"), "championId", c.id(), "name", c.name(),
                    "role", r.get("role"), "games", r.get("games"), "winRate", r.get("winRate"),
                    "pickRate", r.get("pickRate"), "banRate", r.get("banRate"), "score", r.get("score"),
                    "iconUrl", dd.championImageUrl(index.patch(), c.imageFull())));
        }
        return Api.cached(TTL, ok(out, meta(fm.meta(), (Integer) result.get("totalMatches"))));
    }
}
