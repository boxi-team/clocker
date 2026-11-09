package gg.boxi.data;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import gg.boxi.common.Db;
import gg.boxi.config.AppProps;
import gg.boxi.ingest.ItemService;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/** Downloads champion data for a patch and upserts it into Postgres. */
@Service
public class SyncService {
    private static final int CONCURRENCY = 10;

    public record SyncResult(String patch, boolean synced, int champions) {}

    private final Db db;
    private final DDragonClient dd;
    private final AppProps props;
    private final ObjectMapper om;
    private final ItemService items;
    private final TransactionTemplate tx;

    public SyncService(Db db, DDragonClient dd, AppProps props, ObjectMapper om, ItemService items, TransactionTemplate tx) {
        this.db = db;
        this.dd = dd;
        this.props = props;
        this.om = om;
        this.items = items;
        this.tx = tx;
    }

    /**
     * Does nothing if that patch is already stored, unless {@code force} is true.
     * {@code version} lets you back-fill an older Data Dragon patch (needed to diff two patches).
     */
    public SyncResult syncChampions(boolean force, String version) {
        String patch = version != null ? version : dd.fetchLatestVersion();

        if (!force && db.exists("SELECT 1 FROM patches WHERE version = ?", patch)) {
            return new SyncResult(patch, false, 0);
        }

        // Fetch everything first so a failed download never leaves a half-written patch.
        List<String> ids = dd.fetchChampionIds(patch);
        List<JsonNode> details = fetchDetails(patch, ids);
        JsonNode itemData = dd.fetchItems(patch);
        JsonNode runeData = dd.fetchRunes(patch);
        JsonNode spellData = dd.fetchSummonerSpells(patch);

        tx.executeWithoutResult(status -> {
            db.update("INSERT INTO patches (version, locale) VALUES (?, ?) "
                    + "ON CONFLICT (version) DO UPDATE SET synced_at = now(), locale = EXCLUDED.locale", patch, props.locale());
            for (JsonNode d : details) upsertChampion(patch, d);
            for (Map.Entry<String, JsonNode> e : Map.of("items", itemData, "runes", runeData, "spells", spellData).entrySet()) {
                db.update("INSERT INTO static_assets (version, kind, data) VALUES (?, ?, ?::jsonb) "
                        + "ON CONFLICT (version, kind) DO UPDATE SET data = EXCLUDED.data", patch, e.getKey(), e.getValue().toString());
            }
        });
        items.clearCache();
        return new SyncResult(patch, true, details.size());
    }

    private List<JsonNode> fetchDetails(String patch, List<String> ids) {
        ExecutorService pool = Executors.newFixedThreadPool(CONCURRENCY);
        try {
            List<Future<JsonNode>> futures = new ArrayList<>();
            for (String id : ids) futures.add(pool.submit(() -> dd.fetchChampionDetail(patch, id)));
            List<JsonNode> out = new ArrayList<>();
            for (Future<JsonNode> f : futures) out.add(f.get());
            return out;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted", e);
        } catch (ExecutionException e) {
            throw new IllegalStateException("Champion download failed", e.getCause());
        } finally {
            pool.shutdownNow();
        }
    }

    private void upsertChampion(String patch, JsonNode d) {
        List<String> tags = new ArrayList<>();
        d.path("tags").forEach(t -> tags.add(t.asText()));
        db.update("INSERT INTO champions "
                        + "(key, patch, id, name, title, blurb, lore, tags, partype, info, stats, spells, passive, skins, image) "
                        + "VALUES (?,?,?,?,?,?,?,?::text[],?,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?::jsonb) "
                        + "ON CONFLICT (key, patch) DO UPDATE SET "
                        + "id = EXCLUDED.id, name = EXCLUDED.name, title = EXCLUDED.title, blurb = EXCLUDED.blurb, "
                        + "lore = EXCLUDED.lore, tags = EXCLUDED.tags, partype = EXCLUDED.partype, info = EXCLUDED.info, "
                        + "stats = EXCLUDED.stats, spells = EXCLUDED.spells, passive = EXCLUDED.passive, "
                        + "skins = EXCLUDED.skins, image = EXCLUDED.image",
                Integer.parseInt(d.path("key").asText()), patch, d.path("id").asText(), d.path("name").asText(),
                d.path("title").asText(null), d.path("blurb").asText(null), d.path("lore").asText(null),
                Db.textArray(tags), d.path("partype").asText(null),
                d.path("info").toString(), d.path("stats").toString(), d.path("spells").toString(),
                d.path("passive").toString(), d.path("skins").toString(), d.path("image").toString());
    }
}
