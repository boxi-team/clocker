package gg.boxi.query;

import static gg.boxi.common.Api.obj;
import static gg.boxi.common.Api.ratio;
import static gg.boxi.common.Api.round;

import gg.boxi.common.Db;
import java.util.Map;

/** Shared aggregate SQL columns and the API shape built from them. */
public final class StatLines {
    private StatLines() {}

    public static final String STAT_COLS = """
              count(*)::int AS games,
              coalesce(sum(win::int), 0)::int AS wins,
              coalesce(sum(kills), 0)::float AS k, coalesce(sum(deaths), 0)::float AS d, coalesce(sum(assists), 0)::float AS a,
              coalesce(sum(cs), 0)::float AS cs, coalesce(sum(game_duration), 0)::float AS secs,
              coalesce(sum(gold), 0)::float AS gold, coalesce(sum(damage), 0)::float AS dmg,
              coalesce(sum(vision_score), 0)::float AS vis""";

    /** Row produced by a query selecting {@link #STAT_COLS}. */
    public static Map<String, Object> statLine(Map<String, Object> r) {
        int games = Db.i(r, "games");
        int wins = Db.i(r, "wins");
        double k = Db.d(r, "k");
        double d = Db.d(r, "d");
        double a = Db.d(r, "a");
        double cs = Db.d(r, "cs");
        double secs = Db.d(r, "secs");
        double g = games == 0 ? 1 : games;
        return obj(
                "games", games,
                "wins", wins,
                "winRate", ratio(wins, games),
                "kda", round((k + a) / Math.max(1, d), 2),
                "avgKills", round(k / g, 2),
                "avgDeaths", round(d / g, 2),
                "avgAssists", round(a / g, 2),
                "csPerMin", secs > 0 ? round(cs / (secs / 60), 2) : 0,
                "avgGold", Math.round(Db.d(r, "gold") / g),
                "avgDamageToChampions", Math.round(Db.d(r, "dmg") / g),
                "avgVisionScore", round(Db.d(r, "vis") / g, 1));
    }

    /** Lower bound of the 95% Wilson interval, 0-100. */
    public static double wilsonScore(int wins, int games) {
        if (games == 0) return 0;
        double z = 1.96;
        double p = (double) wins / games;
        double lower = (p + (z * z) / (2.0 * games) - z * Math.sqrt((p * (1 - p) + (z * z) / (4.0 * games)) / games))
                / (1 + (z * z) / games);
        return round(Math.max(0, lower) * 100, 2);
    }
}
