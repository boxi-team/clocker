package gg.boxi.query;

import static gg.boxi.common.Api.obj;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import gg.boxi.common.Db;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BiFunction;
import java.util.function.Function;
import org.springframework.stereotype.Service;

/** What changed in a patch compared with the synced patch before it (champions and items). */
@Service
public class PatchDiffService {
    private static final String[] SPELL_SLOTS = {"Q", "W", "E", "R"};

    private final Db db;

    public PatchDiffService(Db db) {
        this.db = db;
    }

    private record Change(String field, Object from, Object to) {
        Map<String, Object> toApi() {
            return obj("field", field, "from", from, "to", to);
        }
    }

    /** Compare Data Dragon versions numerically ("15.9.1" < "15.21.1"). */
    public static int compareVersions(String a, String b) {
        String[] x = a.split("\\.");
        String[] y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int d = (i < x.length ? Integer.parseInt(x[i]) : 0) - (i < y.length ? Integer.parseInt(y[i]) : 0);
            if (d != 0) return d;
        }
        return 0;
    }

    /** The synced patch directly before {@code version}, or null if it is the oldest one. */
    public String previousPatch(String version) {
        return db.rows("SELECT version FROM patches").stream()
                .map(r -> Db.s(r, "version"))
                .filter(v -> compareVersions(v, version) < 0)
                .max(PatchDiffService::compareVersions)
                .orElse(null);
    }

    private static Object val(JsonNode n, String k) {
        return n != null && n.has(k) && !n.get(k).isNull() ? n.get(k) : null;
    }

    /** Flat field-by-field diff of two objects (one level; nested values compared as JSON). */
    private static void diffObject(String prefix, JsonNode a, JsonNode b, List<Change> out) {
        Set<String> keys = new LinkedHashSet<>();
        if (a != null) a.fieldNames().forEachRemaining(keys::add);
        if (b != null) b.fieldNames().forEachRemaining(keys::add);
        for (String k : keys) {
            Object x = val(a, k);
            Object y = val(b, k);
            if (!java.util.Objects.equals(x, y)) out.add(new Change(prefix + k, x, y));
        }
    }

    private static <T> Map<String, Object> diffMaps(Map<String, T> prev, Map<String, T> curr,
                                                    BiFunction<String, T, Map<String, Object>> ref,
                                                    BiFunction<T, T, List<Change>> compare) {
        List<Object> added = new ArrayList<>();
        List<Object> removed = new ArrayList<>();
        List<Object> changed = new ArrayList<>();
        for (Map.Entry<String, T> e : curr.entrySet()) {
            T old = prev.get(e.getKey());
            if (old == null) {
                added.add(ref.apply(e.getKey(), e.getValue()));
                continue;
            }
            List<Change> changes = compare.apply(old, e.getValue());
            if (!changes.isEmpty()) {
                Map<String, Object> m = new LinkedHashMap<>(ref.apply(e.getKey(), e.getValue()));
                m.put("changes", changes.stream().map(Change::toApi).toList());
                changed.add(m);
            }
        }
        for (Map.Entry<String, T> e : prev.entrySet()) {
            if (!curr.containsKey(e.getKey())) removed.add(ref.apply(e.getKey(), e.getValue()));
        }
        return obj("added", added, "removed", removed, "changed", changed);
    }

    // ---- champions ----
    private Map<String, Map<String, Object>> loadChampions(String version) {
        Map<String, Map<String, Object>> out = new LinkedHashMap<>();
        for (Map<String, Object> r : db.rows(
                "SELECT key, id, name, title, tags, partype, info, stats, spells FROM champions WHERE patch = ?", version)) {
            out.put(String.valueOf(Db.i(r, "key")), r);
        }
        return out;
    }

    private static List<Change> diffChampion(Map<String, Object> a, Map<String, Object> b) {
        List<Change> out = new ArrayList<>();
        for (String f : new String[]{"name", "title", "partype"}) {
            if (!java.util.Objects.equals(a.get(f), b.get(f))) out.add(new Change(f, a.get(f), b.get(f)));
        }
        if (!java.util.Objects.equals(a.get("tags"), b.get("tags"))) out.add(new Change("tags", a.get("tags"), b.get("tags")));
        diffObject("stats.", Db.json(a, "stats"), Db.json(b, "stats"), out);
        diffObject("info.", Db.json(a, "info"), Db.json(b, "info"), out);
        JsonNode sb = Db.json(b, "spells");
        JsonNode sa = Db.json(a, "spells");
        if (sb != null) {
            for (int i = 0; i < sb.size(); i++) {
                JsonNode s = sb.get(i);
                JsonNode o = sa != null && i < sa.size() ? sa.get(i) : null;
                String slot = i < SPELL_SLOTS.length ? SPELL_SLOTS[i] : String.valueOf(i);
                for (String f : new String[]{"cooldownBurn", "costBurn", "rangeBurn", "maxrank"}) {
                    Object x = val(o, f);
                    Object y = val(s, f);
                    if (!java.util.Objects.equals(x, y)) out.add(new Change("spells." + slot + "." + f, x, y));
                }
            }
        }
        return out;
    }

    // ---- items ----
    private Map<String, JsonNode> loadItems(String version) {
        Map<String, JsonNode> out = new LinkedHashMap<>();
        Map<String, Object> r = db.one("SELECT data FROM static_assets WHERE version = ? AND kind = 'items'", version);
        if (r != null) Db.json(r, "data").path("data").fields().forEachRemaining(e -> out.put(e.getKey(), e.getValue()));
        return out;
    }

    private static List<Change> diffItem(JsonNode a, JsonNode b) {
        List<Change> out = new ArrayList<>();
        Object an = val(a, "name");
        Object bn = val(b, "name");
        if (!java.util.Objects.equals(an, bn)) out.add(new Change("name", an, bn));
        diffObject("gold.", a.get("gold"), b.get("gold"), out);
        diffObject("stats.", a.get("stats"), b.get("stats"), out);
        JsonNode empty = JsonNodeFactory.instance.arrayNode();
        JsonNode af = a.has("from") ? a.get("from") : empty;
        JsonNode bf = b.has("from") ? b.get("from") : empty;
        if (!af.equals(bf)) out.add(new Change("from", af, bf));
        return out;
    }

    /** Null if there is no earlier patch. */
    public Map<String, Object> patchChanges(String version) {
        String prev = previousPatch(version);
        if (prev == null) return null;
        Function<Map<String, Object>, Map<String, Object>> champRef = c -> obj("id", c.get("key"), "name", c.get("name"));
        return obj(
                "previousVersion", prev,
                "champions", diffMaps(loadChampions(prev), loadChampions(version), (id, c) -> champRef.apply(c),
                        PatchDiffService::diffChampion),
                "items", diffMaps(loadItems(prev), loadItems(version),
                        (id, i) -> obj("id", Integer.parseInt(id), "name", i.has("name") ? i.get("name").asText() : id),
                        PatchDiffService::diffItem));
    }
}
