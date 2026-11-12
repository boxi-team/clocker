package com.lolstats.live;

import static com.lolstats.common.Api.obj;

import com.fasterxml.jackson.databind.JsonNode;
import com.lolstats.common.Domain;
import com.lolstats.live.LiveNames.Names;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Pure mapping helpers from Riot spectator data to the live game response. No I/O, easy to test. */
final class LiveMapper {
    private LiveMapper() {}

    /** Rank of one player in the queue of the game. {@code tierIndex} is -1 when unranked. */
    record Rank(int tierIndex, String tier, int lp, int wins, int losses) {
        static final Rank UNRANKED = new Rank(-1, "Unranked", 0, 0, 0);

        int games() { return wins + losses; }

        Double winRate() {
            return games() == 0 ? null : Math.round(wins * 1000.0 / games()) / 10.0;
        }
    }

    record AvgTier(String tier, int avgLp) {}

    private static final Map<Integer, String> SHARDS = Map.of(
            5001, "Scaling Health", 5002, "Armor", 5003, "Magic Resist", 5005, "Attack Speed", 5007, "Ability Haste",
            5008, "Adaptive Force", 5010, "Move Speed", 5011, "Health", 5013, "Tenacity");

    private static final Map<Integer, String> MODES = Map.of(
            420, "Ranked Solo", 440, "Ranked Flex", 400, "Normal Draft", 430, "Normal Blind", 450, "ARAM",
            480, "Swiftplay", 490, "Quickplay", 700, "Clash", 1700, "Arena");

    static String modeName(int queueId, String gameMode) {
        String m = MODES.get(queueId);
        if (m != null) return m;
        if (gameMode == null || gameMode.isEmpty()) return "Custom";
        return Character.toUpperCase(gameMode.charAt(0)) + gameMode.substring(1).toLowerCase(Locale.ROOT);
    }

    /** "Name#TAG" -> ["Name", "TAG"]. A missing tag gives "". */
    static String[] parseRiotId(String riotId) {
        if (riotId == null || riotId.isEmpty()) return new String[]{"", ""};
        int i = riotId.lastIndexOf('#');
        return i < 0 ? new String[]{riotId, ""} : new String[]{riotId.substring(0, i), riotId.substring(i + 1)};
    }

