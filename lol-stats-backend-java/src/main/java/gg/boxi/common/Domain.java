package gg.boxi.common;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Regions, roles, queues and tiers. */
public final class Domain {
    private Domain() {}

    // ---------- regions ----------
    public static final List<String> REGIONS = List.of(
            "br1", "eun1", "euw1", "jp1", "kr", "la1", "la2", "me1", "na1",
            "oc1", "ph2", "ru", "sg2", "th2", "tr1", "tw2", "vn2");

    /** Riot regional routing for account-v1 and match-v5. */
    public static final Map<String, String> ROUTING = Map.ofEntries(
            Map.entry("na1", "americas"), Map.entry("br1", "americas"), Map.entry("la1", "americas"), Map.entry("la2", "americas"),
            Map.entry("kr", "asia"), Map.entry("jp1", "asia"),
            Map.entry("eun1", "europe"), Map.entry("euw1", "europe"), Map.entry("me1", "europe"),
            Map.entry("tr1", "europe"), Map.entry("ru", "europe"),
            Map.entry("oc1", "sea"), Map.entry("ph2", "sea"), Map.entry("sg2", "sea"),
            Map.entry("th2", "sea"), Map.entry("tw2", "sea"), Map.entry("vn2", "sea"));

    /** "EUW1_123" -> "euw1", "KR_123" -> "kr" */
    public static String regionFromMatchId(String matchId) {
        String prefix = matchId.split("_")[0].toLowerCase();
        return REGIONS.contains(prefix) ? prefix : null;
    }

    // ---------- roles ----------
    public static final List<String> ROLES = List.of("top", "jungle", "mid", "adc", "support");
    public static final Map<String, String> ROLE_FROM_RIOT = Map.of(
            "TOP", "top", "JUNGLE", "jungle", "MIDDLE", "mid", "BOTTOM", "adc", "UTILITY", "support");

    // ---------- queues ----------
    public record QueueInfo(String name, int id, String riot) {}

    public static final List<QueueInfo> QUEUES = List.of(
            new QueueInfo("ranked_solo", 420, "RANKED_SOLO_5x5"),
            new QueueInfo("ranked_flex", 440, "RANKED_FLEX_SR"));
    public static final List<String> QUEUE_NAMES = QUEUES.stream().map(QueueInfo::name).toList();

    public static QueueInfo queue(String name) {
        return QUEUES.stream().filter(q -> q.name().equals(name)).findFirst().orElseThrow();
    }

    public static QueueInfo queueFromId(int id) {
        return QUEUES.stream().filter(q -> q.id() == id).findFirst().orElse(null);
    }

    public static QueueInfo queueFromRiot(String riot) {
        return QUEUES.stream().filter(q -> q.riot().equals(riot)).findFirst().orElse(null);
    }

    // ---------- tiers ----------
    public static final List<String> TIER_BUCKETS = List.of(
            "iron", "bronze", "silver", "gold", "platinum", "emerald", "diamond", "master", "grandmaster", "challenger");

    public static final List<String> TIER_FILTERS = concat(
            List.of("all"), TIER_BUCKETS, List.of("emerald_plus", "diamond_plus", "master_plus"));

    private static List<String> plus(String from) {
        return TIER_BUCKETS.subList(TIER_BUCKETS.indexOf(from), TIER_BUCKETS.size());
    }

    /** null = no tier restriction. */
    public static List<String> tierFilterToBuckets(String t) {
        return switch (t) {
            case "all" -> null;
            case "emerald_plus" -> plus("emerald");
            case "diamond_plus" -> plus("diamond");
            case "master_plus" -> plus("master");
            default -> List.of(t);
        };
    }

    @SafeVarargs
    private static List<String> concat(List<String>... lists) {
        List<String> out = new ArrayList<>();
        for (List<String> l : lists) out.addAll(l);
        return List.copyOf(out);
    }
}
