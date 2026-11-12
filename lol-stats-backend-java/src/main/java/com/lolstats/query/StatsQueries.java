package com.lolstats.query;

import static com.lolstats.common.Api.obj;
import static com.lolstats.common.Api.ratio;
import static com.lolstats.query.StatLines.STAT_COLS;
import static com.lolstats.query.StatLines.statLine;
import static com.lolstats.query.StatLines.wilsonScore;

import com.lolstats.common.Db;
import com.lolstats.config.AppProps;
import com.lolstats.query.Filter.P;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.springframework.stereotype.Service;

/** Champion and tier-list analytics over match_participants. */
@Service
public class StatsQueries {
    private final Db db;
    private final AppProps props;

    private static final int MIN_OPTION_GAMES = 50;
    private static final double MIN_OPTION_SHARE = 0.05;
    private static final int MAX_ALTERNATIVES = 2;

    public StatsQueries(Db db, AppProps props) {
        this.db = db;
        this.props = props;
    }

    public int totalMatches(Filter f) {
        P p = new P();
        return Db.i(db.one("SELECT count(*)::int AS n FROM matches m WHERE " + String.join(" AND ", f.conditions(p, "m")),
                p.args()), "n");
    }

    private Map<String, Integer> slotsByRole(Filter f) {
        P p = new P();
        Map<String, Integer> out = new HashMap<>();
        for (Map<String, Object> r : db.rows(
                "SELECT p.role, count(*)::int AS n FROM match_participants p WHERE "
                        + String.join(" AND ", f.conditions(p, "p")) + " AND p.role IS NOT NULL GROUP BY p.role", p.args())) {
            out.put(Db.s(r, "role"), Db.i(r, "n"));
        }
        return out;
    }

    // ---------- champion stats ----------
    public Map<String, Object> championStats(Filter f, int championKey) {
        int total = totalMatches(f);

        P pc = new P();
        List<String> base = f.conditions(pc, "p");
        base.add("p.champion_id = " + pc.add(championKey));
        if (f.role() != null) base.add("p.role = " + pc.add(f.role()));
        Map<String, Object> o = db.one("SELECT " + STAT_COLS + " FROM match_participants p WHERE " + String.join(" AND ", base),
                pc.args());

        P pb = new P();
        int bans = Db.i(db.one("SELECT count(DISTINCT b.match_id)::int AS n FROM match_bans b "
                + "JOIN matches m ON m.match_id = b.match_id WHERE b.champion_id = " + pb.add(championKey)
                + " AND " + String.join(" AND ", f.conditions(pb, "m")), pb.args()), "n");

        P pr = new P();
        List<String> byRoleWhere = f.conditions(pr, "p");
        byRoleWhere.add("p.champion_id = " + pr.add(championKey));
        byRoleWhere.add("p.role IS NOT NULL");
        if (f.role() != null) byRoleWhere.add("p.role = " + pr.add(f.role()));
        List<Map<String, Object>> byRole = db.rows("SELECT p.role, " + STAT_COLS + " FROM match_participants p WHERE "
                + String.join(" AND ", byRoleWhere) + " GROUP BY p.role ORDER BY games DESC", pr.args());

        Map<String, Integer> slots = slotsByRole(f);
        int oGames = Db.i(o, "games");

        Map<String, Object> overall = statLine(o);
        overall.put("pickRate", ratio(oGames, total));
        overall.put("banRate", ratio(bans, total));
        overall.put("lowSample", oGames < props.lowSampleGames());

        List<Object> roles = new ArrayList<>();
        for (Map<String, Object> r : byRole) {
            Map<String, Object> line = obj("role", Db.s(r, "role"));
            line.putAll(statLine(r));
            line.put("pickRate", ratio(Db.i(r, "games"), slots.getOrDefault(Db.s(r, "role"), 0)));
            line.put("roleRate", ratio(Db.i(r, "games"), oGames));
            line.put("lowSample", Db.i(r, "games") < props.lowSampleGames());
            roles.add(line);
        }
        return obj("totalMatches", total, "overall", overall, "byRole", roles);
    }

    // ---------- builds ----------
    private String resolveRole(Filter f, int championKey) {
        if (f.role() != null) return f.role();
        P p = new P();
        Map<String, Object> r = db.one("SELECT p.role FROM match_participants p WHERE "
                + String.join(" AND ", f.conditions(p, "p")) + " AND p.champion_id = " + p.add(championKey)
                + " AND p.role IS NOT NULL GROUP BY p.role ORDER BY count(*) DESC LIMIT 1", p.args());
        return r == null ? null : Db.s(r, "role");
    }

