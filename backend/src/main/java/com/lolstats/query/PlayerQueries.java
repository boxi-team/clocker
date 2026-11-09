package com.lolstats.query;

import static com.lolstats.common.Api.obj;
import static com.lolstats.common.Api.ratio;
import static com.lolstats.query.StatLines.STAT_COLS;
import static com.lolstats.query.StatLines.statLine;

import com.lolstats.common.Db;
import com.lolstats.query.Filter.P;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Per-player analytics over match_participants. */
@Service
public class PlayerQueries {
    /** {@code patch}, {@code championKey} and {@code role} are optional (null = no restriction). */
    public record PlayerFilter(String puuid, int queueId, String patch, Integer championKey, String role) {
        PlayerFilter without(boolean champion, boolean roleToo) {
            return new PlayerFilter(puuid, queueId, patch, champion ? null : championKey, roleToo ? null : role);
        }
    }

    private static final Map<String, String> CHAMPION_SORT = Map.of(
            "games", "games DESC",
            "winRate", "wins::float / games DESC, games DESC",
            "kda", "(k + a) / GREATEST(1, d) DESC, games DESC");

    private final Db db;

    public PlayerQueries(Db db) {
        this.db = db;
    }

    private static String where(PlayerFilter f, P p) {
        List<String> c = new ArrayList<>();
        c.add("p.puuid = " + p.add(f.puuid()));
        c.add("p.queue_id = " + p.add(f.queueId()));
        if (f.patch() != null) c.add("p.patch = " + p.add(f.patch()));
        if (f.championKey() != null) c.add("p.champion_id = " + p.add(f.championKey()));
        if (f.role() != null) c.add("p.role = " + p.add(f.role()));
        return String.join(" AND ", c);
    }

    private static double rate(int wins, int games) {
        return games > 0 ? Math.round((double) wins / games * 10000) / 10000.0 : 0;
    }

    public int countIndexed(String puuid) {
        return Db.i(db.one("SELECT count(*)::int AS n FROM match_participants WHERE puuid = ?", puuid), "n");
    }

    public record MatchPage(int total, List<Map<String, Object>> rows) {}

    public MatchPage listMatches(PlayerFilter f, int start, int count, String latestPatchVersion) {
        P tp = new P();
        int total = Db.i(db.one("SELECT count(*)::int AS n FROM match_participants p WHERE " + where(f, tp), tp.args()), "n");

        // The champion-name join comes first in the SQL text, so its parameter goes first too.
        P p = new P();
        String join = "c.patch = " + p.add(latestPatchVersion);
        String w = where(f, p);
        List<Map<String, Object>> rows = db.rows(
                "SELECT p.*, c.id AS champion_name FROM match_participants p "
                        + "LEFT JOIN champions c ON c.key = p.champion_id AND " + join
                        + " WHERE " + w + " ORDER BY p.game_creation DESC LIMIT " + p.add(count) + " OFFSET " + p.add(start),
                p.args());
        return new MatchPage(total, rows);
    }

    private List<Object> byRole(PlayerFilter f) {
        P p = new P();
        List<Object> out = new ArrayList<>();
        for (Map<String, Object> r : db.rows("SELECT p.role, " + STAT_COLS + " FROM match_participants p WHERE "
                + where(f, p) + " AND p.role IS NOT NULL GROUP BY p.role ORDER BY games DESC", p.args())) {
            Map<String, Object> line = obj("role", Db.s(r, "role"));
            line.putAll(statLine(r));
            out.add(line);
        }
        return out;
    }

    public Map<String, Object> playerStats(PlayerFilter filter) {
        PlayerFilter f = filter.without(true, true);
        P p = new P();
        Map<String, Object> summary = db.one("SELECT " + STAT_COLS + " FROM match_participants p WHERE " + where(f, p), p.args());
        P pl = new P();
        Map<String, Object> last = db.one("SELECT count(*)::int AS games, coalesce(sum(win::int), 0)::int AS wins FROM ("
                + "SELECT p.win FROM match_participants p WHERE " + where(f, pl)
                + " ORDER BY p.game_creation DESC LIMIT 20) t", pl.args());
        int games = Db.i(last, "games");
        int wins = Db.i(last, "wins");
        return obj("summary", statLine(summary), "byRole", byRole(f),
                "last20", obj("games", games, "wins", wins, "winRate", rate(wins, games)));
    }

    public List<Map<String, Object>> playerChampions(PlayerFilter filter, String sort, int limit) {
        PlayerFilter f = filter.without(true, false);
        P p = new P();
        String w = where(f, p);
        List<Map<String, Object>> rows = db.rows("SELECT p.champion_id, " + STAT_COLS + " FROM match_participants p WHERE "
                + w + " GROUP BY p.champion_id ORDER BY " + CHAMPION_SORT.get(sort) + " LIMIT " + p.add(limit), p.args());
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> m = obj("championKey", Db.i(r, "champion_id"));
            m.putAll(statLine(r));
            out.add(m);
        }
        return out;
    }

    public Map<String, Object> playerChampionDetail(PlayerFilter filter) {
        PlayerFilter f = filter.without(false, true);
        P p = new P();
        Map<String, Object> summary = db.one("SELECT " + STAT_COLS + " FROM match_participants p WHERE " + where(f, p), p.args());

        P pk = new P();
        List<Object> keystones = new ArrayList<>();
        for (Map<String, Object> r : db.rows("SELECT p.keystone, count(*)::int AS games, sum(p.win::int)::int AS wins "
                + "FROM match_participants p WHERE " + where(f, pk) + " AND p.keystone IS NOT NULL "
                + "GROUP BY p.keystone ORDER BY games DESC LIMIT 3", pk.args())) {
            keystones.add(obj("keystone", r.get("keystone"), "games", r.get("games"), "winRate", rate(Db.i(r, "wins"), Db.i(r, "games"))));
        }

        P pi = new P();
        List<Object> items = new ArrayList<>();
        for (Map<String, Object> r : db.rows("SELECT i.item_id, count(*)::int AS games, sum(p.win::int)::int AS wins "
                + "FROM match_participants p "
                + "CROSS JOIN LATERAL (SELECT DISTINCT x AS item_id FROM unnest(p.completed_items) AS x) i "
                + "WHERE " + where(f, pi) + " GROUP BY i.item_id ORDER BY games DESC LIMIT 8", pi.args())) {
            items.add(obj("itemId", r.get("item_id"), "games", r.get("games"), "winRate", rate(Db.i(r, "wins"), Db.i(r, "games"))));
        }

        return obj("summary", statLine(summary), "byRole", byRole(f), "topKeystones", keystones, "topItems", items);
    }
}
