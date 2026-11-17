package com.lolstats;/*
 * ============================================================================
 *  LOL STATS — Standalone Crawl Runner (un singur fișier)
 * ============================================================================
 *  Descarcă meciuri ranked din Riot API și le bagă direct în baza de date
 *  PostgreSQL (Supabase). Nu depinde de Spring Boot.
 *
 *  COMPILARE:
 *    javac -cp postgresql-42.7.8.jar;jackson-core-2.19.2.jar;jackson-databind-2.19.2.jar;jackson-annotations-2.19.2.jar CrawlerMain.java
 *
 *  RULARE:
 *    java -cp .;postgresql-42.7.8.jar;jackson-core-2.19.2.jar;jackson-databind-2.19.2.jar;jackson-annotations-2.19.2.jar CrawlerMain
 *
 *  SAU cu jar-urile din gradle cache (copy-paste direct):
 *    java -cp ".;C:\Users\Domsa\.gradle\caches\modules-2\files-2.1\org.postgresql\postgresql\42.7.8\*\postgresql-42.7.8.jar;C:\Users\Domsa\.gradle\caches\modules-2\files-2.1\com.fasterxml.jackson.core\jackson-databind\2.19.2\*\jackson-databind-2.19.2.jar;C:\Users\Domsa\.gradle\caches\modules-2\files-2.1\com.fasterxml.jackson.core\jackson-core\2.19.2\*\jackson-core-2.19.2.jar;C:\Users\Domsa\.gradle\caches\modules-2\files-2.1\com.fasterxml.jackson.core\jackson-annotations\2.19.2\*\jackson-annotations-2.19.2.jar" CrawlerMain
 *
 *  VARIABILE DE MEDIU (sau le hardcodezi mai jos):
 *    DB_URL        jdbc:postgresql://aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require&prepareThreshold=0
 *    DB_USER       postgres.wjqdujmrxxthmzkbailf
 *    DB_PASSWORD   TutTypescriptGod123
 *    RIOT_API_KEY  RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * ============================================================================
 */

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

public class CrawlerMain {

    static String DB_URL        = env("DB_URL",      "jdbc:postgresql://localhost:5432/lolstats");
    static String DB_USER       = env("DB_USER",     "postgres");
    static String DB_PASSWORD   = env("DB_PASSWORD", "");
    static String RIOT_API_KEY  = env("RIOT_API_KEY","");
    static String PATCH_LATEST  = env("PATCH_LATEST","16.22");
    static String REGION        = env("CRAWL_REGION", "eun1");

    static int     TARGET_MATCHES        = Integer.parseInt(env("CRAWL_TARGET", "1000"));
    static int     PAGES_PER_TIER        = Integer.parseInt(env("CRAWL_PAGES", "10"));
    static int     MATCHES_PER_PLAYER    = Integer.parseInt(env("CRAWL_MATCHES_PER_PLAYER", "10"));
    static double  TIMELINE_SAMPLE_RATE  = Double.parseDouble(env("TIMELINE_SAMPLE_RATE", "0.25"));

    // Tier-uri de crawlat (toate by default). Pune doar ce vrei, ex: List.of("silver","gold")
    static List<String> TIERS = List.of(
            "iron","bronze","silver","gold","platinum","emerald","diamond",
            "master","grandmaster","challenger");

    static final Set<String> APEX = Set.of("master","grandmaster","challenger");

    // Rate limits Riot (dev key defaults)
    static final int[][] RATE_LIMITS = {{20, 1000}, {100, 120_000}};

