package gg.boxi.web;

import static gg.boxi.common.Api.obj;
import static gg.boxi.common.Api.ok;

import gg.boxi.common.Api;
import gg.boxi.common.AppException;
import gg.boxi.common.Db;
import gg.boxi.common.ErrorCode;
import gg.boxi.common.Q;
import gg.boxi.data.Catalog;
import gg.boxi.query.PatchDiffService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
public class MetaController {
    private static final String ASSET_PATCH = "^(latest|\\d+\\.\\d+\\.\\d+)$";

    private final Db db;
    private final Catalog catalog;
    private final PatchDiffService diffs;

    public MetaController(Db db, Catalog catalog, PatchDiffService diffs) {
        this.db = db;
        this.catalog = catalog;
        this.diffs = diffs;
    }

    @GetMapping("/health")
    public Object health() {
        db.one("SELECT 1");
        return obj("data", obj("ok", true));
    }

    @GetMapping("/patches")
    public Object patches() {
        return obj("data", db.rows("SELECT version, locale, synced_at AS \"syncedAt\" FROM patches "
                + "ORDER BY string_to_array(version, '.')::int[] DESC"));
    }

    private Object patchWithChanges(String version) {
        Map<String, Object> row = db.one("SELECT version, locale, synced_at AS \"syncedAt\" FROM patches WHERE version = ?", version);
        if (row == null) throw AppException.notFound(ErrorCode.NOT_FOUND, "Patch " + version + " is not synced");
        Map<String, Object> data = new LinkedHashMap<>(row);
        // `changes` is null for the oldest synced patch (nothing to compare with).
        data.put("changes", diffs.patchChanges(version));
        return obj("data", data);
    }

    @GetMapping("/patches/latest")
    public Object latestPatch() {
        return patchWithChanges(catalog.resolveStaticPatch("latest"));
    }

    @GetMapping("/patches/{version}")
    public Object patch(@PathVariable String version) {
        return patchWithChanges(new Q(Map.of("version", version)).regex("version", "^\\d+\\.\\d+\\.\\d+$", null));
    }

    private ResponseEntity<Object> asset(Map<String, String> query, String kind) {
        String patch = catalog.resolveStaticPatch(new Q(query).regex("patch", ASSET_PATCH, "latest"));
        Map<String, Object> row = db.one("SELECT data FROM static_assets WHERE version = ? AND kind = ?", patch, kind);
        if (row == null) throw AppException.notFound(ErrorCode.NOT_FOUND, "No " + kind + " data for patch " + patch);
        return Api.cached(3600, ok(row.get("data"), obj("patch", patch)));
    }

    @GetMapping("/items")
    public ResponseEntity<Object> items(@RequestParam Map<String, String> query) {
        return asset(query, "items");
    }

    @GetMapping("/runes")
    public ResponseEntity<Object> runes(@RequestParam Map<String, String> query) {
        return asset(query, "runes");
    }

    @GetMapping("/summoner-spells")
    public ResponseEntity<Object> summonerSpells(@RequestParam Map<String, String> query) {
        return asset(query, "spells");
    }
}
