package com.lolstats.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.lolstats.common.AppException;
import com.lolstats.common.Db;
import com.lolstats.common.ErrorCode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/** Patch and champion lookups shared by the controllers. */
@Service
public class Catalog {
    public record ChampionRef(int key, String id, String name, String imageFull) {}

    public record ChampionIndex(String patch, Map<Integer, ChampionRef> byKey) {}

    private static final Pattern NUMERIC = Pattern.compile("^\\d+$");

    private final Db db;

    public Catalog(Db db) {
        this.db = db;
    }

    /** Version string of the most recently synced patch, or null if nothing is synced yet. */
    public String latestPatch() {
        // Newest by version number, not by sync time, so back-filling an older patch never becomes "latest".
        Map<String, Object> r = db.one(
                "SELECT version FROM patches ORDER BY string_to_array(version, '.')::int[] DESC LIMIT 1");
        return r == null ? null : Db.s(r, "version");
    }

    /** "latest" -> major.minor of the newest synced patch (e.g. "15.21"); otherwise the given major.minor. */
    public String resolveAnalyticsPatch(String p) {
        if (!"latest".equals(p)) return p;
        String v = latestPatch();
        if (v == null) throw AppException.dataNotReady();
        String[] parts = v.split("\\.");
        return parts[0] + "." + parts[1];
    }

    /** "latest" -> newest synced Data Dragon version; otherwise the given full version. */
    public String resolveStaticPatch(String p) {
        if (!"latest".equals(p)) return p;
        String v = latestPatch();
        if (v == null) throw AppException.dataNotReady();
        return v;
    }

    private static ChampionRef toRef(Map<String, Object> r) {
        JsonNode image = Db.json(r, "image");
        return new ChampionRef(Db.i(r, "key"), Db.s(r, "id"), Db.s(r, "name"),
                image == null ? null : image.path("full").asText(null));
    }

    /** Accepts a Data Dragon id ("Ahri", case-insensitive) or a numeric key ("103"). Looks in the newest patch. */
    public ChampionRef resolveChampion(String idOrKey) {
        String patch = latestPatch();
        if (patch == null) throw AppException.dataNotReady();
        boolean numeric = NUMERIC.matcher(idOrKey).matches();
        Map<String, Object> r = db.one(
                "SELECT key, id, name, image FROM champions WHERE patch = ? AND "
                        + (numeric ? "key = ?" : "lower(id) = lower(?)"),
                patch, numeric ? (Object) Integer.parseInt(idOrKey) : idOrKey);
        if (r == null) throw AppException.notFound(ErrorCode.CHAMPION_NOT_FOUND, "Champion \"" + idOrKey + "\" not found");
        return toRef(r);
    }

    /** key -> champion for every champion of the newest patch. */
    public ChampionIndex championIndex() {
        String patch = latestPatch();
        if (patch == null) throw AppException.dataNotReady();
        List<Map<String, Object>> rows = db.rows("SELECT key, id, name, image FROM champions WHERE patch = ?", patch);
        Map<Integer, ChampionRef> byKey = new HashMap<>();
        for (Map<String, Object> r : rows) byKey.put(Db.i(r, "key"), toRef(r));
        return new ChampionIndex(patch, byKey);
    }
}
