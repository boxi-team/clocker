package com.lolstats.live;

import com.fasterxml.jackson.databind.JsonNode;
import com.lolstats.common.Db;
import com.lolstats.data.Catalog;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Id -> display name lookups (champions, summoner spells, runes) for the live game responses.
 * Built from the synced Data Dragon data and cached until a newer patch is synced.
 */
@Component
public class LiveNames {
    public record Champ(String name, List<String> tags) {}

    public record Names(String patch, Map<Integer, Champ> champions, Map<Integer, String> spells,
                        Map<Integer, String> runes, Map<Integer, String> styles) {
        public String champion(int key) {
            Champ c = champions.get(key);
            return c == null ? String.valueOf(key) : c.name();
        }

        public String spell(int id) {
            return spells.getOrDefault(id, String.valueOf(id));
        }

        public String rune(int id) {
            return runes.getOrDefault(id, String.valueOf(id));
        }

        public String style(int id) {
            return styles.getOrDefault(id, String.valueOf(id));
        }
    }

    private final Db db;
    private final Catalog catalog;
    private volatile Names cached;

    public LiveNames(Db db, Catalog catalog) {
        this.db = db;
        this.catalog = catalog;
    }

    public Names get() {
        String patch = catalog.latestPatch();
        if (patch == null) throw com.lolstats.common.AppException.dataNotReady();
        Names c = cached;
        if (c != null && c.patch().equals(patch)) return c;
        Names fresh = load(patch);
        cached = fresh;
        return fresh;
    }

    private Names load(String patch) {
        Map<Integer, Champ> champs = new HashMap<>();
        for (Map<String, Object> r : db.rows("SELECT key, name, tags FROM champions WHERE patch = ?", patch)) {
            List<String> tags = Db.list(r, "tags") == null ? List.of() : Db.list(r, "tags").stream().map(Object::toString).toList();
            champs.put(Db.i(r, "key"), new Champ(Db.s(r, "name"), tags));
        }

        Map<Integer, String> spells = new HashMap<>();
        Map<String, Object> sp = db.one("SELECT data FROM static_assets WHERE version = ? AND kind = 'spells'", patch);
        if (sp != null) {
            Db.json(sp, "data").path("data").forEach(s -> {
                String key = s.path("key").asText("");
                if (!key.isEmpty()) spells.put(Integer.parseInt(key), s.path("name").asText(key));
            });
        }

        Map<Integer, String> runes = new HashMap<>();
        Map<Integer, String> styles = new HashMap<>();
        Map<String, Object> ru = db.one("SELECT data FROM static_assets WHERE version = ? AND kind = 'runes'", patch);
        if (ru != null) {
            for (JsonNode style : Db.json(ru, "data")) {
                styles.put(style.path("id").asInt(), style.path("name").asText());
                for (JsonNode slot : style.path("slots")) {
                    for (JsonNode rune : slot.path("runes")) runes.put(rune.path("id").asInt(), rune.path("name").asText());
                }
            }
        }
        return new Names(patch, champs, spells, runes, styles);
    }
}