    /** Base WHERE (filters, champion, role, optional lane opponent) for one builds sub-query. */
    private static String buildBase(Filter f, int championKey, String role, Integer opponentKey, P p) {
        List<String> parts = f.conditions(p, "p");
        parts.add("p.champion_id = " + p.add(championKey));
        parts.add("p.role = " + p.add(role));
        // Optional: only games where the lane opponent (same role, other team) played this champion.
        if (opponentKey != null) {
            parts.add("EXISTS (SELECT 1 FROM match_participants o WHERE o.match_id = p.match_id AND o.role = p.role "
                    + "AND o.team_id <> p.team_id AND o.champion_id = " + p.add(opponentKey) + ")");
        }
        return String.join(" AND ", parts);
    }

    private static String top(int n) {
        return "ORDER BY games DESC LIMIT " + n;
    }

    private List<Map<String, Object>> q(Filter f, int champ, String role, Integer opp, Function<String, String> sql) {
        P p = new P();
        String where = buildBase(f, champ, role, opp, p);
        return db.rows(sql.apply(where), p.args());
    }

    private Map<String, Object> withRate(Map<String, Object> r, int games) {
        return obj("games", Db.i(r, "games"), "winRate", ratio(Db.i(r, "wins"), Db.i(r, "games")),
                "pickRate", ratio(Db.i(r, "games"), games));
    }

    private static Map<String, Object> pick(List<Map<String, Object>> options, int minGames) {
        if (options.isEmpty()) {
            return obj("recommended", null, "alternatives", List.of());
        }
        List<Map<String, Object>> alternatives = new ArrayList<>();
        for (int i = 1; i < options.size() && alternatives.size() < MAX_ALTERNATIVES; i++) {
            Map<String, Object> option = options.get(i);
            if (Db.i(option, "games") >= minGames) {
                alternatives.add(option);
            }
        }
        return obj("recommended", options.get(0), "alternatives", alternatives);
    }

    /** One item column (starting / core / fourth...): sample size plus recommended and alternatives. */
    private static Map<String, Object> slotOut(String slot, int sample, List<Map<String, Object>> options) {
        Map<String, Object> out = obj("slot", slot, "sampleSize", sample);
        out.putAll(pick(options, (int) Math.ceil(sample * MIN_OPTION_SHARE)));
        return out;
    }