    /** "CHALLENGER" -> "Challenger" */
    static String cap(String s) {
        return s == null || s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1).toLowerCase(Locale.ROOT);
    }

    /** Reads the player's entry for the queue out of Riot league entries (flex games use flex, all others solo). */
    static Rank rankFromEntries(JsonNode entries, int queueId) {
        String wanted = (queueId == 440 ? Domain.queue("ranked_flex") : Domain.queue("ranked_solo")).riot();
        for (JsonNode e : entries) {
            if (!wanted.equals(e.path("queueType").asText())) continue;
            String tier = e.path("tier").asText("");
            int idx = Domain.TIER_BUCKETS.indexOf(tier.toLowerCase(Locale.ROOT));
            if (idx < 0) return Rank.UNRANKED;
            return new Rank(idx, cap(tier), e.path("leaguePoints").asInt(), e.path("wins").asInt(), e.path("losses").asInt());
        }
        return Rank.UNRANKED;
    }

    /** Average tier (rounded) and average LP of the ranked players. Approximation shown as the game's tier. */
    static AvgTier avgTier(List<Rank> ranks) {
        List<Rank> ranked = ranks.stream().filter(r -> r.tierIndex() >= 0).toList();
        if (ranked.isEmpty()) return new AvgTier(null, 0);
        double tierMean = ranked.stream().mapToInt(Rank::tierIndex).average().orElse(0);
        double lpMean = ranked.stream().mapToInt(Rank::lp).average().orElse(0);
        String name = Domain.TIER_BUCKETS.get((int) Math.round(tierMean));
        return new AvgTier(cap(name), (int) Math.round(lpMean));
    }

    /**
     * Rune page from spectator perks. A full page has 9 ids: keystone, 3 primary runes, 2 secondary runes,
     * 3 stat shards. Riot currently sends only the keystone (plus the two style ids), so the lists are filled with
     * whatever ids exist and stay empty otherwise. Null when there is no keystone at all.
     */
    static Map<String, Object> runePage(JsonNode perks, Names n) {
        JsonNode ids = perks.path("perkIds");
        if (ids.size() < 1) return null;
        List<String> primary = new ArrayList<>();
        for (int i = 1; i <= 3 && i < ids.size(); i++) primary.add(n.rune(ids.get(i).asInt()));
        List<String> secondary = new ArrayList<>();
        for (int i = 4; i <= 5 && i < ids.size(); i++) secondary.add(n.rune(ids.get(i).asInt()));
        List<String> shards = new ArrayList<>();
        for (int i = 6; i <= 8 && i < ids.size(); i++) shards.add(SHARDS.getOrDefault(ids.get(i).asInt(), String.valueOf(ids.get(i).asInt())));
        return obj(
                "primaryStyle", n.style(perks.path("perkStyle").asInt()),
                "keystone", n.rune(ids.get(0).asInt()),
                "primaryRunes", primary,
                "secondaryStyle", n.style(perks.path("perkSubStyle").asInt()),
                "secondaryRunes", secondary,
                "shards", shards);
    }

    // ---------- roles ----------
    // The spectator API does not say who plays which role. Smite means jungle; the rest is a best guess
    // from champion classes (a champion is usually played in one role), choosing the best overall assignment.

    private static int score(String role, List<String> tags) {
        int s = 0;
        for (String t : tags) {
            s += switch (role) {
                case "top" -> t.equals("Fighter") || t.equals("Tank") ? 2 : 0;
                case "jungle" -> t.equals("Assassin") || t.equals("Fighter") || t.equals("Tank") ? 1 : 0;
                case "mid" -> t.equals("Mage") ? 3 : t.equals("Assassin") ? 2 : 0;
                case "adc" -> t.equals("Marksman") ? 4 : 0;
                case "support" -> t.equals("Support") ? 4 : t.equals("Tank") || t.equals("Mage") ? 1 : 0;
                default -> 0;
            };
        }
        return s;
    }

    /**
     * One role per team member (same order as the input), or all nulls when the team does not have 5 members.
     * {@code smite} marks members who took Smite.
     */
    static List<String> assignRoles(List<List<String>> tags, List<Boolean> smite) {
        int n = tags.size();
        List<String> out = new ArrayList<>();
        for (int i = 0; i < n; i++) out.add(null);
        if (n != 5) return out;

        List<String> roles = new ArrayList<>(Domain.ROLES);
        List<Integer> free = new ArrayList<>();
        int jungler = smite.indexOf(true);
        for (int i = 0; i < n; i++) {
            if (i == jungler) out.set(i, "jungle");
            else free.add(i);
        }
        if (jungler >= 0) roles.remove("jungle");

        int[] best = new int[free.size()];
        int[] cur = new int[free.size()];
        search(0, new boolean[roles.size()], cur, best, new int[]{-1}, free, roles, tags);
        for (int k = 0; k < free.size(); k++) out.set(free.get(k), roles.get(best[k]));
        return out;
    }

    private static void search(int k, boolean[] used, int[] cur, int[] best, int[] bestScore, List<Integer> free,
                               List<String> roles, List<List<String>> tags) {
        if (k == free.size()) {
            int total = 0;
            for (int i = 0; i < k; i++) total += score(roles.get(cur[i]), tags.get(free.get(i)));
            if (total > bestScore[0]) {
                bestScore[0] = total;
                System.arraycopy(cur, 0, best, 0, k);
            }
            return;
        }
        for (int r = 0; r < roles.size(); r++) {
            if (used[r]) continue;
            used[r] = true;
            cur[k] = r;
            search(k + 1, used, cur, best, bestScore, free, roles, tags);
            used[r] = false;
        }
    }

    static boolean hasSmite(JsonNode participant) {
        return participant.path("spell1Id").asInt() == 11 || participant.path("spell2Id").asInt() == 11;
    }

    /** Bans of one team (100 or 200) as champion names, in pick order. */
    static List<String> bans(JsonNode game, int teamId, Names n) {
        List<String> out = new ArrayList<>();
        for (JsonNode b : game.path("bannedChampions")) {
            if (b.path("teamId").asInt() == teamId && b.path("championId").asInt() > 0) out.add(n.champion(b.path("championId").asInt()));
        }
        return out;
    }

    static int gameSeconds(JsonNode game, long nowMillis) {
        int len = game.path("gameLength").asInt();
        long start = game.path("gameStartTime").asLong();
        if (len <= 0 && start > 0) len = (int) Math.max(0, (nowMillis - start) / 1000);
        return len;
    }

    static String phase(JsonNode game) {
        return game.path("gameStartTime").asLong() > 0 ? "in_game" : "loading";
    }

}
