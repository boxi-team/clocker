package com.lolstats.ingest;

import com.fasterxml.jackson.databind.JsonNode;
import com.lolstats.common.Db;
import com.lolstats.common.Domain;
import com.lolstats.config.AppProps;
import com.lolstats.ingest.ItemService.Classified;
import com.lolstats.riot.RiotClient;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/** Downloads matches from Riot and stores them. */
@Service
public class MatchIngestService {
    private static final int REMAKE_SECONDS = 300;
    private static final Map<Integer, String> SKILL_LETTER = Map.of(1, "Q", 2, "W", 3, "E", 4, "R");

    /** Skill data for one participant from a match timeline. */
    public record TimelineInfo(String skillOrder, String skillMaxOrder, List<Integer> startingItems) {}

    private final Db db;
    private final RiotClient riot;
    private final ItemService items;
    private final AppProps props;
    private final TransactionTemplate tx;

    public MatchIngestService(Db db, RiotClient riot, ItemService items, AppProps props, TransactionTemplate tx) {
        this.db = db;
        this.riot = riot;
        this.items = items;
        this.props = props;
        this.tx = tx;
    }

    public static String patchOf(String gameVersion) {
        String[] p = gameVersion.split("\\.");
        return p[0] + "." + p[1];
    }

    /** Skill order, max order and starting items for one participant; null if no skill-ups were recorded. */
    public static TimelineInfo parseTimeline(JsonNode tl, String puuid) {
        int participantId = -1;
        JsonNode parts = tl.path("metadata").path("participants");
        for (int i = 0; i < parts.size(); i++) if (parts.get(i).asText().equals(puuid)) participantId = i + 1;
        if (participantId < 1) return null;

        List<Integer> skills = new ArrayList<>();
        List<Integer> starting = new ArrayList<>();
        for (JsonNode frame : tl.path("info").path("frames")) {
            for (JsonNode e : frame.path("events")) {
                if (e.path("participantId").asInt(-1) != participantId) continue;
                String type = e.path("type").asText();
                if (type.equals("SKILL_LEVEL_UP") && e.path("levelUpType").asText().equals("NORMAL")
                        && e.path("skillSlot").asInt(0) > 0) {
                    skills.add(e.path("skillSlot").asInt());
                } else if (type.equals("ITEM_PURCHASED") && e.path("itemId").asInt(0) > 0
                        && e.path("timestamp").asLong() <= 90_000) {
                    starting.add(e.path("itemId").asInt());
                } else if (type.equals("ITEM_UNDO") && e.path("beforeId").asInt(0) > 0) {
                    int i = starting.lastIndexOf(e.path("beforeId").asInt());
                    if (i >= 0) starting.remove(i);
                }
            }
        }
        if (skills.isEmpty()) return null;

        // Order in which Q, W, E reach their 5th point.
        Map<Integer, Integer> counts = new HashMap<>(Map.of(1, 0, 2, 0, 3, 0));
        Set<String> maxed = new LinkedHashSet<>();
        for (int s : skills) {
            if (counts.containsKey(s)) {
                counts.merge(s, 1, Integer::sum);
                if (counts.get(s) == 5) maxed.add(SKILL_LETTER.get(s));
            }
        }
        for (int s : new int[]{1, 2, 3}) maxed.add(SKILL_LETTER.get(s)); // incomplete: append by slot
        StringBuilder order = new StringBuilder();
        for (int i = 0; i < Math.min(15, skills.size()); i++) order.append(SKILL_LETTER.get(skills.get(i)));
        return new TimelineInfo(order.toString(), String.join(">", maxed), starting.stream().sorted().toList());
    }

    private record Runes(Integer primaryStyle, Integer subStyle, Integer keystone, List<Integer> primaryPerks,
                         List<Integer> secondaryPerks, List<Integer> statShards) {}

    private static Runes runesOf(JsonNode p) {
        JsonNode primary = null;
        JsonNode sub = null;
        for (JsonNode s : p.path("perks").path("styles")) {
            if (s.path("description").asText().equals("primaryStyle")) primary = s;
            if (s.path("description").asText().equals("subStyle")) sub = s;
        }
        List<Integer> primaryPerks = new ArrayList<>();
        if (primary != null) primary.path("selections").forEach(s -> primaryPerks.add(s.path("perk").asInt()));
        List<Integer> secondaryPerks = new ArrayList<>();
        if (sub != null) sub.path("selections").forEach(s -> secondaryPerks.add(s.path("perk").asInt()));
        JsonNode sp = p.path("perks").path("statPerks");
        return new Runes(
                primary == null ? null : primary.path("style").asInt(),
                sub == null ? null : sub.path("style").asInt(),
                primaryPerks.isEmpty() ? null : primaryPerks.get(0),
                primaryPerks, secondaryPerks,
                List.of(sp.path("offense").asInt(), sp.path("flex").asInt(), sp.path("defense").asInt()));
    }

    public Outcome ingestMatch(String region, String matchId, String tierBucket) {
        return ingestMatch(region, matchId, tierBucket, false);
    }