    /** Options for completed items number from..to in purchase order (core = 1..3, fourth = 4..4...). */
    private Map<String, Object> itemSlot(Filter f, int champ, String role, Integer opp, String slot, int from, int to) {
        String hasSlot = " AND cardinality(p.item_order) >= " + to;
        int sample = Db.i(q(f, champ, role, opp, w -> "SELECT count(*)::int AS n FROM match_participants p WHERE "
                + w + hasSlot).get(0), "n");
        var rows = q(f, champ, role, opp, w -> "SELECT p.item_order[" + from + ":" + to + "] AS item_ids, "
                + "count(*)::int AS games, sum(p.win::int)::int AS wins FROM match_participants p WHERE " + w + hasSlot
                + " GROUP BY 1 " + top(5));
        List<Map<String, Object>> options = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> m = obj("itemIds", r.get("item_ids"));
            m.putAll(withRate(r, sample));
            options.add(m);
        }
        return slotOut(slot, sample, options);
    }

    public Map<String, Object> championBuilds(Filter f, int championKey, Integer opponentKey) {
        String role = resolveRole(f, championKey);
        if (role == null) {
            Map<String, Object> none = pick(List.of(), 0);
            return obj("role", null, "games", 0, "winRate", 0, "runes", none, "summonerSpells", none,
                    "boots", none, "itemSlots", List.of(), "items", List.of(), "coreSets", none, "skillOrder", null,
                    "startingItems", null);
        }

        Map<String, Object> base = q(f, championKey, role, opponentKey, w -> "SELECT count(*)::int AS games, "
                + "coalesce(sum(win::int),0)::int AS wins, "
                + "count(*) FILTER (WHERE skill_max_order IS NOT NULL)::int AS skill_sample, "
                + "count(*) FILTER (WHERE starting_items IS NOT NULL)::int AS start_sample "
                + "FROM match_participants p WHERE " + w).get(0);
        int games = Db.i(base, "games");

        int minGames = Math.max(MIN_OPTION_GAMES, (int) Math.ceil(games * MIN_OPTION_SHARE));

        var runes = q(f, championKey, role, opponentKey, w -> "SELECT primary_style, sub_style, keystone, primary_perks, "
                + "secondary_perks, stat_shards, count(*)::int AS games, sum(win::int)::int AS wins "
                + "FROM match_participants p WHERE " + w + " AND p.keystone IS NOT NULL "
                + "GROUP BY primary_style, sub_style, keystone, primary_perks, secondary_perks, stat_shards " + top(5));
        var spells = q(f, championKey, role, opponentKey, w -> "SELECT LEAST(spell1, spell2) AS a, GREATEST(spell1, spell2) AS b, "
                + "count(*)::int AS games, sum(win::int)::int AS wins FROM match_participants p WHERE " + w
                + " GROUP BY 1, 2 " + top(5));
        var boots = q(f, championKey, role, opponentKey, w -> "SELECT boots AS item_id, count(*)::int AS games, "
                + "sum(win::int)::int AS wins FROM match_participants p WHERE " + w
                + " AND p.boots IS NOT NULL GROUP BY boots " + top(5));
        var items = q(f, championKey, role, opponentKey, w -> "SELECT i.item_id, count(*)::int AS games, "
                + "sum(p.win::int)::int AS wins FROM match_participants p "
                + "CROSS JOIN LATERAL (SELECT DISTINCT x AS item_id FROM unnest(p.completed_items) AS x) i "
                + "WHERE " + w + " GROUP BY i.item_id " + top(12));
        var core = q(f, championKey, role, opponentKey, w -> "SELECT core_items, count(*)::int AS games, "
                + "sum(win::int)::int AS wins FROM match_participants p WHERE " + w
                + " AND p.core_items IS NOT NULL GROUP BY core_items " + top(5));
        var skills = q(f, championKey, role, opponentKey, w -> "SELECT skill_max_order, "
                + "mode() WITHIN GROUP (ORDER BY skill_order) AS sequence, count(*)::int AS games, "
                + "sum(win::int)::int AS wins FROM match_participants p WHERE " + w
                + " AND p.skill_max_order IS NOT NULL GROUP BY skill_max_order " + top(5));
        var starts = q(f, championKey, role, opponentKey, w -> "SELECT starting_items, count(*)::int AS games, "
                + "sum(win::int)::int AS wins FROM match_participants p WHERE " + w
                + " AND p.starting_items IS NOT NULL GROUP BY starting_items " + top(5));

        List<Map<String, Object>> runeOut = new ArrayList<>();
        for (Map<String, Object> r : runes) {
            Map<String, Object> m = obj("primaryStyle", r.get("primary_style"), "subStyle", r.get("sub_style"),
                    "keystone", r.get("keystone"), "primaryPerks", r.get("primary_perks"),
                    "secondaryPerks", r.get("secondary_perks"), "statShards", r.get("stat_shards"));
            m.putAll(withRate(r, games));
            runeOut.add(m);
        }
        List<Map<String, Object>> spellOut = new ArrayList<>();
        for (Map<String, Object> r : spells) {
            Map<String, Object> m = obj("spellIds", List.of(r.get("a"), r.get("b")));
            m.putAll(withRate(r, games));
            spellOut.add(m);
        }
        List<Map<String, Object>> bootOut = new ArrayList<>();
        for (Map<String, Object> r : boots) {
            Map<String, Object> m = obj("itemId", r.get("item_id"));
            m.putAll(withRate(r, games));
            bootOut.add(m);
        }
        // Prioritize upgraded boots over basic boots (1001, 2422)
        bootOut.sort((a, b) -> {
            int idA = Db.i(a, "itemId");
            int idB = Db.i(b, "itemId");
            boolean basicA = idA == 1001 || idA == 2422;
            boolean basicB = idB == 1001 || idB == 2422;
            if (basicA != basicB) return basicA ? 1 : -1;
            return Integer.compare(Db.i(b, "games"), Db.i(a, "games"));
        });
        List<Object> itemOut = new ArrayList<>();
        for (Map<String, Object> r : items) {
            Map<String, Object> m = obj("itemId", r.get("item_id"));
            m.putAll(withRate(r, games));
            itemOut.add(m);
        }
        List<Map<String, Object>> coreOut = new ArrayList<>();
        for (Map<String, Object> r : core) {
            Map<String, Object> m = obj("itemIds", r.get("core_items"));
            m.putAll(withRate(r, games));
            coreOut.add(m);
        }

        List<Map<String, Object>> startOut = new ArrayList<>();
        int startSample = Db.i(base, "start_sample");
        for (Map<String, Object> r : starts) {
            Map<String, Object> m = obj("itemIds", r.get("starting_items"));
            m.putAll(withRate(r, startSample));
            startOut.add(m);
        }
        List<Object> itemSlots = new ArrayList<>();
        itemSlots.add(slotOut("starting", startSample, startOut));
        itemSlots.add(itemSlot(f, championKey, role, opponentKey, "core", 1, 3));
        itemSlots.add(itemSlot(f, championKey, role, opponentKey, "fourth", 4, 4));
        itemSlots.add(itemSlot(f, championKey, role, opponentKey, "fifth", 5, 5));
        itemSlots.add(itemSlot(f, championKey, role, opponentKey, "sixth", 6, 6));

        Object skillOrder = null;
        if (Db.i(base, "skill_sample") > 0) {
            List<Object> orders = new ArrayList<>();
            for (Map<String, Object> r : skills) {
                orders.add(obj("maxOrder", r.get("skill_max_order"), "sequence", r.get("sequence"),
                        "games", r.get("games"), "winRate", ratio(Db.i(r, "wins"), Db.i(r, "games"))));
            }
            skillOrder = obj("sampleSize", Db.i(base, "skill_sample"), "orders", orders);
        }
        Object startingItems = null;
        if (Db.i(base, "start_sample") > 0) {
            List<Object> sets = new ArrayList<>();
            for (Map<String, Object> r : starts) {
                sets.add(obj("itemIds", r.get("starting_items"), "games", r.get("games"),
                        "winRate", ratio(Db.i(r, "wins"), Db.i(r, "games"))));
            }
            startingItems = obj("sampleSize", Db.i(base, "start_sample"), "sets", sets);
        }

        return obj("role", role, "games", games, "winRate", ratio(Db.i(base, "wins"), games),
                "minGames", minGames,
                "runes", pick(runeOut, minGames),
                "summonerSpells", pick(spellOut, minGames),
                "boots", pick(bootOut, minGames),
                "itemSlots", itemSlots,
                "items", itemOut,
                "coreSets", pick(coreOut, minGames),
                "skillOrder", skillOrder, "startingItems", startingItems);
    }

    // ---------- matchups ----------
    public Map<String, Object> championMatchups(Filter f, int championKey, int minGames) {
        String role = resolveRole(f, championKey);
        if (role == null) return obj("role", null, "rows", List.of());
        P p = new P();
        String where = buildBase(f, championKey, role, null, p);
        List<Map<String, Object>> rows = db.rows(
                "SELECT o.champion_id AS opponent_key, count(*)::int AS games, sum(p.win::int)::int AS wins "
                        + "FROM match_participants p "
                        + "JOIN match_participants o ON o.match_id = p.match_id AND o.role = p.role AND o.team_id <> p.team_id "
                        + "WHERE " + where + " GROUP BY o.champion_id HAVING count(*) >= " + p.add(minGames)
                        + " ORDER BY games DESC", p.args());
        List<Object> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            out.add(obj("opponentKey", r.get("opponent_key"), "games", r.get("games"), "wins", r.get("wins"),
                    "winRate", ratio(Db.i(r, "wins"), Db.i(r, "games"))));
        }
        return obj("role", role, "rows", out);
    }

    // ---------- tier list ----------
    public Map<String, Object> tierList(Filter f, int minGames) {
        int total = totalMatches(f);

        P p = new P();
        List<String> where = f.conditions(p, "p");
        where.add("p.role IS NOT NULL");
        if (f.role() != null) where.add("p.role = " + p.add(f.role()));
        List<Map<String, Object>> rows = db.rows(
                "SELECT p.champion_id, p.role, count(*)::int AS games, sum(p.win::int)::int AS wins "
                        + "FROM match_participants p WHERE " + String.join(" AND ", where)
                        + " GROUP BY p.champion_id, p.role HAVING count(*) >= " + p.add(minGames), p.args());

        Map<String, Integer> slots = slotsByRole(f);

        P pb = new P();
        Map<Integer, Integer> banByChamp = new HashMap<>();
        for (Map<String, Object> r : db.rows("SELECT b.champion_id, count(DISTINCT b.match_id)::int AS n FROM match_bans b "
                + "JOIN matches m ON m.match_id = b.match_id WHERE " + String.join(" AND ", f.conditions(pb, "m"))
                + " GROUP BY b.champion_id", pb.args())) {
            banByChamp.put(Db.i(r, "champion_id"), Db.i(r, "n"));
        }

        List<Object> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            int games = Db.i(r, "games");
            int wins = Db.i(r, "wins");
            double wr = ratio(wins, games);
            if (wr < 0.43) continue; // Exclude champions with win rate under 43%
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("championKey", Db.i(r, "champion_id"));
            m.put("role", Db.s(r, "role"));
            m.put("games", games);
            m.put("winRate", wr);
            m.put("pickRate", ratio(games, slots.getOrDefault(Db.s(r, "role"), 0)));
            m.put("banRate", ratio(banByChamp.getOrDefault(Db.i(r, "champion_id"), 0), total));
            m.put("score", wilsonScore(wins, games));
            out.add(m);
        }
        return obj("totalMatches", total, "rows", out);
    }
}