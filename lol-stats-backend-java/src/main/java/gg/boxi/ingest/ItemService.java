package gg.boxi.ingest;

import com.fasterxml.jackson.databind.JsonNode;
import gg.boxi.common.Db;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Item metadata (boots / completed / cost) per synced patch, used to classify what a player built. */
@Service
public class ItemService {
    public record ItemInfo(boolean boots, boolean completed, int cost) {}

    public record Classified(Integer boots, List<Integer> completedItems, List<Integer> coreItems) {}

    private record VersionItems(String version, Map<Integer, ItemInfo> items) {}

    private final Db db;
    private volatile List<VersionItems> cache;

    public ItemService(Db db) {
        this.db = db;
    }

    public void clearCache() {
        cache = null;
    }

    private List<VersionItems> load() {
        List<VersionItems> c = cache;
        if (c != null) return c;
        List<VersionItems> out = new ArrayList<>();
        for (Map<String, Object> r : db.rows(
                "SELECT a.version, a.data FROM static_assets a JOIN patches p USING (version) "
                        + "WHERE a.kind = 'items' ORDER BY p.synced_at DESC")) {
            Map<Integer, ItemInfo> items = new HashMap<>();
            JsonNode data = Db.json(r, "data").path("data");
            Iterator<Map.Entry<String, JsonNode>> it = data.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> e = it.next();
                items.put(Integer.parseInt(e.getKey()), parse(e.getValue()));
            }
            out.add(new VersionItems(Db.s(r, "version"), items));
        }
        cache = out;
        return out;
    }

    static ItemInfo parse(JsonNode it) {
        List<String> tags = new ArrayList<>();
        it.path("tags").forEach(t -> tags.add(t.asText()));
        int cost = it.path("gold").path("total").asInt(0);
        boolean purchasable = it.path("gold").path("purchasable").asBoolean(true);
        boolean completed = !tags.contains("Consumable") && !tags.contains("Trinket")
                && purchasable && it.path("into").size() == 0 && cost >= 1000;
        return new ItemInfo(tags.contains("Boots"), completed, cost);
    }

    /** Item data for a {@code major.minor} patch; falls back to the newest synced patch. null if none synced. */
    public Map<Integer, ItemInfo> itemsForPatch(String patch) {
        List<VersionItems> all = load();
        if (all.isEmpty()) return null;
        return all.stream().filter(a -> a.version().startsWith(patch + ".")).findFirst().orElse(all.get(0)).items();
    }

    /** {@code slots} = item0..item5 (the trinket is excluded by the caller). */
    public static Classified classify(List<Integer> slots, Map<Integer, ItemInfo> map) {
        List<Integer> owned = slots.stream().filter(id -> id > 0).toList();
        if (map == null) {
            List<Integer> completedItems = new ArrayList<>(owned);
            return new Classified(null, completedItems, coreOf(completedItems));
        }
        Integer boots = null;
        record Done(int id, int cost) {}
        List<Done> completed = new ArrayList<>();
        for (int id : owned) {
            ItemInfo info = map.get(id);
            if (info == null) continue;
            if (info.boots()) {
                int bootsCost = boots == null ? 0 : map.get(boots).cost();
                if (boots == null || info.cost() > bootsCost) boots = id;
            } else if (info.completed()) {
                completed.add(new Done(id, info.cost()));
            }
        }
        completed.sort(Comparator.comparingInt(Done::cost).reversed().thenComparingInt(Done::id));
        List<Integer> completedItems = completed.stream().map(Done::id).toList();
        return new Classified(boots, completedItems, coreOf(completedItems));
    }

    private static List<Integer> coreOf(List<Integer> completedByCost) {
        if (completedByCost.size() < 3) return null;
        return completedByCost.subList(0, 3).stream().sorted().toList();
    }
}