    // =====================================================================
    //  MAIN
    // =====================================================================
    public static void main(String[] args) throws Exception {
        System.setProperty("java.net.preferIPv4Stack", "true");

        // Încarcă .env dacă există
        loadDotEnv();

        if (RIOT_API_KEY.isEmpty()) {
            System.err.println("❌ RIOT_API_KEY nu este setat! Pune-l în .env sau ca variabilă de mediu.");
            System.exit(1);
        }

        log("🚀 Pornire Standalone Crawler");
        log("   Regiune: %s | Țintă: %d meciuri/tier | Tiers: %s", REGION, TARGET_MATCHES, TIERS);
        log("   DB: %s", DB_URL.replaceAll("password=[^&]*", "password=***"));

        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD)) {
            conn.setAutoCommit(false);
            log("✅ Conectat la baza de date");

            // Pre-load item data pentru clasificare
            Map<Integer, ItemInfo> itemMap = loadItems(conn);
            log("📦 Încărcate %d item-uri din DB", itemMap.size());

            for (String tier : TIERS) {
                log("════════════════════════════════════════════════════");
                log("🎯 START tier [%s]", tier.toUpperCase());
                log("════════════════════════════════════════════════════");

                crawlTier(conn, tier, itemMap);
            }

            log("════════════════════════════════════════════════════");
            log("🏁 TOATE TIER-URILE FINALIZATE!");
            log("════════════════════════════════════════════════════");
        }
    }

    // =====================================================================
    //  CRAWL LOGIC
    // =====================================================================
    static void crawlTier(Connection conn, String tier, Map<Integer, ItemInfo> itemMap) throws Exception {
        List<JsonNode> entries = new ArrayList<>();

        if (APEX.contains(tier)) {
            JsonNode resp = riotGet(REGION,
                    "/lol/league/v4/" + tier + "leagues/by-queue/RANKED_SOLO_5x5");
            resp.path("entries").forEach(entries::add);
        } else {
            for (int page = 1; page <= PAGES_PER_TIER; page++) {
                JsonNode batch = riotGet(REGION,
                        "/lol/league/v4/entries/RANKED_SOLO_5x5/" + tier.toUpperCase() + "/I",
                        Map.of("page", page));
                if (batch.size() == 0) break;
                batch.forEach(entries::add);
            }
        }

        log("[%s] Găsiți %d jucători pe ladder", tier.toUpperCase(), entries.size());

        int stored = 0, existing = 0, skipped = 0, players = 0;

        for (int i = 0; i < entries.size(); i++) {
            if (TARGET_MATCHES > 0 && stored >= TARGET_MATCHES) break;

            JsonNode entry = entries.get(i);
            String puuid = puuidOf(entry);
            if (puuid == null) continue;

            try {
                String route = ROUTING.get(REGION);
                JsonNode matchIds = riotGet(route,
                        "/lol/match/v5/matches/by-puuid/" + enc(puuid) + "/ids",
                        Map.of("queue", 420, "count", MATCHES_PER_PLAYER));

                for (JsonNode idNode : matchIds) {
                    if (TARGET_MATCHES > 0 && stored >= TARGET_MATCHES) break;
                    String matchId = idNode.asText();

                    int result = ingestMatch(conn, matchId, tier, itemMap);
                    switch (result) {
                        case 1 -> stored++;
                        case 0 -> existing++;
                        case -1 -> skipped++;
                    }
                }
                players++;
            } catch (RiotException e) {
                if (e.status == 404) continue; // jucător nu mai există
                throw e;
            }

            if ((i + 1) % 10 == 0 || i == entries.size() - 1) {
                log("[%s] Progres: %d/%d jucători | Salvate: %d | Existente: %d | Ignorate: %d",
                        tier.toUpperCase(), i + 1, entries.size(), stored, existing, skipped);
            }
        }

        log("[%s] ✅ FINALIZAT: Jucători=%d, Salvate=%d, Existente=%d, Ignorate=%d",
                tier.toUpperCase(), players, stored, existing, skipped);
    }

    static String puuidOf(JsonNode entry) throws Exception {
        if (entry.hasNonNull("puuid")) return entry.path("puuid").asText();
        if (!entry.hasNonNull("summonerId")) return null;
        try {
            JsonNode summoner = riotGet(REGION,
                    "/lol/summoner/v4/summoners/" + enc(entry.path("summonerId").asText()));
            return summoner.path("puuid").asText();
        } catch (RiotException e) {
            if (e.status == 404) return null;
            throw e;
        }
    }

    // =====================================================================
    //  MATCH INGEST — descarcă și salvează un meci
    // =====================================================================
    static final int REMAKE_SECONDS = 300;
    static final Map<Integer, String> SKILL_LETTER = Map.of(1,"Q", 2,"W", 3,"E", 4,"R");
    static final Map<String, String> ROLE_MAP = Map.of(
            "TOP","top", "JUNGLE","jungle", "MIDDLE","mid", "BOTTOM","adc", "UTILITY","support");
    static final Set<Integer> RANKED_QUEUES = Set.of(420, 440);

    /** @return 1=stored, 0=exists, -1=skipped */
    static int ingestMatch(Connection conn, String matchId, String tierBucket,
                           Map<Integer, ItemInfo> itemMap) throws Exception {
        // Deja există?
        try (PreparedStatement ps = conn.prepareStatement("SELECT 1 FROM matches WHERE match_id = ?")) {
            ps.setString(1, matchId);
            if (ps.executeQuery().next()) return 0;
        }

        String route = ROUTING.get(REGION);
        JsonNode m = riotGet(route, "/lol/match/v5/matches/" + enc(matchId));
        JsonNode info = m.path("info");

        int queueId = info.path("queueId").asInt();
        if (!RANKED_QUEUES.contains(queueId)
                || info.path("gameDuration").asInt() < REMAKE_SECONDS
                || info.path("participants").size() != 10) {
            return -1;
        }

        String gameVersion = info.path("gameVersion").asText();
        String patch = patchOf(gameVersion);

        if(patch != PATCH_LATEST) {
            // if patch is not latest, skip match
            return -1;
        }

        long gameCreation = info.path("gameCreation").asLong();
        int gameDuration = info.path("gameDuration").asInt();

        // Timeline (sampled)
        JsonNode timeline = null;
        if (ThreadLocalRandom.current().nextDouble() < TIMELINE_SAMPLE_RATE) {
            try {
                timeline = riotGet(route, "/lol/match/v5/matches/" + enc(matchId) + "/timeline");
            } catch (Exception e) { /* lipsă timeline nu blochează meciul */ }
        }

        int winningTeam = 100;
        for (JsonNode t : info.path("teams")) {
            if (t.path("win").asBoolean()) { winningTeam = t.path("teamId").asInt(); break; }
        }

        // INSERT match
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO matches (match_id, region, queue_id, patch, game_version, game_creation, "
                        + "game_duration, winning_team, tier_bucket) VALUES (?,?,?,?,?,?,?,?,?) "
                        + "ON CONFLICT (match_id) DO NOTHING")) {
            ps.setString(1, matchId);
            ps.setString(2, REGION);
            ps.setInt(3, queueId);
            ps.setString(4, patch);
            ps.setString(5, gameVersion);
            ps.setLong(6, gameCreation);
            ps.setInt(7, gameDuration);
            ps.setInt(8, winningTeam);
            ps.setString(9, tierBucket);
            if (ps.executeUpdate() == 0) { conn.rollback(); return 0; }
        }

        // INSERT participants
        String pSql = "INSERT INTO match_participants ("
                + "match_id, puuid, game_name, tag_line, team_id, champion_id, role, win, "
                + "kills, deaths, assists, cs, gold, damage, vision_score, champ_level, "
                + "items, boots, completed_items, core_items, spell1, spell2, "
                + "primary_style, sub_style, keystone, primary_perks, secondary_perks, stat_shards, "
                + "skill_order, skill_max_order, starting_items, item_order, "
                + "patch, queue_id, region, tier_bucket, game_creation, game_duration) VALUES ("
                + "?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?::int[],?,?::int[],?::int[],?,?,"
                + "?,?,?,?::int[],?::int[],?::int[],?,?,?::int[],?::int[],?,?,?,?,?,?)";

        try (PreparedStatement ps = conn.prepareStatement(pSql)) {
            for (JsonNode p : info.path("participants")) {
                List<Integer> slots = new ArrayList<>();
                for (int i = 0; i < 6; i++) slots.add(p.path("item" + i).asInt());
                List<Integer> allItems = new ArrayList<>(slots);
                allItems.add(p.path("item6").asInt());
                Classified cls = classify(slots, itemMap);
                Runes runes = runesOf(p);
                String puuid = p.path("puuid").asText();
                TimelineInfo ti = timeline == null ? null : parseTimeline(timeline, puuid, itemMap);

                ps.setString(1, matchId);
                ps.setString(2, puuid);
                ps.setString(3, textOrNull(p, "riotIdGameName"));
                ps.setString(4, textOrNull(p, "riotIdTagline"));
                ps.setInt(5, p.path("teamId").asInt());
                ps.setInt(6, p.path("championId").asInt());
                String role = ROLE_MAP.get(p.path("teamPosition").asText());
                if (role != null) ps.setString(7, role); else ps.setNull(7, Types.VARCHAR);
                ps.setBoolean(8, p.path("win").asBoolean());
                ps.setInt(9, p.path("kills").asInt());
                ps.setInt(10, p.path("deaths").asInt());
                ps.setInt(11, p.path("assists").asInt());
                ps.setInt(12, p.path("totalMinionsKilled").asInt() + p.path("neutralMinionsKilled").asInt());
                ps.setInt(13, p.path("goldEarned").asInt());
                ps.setInt(14, p.path("totalDamageDealtToChampions").asInt());
                ps.setInt(15, p.path("visionScore").asInt());
                ps.setInt(16, p.path("champLevel").asInt());
                ps.setString(17, intArray(allItems));
                if (cls.boots != null) ps.setInt(18, cls.boots); else ps.setNull(18, Types.INTEGER);
                ps.setString(19, intArray(cls.completedItems));
                ps.setString(20, intArray(cls.coreItems));
                ps.setInt(21, p.path("summoner1Id").asInt());
                ps.setInt(22, p.path("summoner2Id").asInt());
                if (runes.primaryStyle != null) ps.setInt(23, runes.primaryStyle); else ps.setNull(23, Types.INTEGER);
                if (runes.subStyle != null) ps.setInt(24, runes.subStyle); else ps.setNull(24, Types.INTEGER);
                if (runes.keystone != null) ps.setInt(25, runes.keystone); else ps.setNull(25, Types.INTEGER);
                ps.setString(26, intArray(runes.primaryPerks));
                ps.setString(27, intArray(runes.secondaryPerks));
                ps.setString(28, intArray(runes.statShards));
                ps.setString(29, ti == null ? null : ti.skillOrder);
                ps.setString(30, ti == null ? null : ti.skillMaxOrder);
                ps.setString(31, ti == null ? null : intArray(ti.startingItems));
                ps.setString(32, ti == null ? null : intArray(ti.itemOrder));
                ps.setString(33, patch);
                ps.setInt(34, queueId);
                ps.setString(35, REGION);
                ps.setString(36, tierBucket);
                ps.setLong(37, gameCreation);
                ps.setInt(38, gameDuration);
                ps.addBatch();
            }
            ps.executeBatch();
        }

        // INSERT bans
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO match_bans (match_id, team_id, pick_turn, champion_id) VALUES (?,?,?,?) ON CONFLICT DO NOTHING")) {
            for (JsonNode team : info.path("teams")) {
                for (JsonNode ban : team.path("bans")) {
                    if (ban.path("championId").asInt() <= 0) continue;
                    ps.setString(1, matchId);
                    ps.setInt(2, team.path("teamId").asInt());
                    ps.setInt(3, ban.path("pickTurn").asInt());
                    ps.setInt(4, ban.path("championId").asInt());
                    ps.addBatch();
                }
            }
            ps.executeBatch();
        }

        conn.commit();
        return 1;
    }

    // =====================================================================
    //  TIMELINE PARSING
    // =====================================================================
    record TimelineInfo(String skillOrder, String skillMaxOrder, List<Integer> startingItems, List<Integer> itemOrder) {}

    static TimelineInfo parseTimeline(JsonNode tl, String puuid, Map<Integer, ItemInfo> itemMap) {
        int participantId = -1;
        JsonNode parts = tl.path("metadata").path("participants");
        for (int i = 0; i < parts.size(); i++)
            if (parts.get(i).asText().equals(puuid)) participantId = i + 1;
        if (participantId < 1) return null;

        List<Integer> skills = new ArrayList<>();
        List<Integer> starting = new ArrayList<>();
        List<Integer> purchases = new ArrayList<>();

        for (JsonNode frame : tl.path("info").path("frames")) {
            for (JsonNode e : frame.path("events")) {
                if (e.path("participantId").asInt(-1) != participantId) continue;
                String type = e.path("type").asText();
                if (type.equals("SKILL_LEVEL_UP") && e.path("levelUpType").asText().equals("NORMAL")
                        && e.path("skillSlot").asInt(0) > 0) {
                    skills.add(e.path("skillSlot").asInt());
                } else if (type.equals("ITEM_PURCHASED") && e.path("itemId").asInt(0) > 0) {
                    int itemId = e.path("itemId").asInt();
                    purchases.add(itemId);
                    if (e.path("timestamp").asLong() <= 90_000) starting.add(itemId);
                } else if (type.equals("ITEM_UNDO") && e.path("beforeId").asInt(0) > 0) {
                    Integer undone = e.path("beforeId").asInt();
                    int idx = lastIndexOf(starting, undone);
                    if (idx >= 0) starting.remove(idx);
                    int jdx = lastIndexOf(purchases, undone);
                    if (jdx >= 0) purchases.remove(jdx);
                }
            }
        }
        if (skills.isEmpty()) return null;

        // Skill max order
        Map<Integer, Integer> counts = new HashMap<>(Map.of(1,0, 2,0, 3,0));
        Set<String> maxed = new LinkedHashSet<>();
        for (int s : skills) {
            if (counts.containsKey(s)) {
                counts.merge(s, 1, Integer::sum);
                if (counts.get(s) == 5) maxed.add(SKILL_LETTER.get(s));
            }
        }
        for (int s : new int[]{1,2,3}) maxed.add(SKILL_LETTER.get(s));

        StringBuilder order = new StringBuilder();
        for (int i = 0; i < Math.min(15, skills.size()); i++) order.append(SKILL_LETTER.get(skills.get(i)));

        // Item order: completed non-boots items in purchase order
        List<Integer> itemOrder = completedInOrder(purchases, itemMap);

        return new TimelineInfo(order.toString(), String.join(">", maxed),
                starting.stream().sorted().toList(), itemOrder);
    }

    static int lastIndexOf(List<Integer> list, int val) {
        for (int i = list.size() - 1; i >= 0; i--) if (list.get(i) == val) return i;
        return -1;
    }

    // =====================================================================
    //  ITEM CLASSIFICATION
    // =====================================================================
    record ItemInfo(boolean boots, boolean completed, int cost) {}
    record Classified(Integer boots, List<Integer> completedItems, List<Integer> coreItems) {}

    static Map<Integer, ItemInfo> loadItems(Connection conn) throws Exception {
        Map<Integer, ItemInfo> map = new HashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT a.data FROM static_assets a JOIN patches p USING (version) "
                        + "WHERE a.kind = 'items' ORDER BY p.synced_at DESC LIMIT 1")) {
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                JsonNode data = OM.readTree(rs.getString(1)).path("data");
                var it = data.fields();
                while (it.hasNext()) {
                    var e = it.next();
                    JsonNode item = e.getValue();
                    List<String> tags = new ArrayList<>();
                    item.path("tags").forEach(t -> tags.add(t.asText()));
                    int cost = item.path("gold").path("total").asInt(0);
                    boolean purchasable = item.path("gold").path("purchasable").asBoolean(true);
                    boolean completed = !tags.contains("Consumable") && !tags.contains("Trinket")
                            && purchasable && item.path("into").size() == 0 && cost >= 1000;
                    map.put(Integer.parseInt(e.getKey()), new ItemInfo(tags.contains("Boots"), completed, cost));
                }
            }
            conn.commit();
        }
        return map;
    }

    static Classified classify(List<Integer> slots, Map<Integer, ItemInfo> map) {
        List<Integer> owned = slots.stream().filter(id -> id > 0).toList();
        if (map == null || map.isEmpty()) {
            return new Classified(null, new ArrayList<>(owned), coreOf(new ArrayList<>(owned)));
        }
        Integer boots = null;
        record Done(int id, int cost) {}
        List<Done> completed = new ArrayList<>();
        for (int id : owned) {
            ItemInfo info = map.get(id);
            if (info == null) continue;
            if (info.boots) {
                if (boots == null || info.cost > (map.containsKey(boots) ? map.get(boots).cost : 0)) boots = id;
            } else if (info.completed) {
                completed.add(new Done(id, info.cost));
            }
        }
        completed.sort(Comparator.comparingInt(Done::cost).reversed().thenComparingInt(Done::id));
        List<Integer> completedItems = completed.stream().map(Done::id).toList();
        return new Classified(boots, completedItems, coreOf(completedItems));
    }

    static List<Integer> coreOf(List<Integer> items) {
        if (items.size() < 3) return null;
        return items.subList(0, 3).stream().sorted().toList();
    }

    static List<Integer> completedInOrder(List<Integer> purchases, Map<Integer, ItemInfo> map) {
        if (purchases == null || map == null) return null;
        List<Integer> out = new ArrayList<>();
        for (int id : purchases) {
            ItemInfo info = map.get(id);
            if (info != null && info.completed && !info.boots && !out.contains(id)) out.add(id);
        }
        return out;
    }

    // =====================================================================
    //  RUNES PARSING
    // =====================================================================
    record Runes(Integer primaryStyle, Integer subStyle, Integer keystone,
                 List<Integer> primaryPerks, List<Integer> secondaryPerks, List<Integer> statShards) {}

    static Runes runesOf(JsonNode p) {
        JsonNode primary = null, sub = null;
        for (JsonNode s : p.path("perks").path("styles")) {
            if (s.path("description").asText().equals("primaryStyle")) primary = s;
            if (s.path("description").asText().equals("subStyle")) sub = s;
        }
        List<Integer> pp = new ArrayList<>(), sp = new ArrayList<>();
        if (primary != null) primary.path("selections").forEach(s -> pp.add(s.path("perk").asInt()));
        if (sub != null) sub.path("selections").forEach(s -> sp.add(s.path("perk").asInt()));
        JsonNode statPerks = p.path("perks").path("statPerks");
        return new Runes(
                primary == null ? null : primary.path("style").asInt(),
                sub == null ? null : sub.path("style").asInt(),
                pp.isEmpty() ? null : pp.get(0), pp, sp,
                List.of(statPerks.path("offense").asInt(), statPerks.path("flex").asInt(), statPerks.path("defense").asInt()));
    }

    // =====================================================================
    //  RIOT API CLIENT (cu rate limiting + retries)
    // =====================================================================
    static final ObjectMapper OM = new ObjectMapper();
    static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    static final Map<String, SlidingLimiter> LIMITERS = new HashMap<>();

    static final Map<String, String> ROUTING = Map.ofEntries(
            Map.entry("na1","americas"), Map.entry("br1","americas"), Map.entry("la1","americas"), Map.entry("la2","americas"),
            Map.entry("kr","asia"), Map.entry("jp1","asia"),
            Map.entry("eun1","europe"), Map.entry("euw1","europe"), Map.entry("me1","europe"),
            Map.entry("tr1","europe"), Map.entry("ru","europe"),
            Map.entry("oc1","sea"), Map.entry("ph2","sea"), Map.entry("sg2","sea"),
            Map.entry("th2","sea"), Map.entry("tw2","sea"), Map.entry("vn2","sea"));

    static JsonNode riotGet(String host, String path) throws Exception {
        return riotGet(host, path, Map.of());
    }

    static JsonNode riotGet(String host, String path, Map<String, Object> query) throws Exception {
        if (RIOT_API_KEY.isEmpty()) throw new RuntimeException("RIOT_API_KEY nu este setat!");

        SlidingLimiter limiter = LIMITERS.computeIfAbsent(host, h -> new SlidingLimiter(RATE_LIMITS));

        String qs = query.entrySet().stream()
                .filter(e -> e.getValue() != null)
                .map(e -> e.getKey() + "=" + enc(String.valueOf(e.getValue())))
                .collect(Collectors.joining("&"));
        String url = "https://" + host + ".api.riotgames.com" + path + (qs.isEmpty() ? "" : "?" + qs);

        for (int attempt = 0; ; attempt++) {
            limiter.acquire();

            HttpResponse<String> res;
            try {
                res = HTTP.send(HttpRequest.newBuilder(URI.create(url))
                        .header("X-Riot-Token", RIOT_API_KEY)
                        .timeout(Duration.ofSeconds(30)).GET().build(),
                        HttpResponse.BodyHandlers.ofString());
            } catch (IOException e) {
                if (attempt < 3) { Thread.sleep(500L * (1L << attempt)); continue; }
                throw new RuntimeException("Riot API unreachable: " + e.getMessage(), e);
            }

            int status = res.statusCode();
            if (status / 100 == 2) return OM.readTree(res.body());
            if (status == 404) throw new RiotException(404, "Not found: " + path);
            if (status == 429 && attempt < 4) {
                long retryAfter = Long.parseLong(res.headers().firstValue("retry-after").orElse("1"));
                limiter.blockFor(retryAfter * 1000 + 250);
                continue;
            }
            if (status >= 500 && attempt < 3) { Thread.sleep(500L * (1L << attempt)); continue; }
            if (status == 401 || status == 403) throw new RiotException(status, "API key invalid/expired!");
            throw new RiotException(status, "Riot returned " + status + " for " + path);
        }
    }

    static class RiotException extends RuntimeException {
        final int status;
        RiotException(int status, String msg) { super(msg); this.status = status; }
    }

    // =====================================================================
    //  SLIDING WINDOW RATE LIMITER
    // =====================================================================
    static class SlidingLimiter {
        final int[][] limits;
        final Deque<Long> stamps = new ArrayDeque<>();
        final AtomicLong blockedUntil = new AtomicLong();

        SlidingLimiter(int[][] limits) { this.limits = limits; }

        void blockFor(long ms) {
            blockedUntil.accumulateAndGet(System.currentTimeMillis() + ms, Math::max);
        }

        synchronized void acquire() throws InterruptedException {
            long longest = 0;
            for (int[] l : limits) longest = Math.max(longest, l[1]);
            for (;;) {
                long now = System.currentTimeMillis();
                while (!stamps.isEmpty() && now - stamps.peekFirst() >= longest) stamps.pollFirst();
                long waitMs = Math.max(0, blockedUntil.get() - now);
                for (int[] l : limits) {
                    int max = l[0]; long window = l[1];
                    List<Long> inWindow = stamps.stream().filter(t -> now - t < window).toList();
                    if (inWindow.size() >= max) {
                        long oldest = inWindow.get(inWindow.size() - max);
                        waitMs = Math.max(waitMs, window - (now - oldest));
                    }
                }
                if (waitMs <= 0) { stamps.addLast(now); return; }
                Thread.sleep(waitMs + 5);
            }
        }
    }

    // =====================================================================
    //  HELPERS
    // =====================================================================
    static String patchOf(String gameVersion) {
        String[] p = gameVersion.split("\\.");
        return p[0] + "." + p[1];
    }

    static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20");
    }

    static String textOrNull(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    static String intArray(List<Integer> v) {
        if (v == null) return null;
        return v.stream().map(String::valueOf).collect(Collectors.joining(",", "{", "}"));
    }

    static String env(String key, String def) {
        String v = System.getenv(key);
        return v != null && !v.isEmpty() ? v : def;
    }

    static void log(String fmt, Object... args) {
        System.out.printf("[%s] %s%n", Instant.now().toString().substring(11, 19), String.format(fmt, args));
    }

    // Încarcă .env din directorul curent (format KEY=VALUE)
    static void loadDotEnv() {
        File f = new File(".env");
        if (!f.exists()) f = new File("lol-stats-backend-java/.env");
        if (!f.exists()) return;
        try (BufferedReader br = new BufferedReader(new FileReader(f))) {
            String line;
            while ((line = br.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;
                int eq = line.indexOf('=');
                if (eq < 0) continue;
                String key = line.substring(0, eq).trim();
                String val = line.substring(eq + 1).trim();
                // Actualizează variabilele noastre statice
                switch (key) {
                    case "DB_URL" -> DB_URL = val;
                    case "DB_USER" -> DB_USER = val;
                    case "DB_PASSWORD" -> DB_PASSWORD = val;
                    case "RIOT_API_KEY" -> RIOT_API_KEY = val;
                    case "CRAWL_REGION" -> REGION = val;
                    case "CRAWL_TARGET" -> TARGET_MATCHES = Integer.parseInt(val);
                    case "CRAWL_PAGES" -> PAGES_PER_TIER = Integer.parseInt(val);
                    case "TIMELINE_SAMPLE_RATE" -> TIMELINE_SAMPLE_RATE = Double.parseDouble(val);
                }
            }
            log("📂 Încărcat .env din %s", f.getAbsolutePath());
        } catch (Exception e) {
            System.err.println("⚠ Nu am putut citi .env: " + e.getMessage());
        }
    }
}