    /**
     * Downloads one match (and, for a sample, its timeline) and stores it.
     * Only ranked Solo/Duo and Flex matches that are not remakes are stored.
     */
    public Outcome ingestMatch(String region, String matchId, String tierBucket, boolean forceTimeline) {
        if (db.exists("SELECT 1 FROM matches WHERE match_id = ?", matchId)) return Outcome.EXISTS;

        JsonNode m = riot.match(region, matchId);
        JsonNode info = m.path("info");
        int queueId = info.path("queueId").asInt();
        if (Domain.queueFromId(queueId) == null || info.path("gameDuration").asInt() < REMAKE_SECONDS
                || info.path("participants").size() != 10) {
            return Outcome.SKIPPED;
        }

        String gameVersion = info.path("gameVersion").asText();
        String patch = patchOf(gameVersion);
        Map<Integer, ItemService.ItemInfo> itemMap = items.itemsForPatch(patch);

        JsonNode timeline = null;
        if (forceTimeline || ThreadLocalRandom.current().nextDouble() < props.timelineSampleRate()) {
            try {
                timeline = riot.timeline(region, matchId);
            } catch (RuntimeException e) {
                timeline = null; // a missing timeline must not block the match
            }
        }

        int winningTeam = 100;
        for (JsonNode t : info.path("teams")) {
            if (t.path("win").asBoolean()) {
                winningTeam = t.path("teamId").asInt();
                break;
            }
        }
        final int winTeam = winningTeam;
        final JsonNode tl = timeline;
        long gameCreation = info.path("gameCreation").asLong();
        int gameDuration = info.path("gameDuration").asInt();

        return tx.execute(status -> {
            int ins = db.update("INSERT INTO matches (match_id, region, queue_id, patch, game_version, game_creation, "
                            + "game_duration, winning_team, tier_bucket) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT (match_id) DO NOTHING",
                    matchId, region, queueId, patch, gameVersion, gameCreation, gameDuration, winTeam, tierBucket);
            if (ins == 0) { // another worker stored it first
                status.setRollbackOnly();
                return Outcome.EXISTS;
            }

            for (JsonNode p : info.path("participants")) {
                List<Integer> slots = new ArrayList<>();
                for (int i = 0; i < 6; i++) slots.add(p.path("item" + i).asInt());
                List<Integer> allItems = new ArrayList<>(slots);
                allItems.add(p.path("item6").asInt());
                Classified cls = ItemService.classify(slots, itemMap);
                Runes runes = runesOf(p);
                String puuid = p.path("puuid").asText();
                TimelineInfo ti = tl == null ? null : parseTimeline(tl, puuid);

                db.update("INSERT INTO match_participants ("
                                + "match_id, puuid, game_name, tag_line, team_id, champion_id, role, win, "
                                + "kills, deaths, assists, cs, gold, damage, vision_score, champ_level, "
                                + "items, boots, completed_items, core_items, spell1, spell2, "
                                + "primary_style, sub_style, keystone, primary_perks, secondary_perks, stat_shards, "
                                + "skill_order, skill_max_order, starting_items, "
                                + "patch, queue_id, region, tier_bucket, game_creation, game_duration) VALUES ("
                                + "?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?::int[],?,?::int[],?::int[],?,?,"
                                + "?,?,?,?::int[],?::int[],?::int[],?,?,?::int[],?,?,?,?,?,?)",
                        matchId, puuid, textOrNull(p, "riotIdGameName"), textOrNull(p, "riotIdTagline"),
                        p.path("teamId").asInt(), p.path("championId").asInt(),
                        Domain.ROLE_FROM_RIOT.get(p.path("teamPosition").asText()), p.path("win").asBoolean(),
                        p.path("kills").asInt(), p.path("deaths").asInt(), p.path("assists").asInt(),
                        p.path("totalMinionsKilled").asInt() + p.path("neutralMinionsKilled").asInt(),
                        p.path("goldEarned").asInt(), p.path("totalDamageDealtToChampions").asInt(),
                        p.path("visionScore").asInt(), p.path("champLevel").asInt(),
                        Db.intArray(allItems), cls.boots(), Db.intArray(cls.completedItems()), Db.intArray(cls.coreItems()),
                        p.path("summoner1Id").asInt(), p.path("summoner2Id").asInt(),
                        runes.primaryStyle(), runes.subStyle(), runes.keystone(),
                        Db.intArray(runes.primaryPerks()), Db.intArray(runes.secondaryPerks()), Db.intArray(runes.statShards()),
                        ti == null ? null : ti.skillOrder(), ti == null ? null : ti.skillMaxOrder(),
                        ti == null ? null : Db.intArray(ti.startingItems()),
                        patch, queueId, region, tierBucket, gameCreation, gameDuration);
            }

            for (JsonNode team : info.path("teams")) {
                for (JsonNode ban : team.path("bans")) {
                    if (ban.path("championId").asInt() <= 0) continue;
                    db.update("INSERT INTO match_bans (match_id, team_id, pick_turn, champion_id) VALUES (?,?,?,?) "
                                    + "ON CONFLICT DO NOTHING",
                            matchId, team.path("teamId").asInt(), ban.path("pickTurn").asInt(), ban.path("championId").asInt());
                }
            }
            return Outcome.STORED;
        });
    }

    private static String textOrNull(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }
}
