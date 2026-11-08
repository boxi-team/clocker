import type { QueryResultRow } from 'pg';
import { config } from '../config.js';
import { pool } from '../db.js';
import type { Role } from '../domain.js';

// ---------- filter + SQL helpers ----------
export interface Filter {
  patch: string; // major.minor
  queueId: number;
  tiers: string[] | null; // null = all tiers
  region: string | null; // null = all regions
  role?: Role;
}

class Params {
  values: unknown[] = [];
  add(v: unknown) {
    this.values.push(v);
    return `$${this.values.length}`;
  }
}

/** Conditions shared by `matches` and `match_participants` (both carry these columns). */
function conditions(f: Filter, p: Params, a: string): string[] {
  const c = [`${a}.patch = ${p.add(f.patch)}`, `${a}.queue_id = ${p.add(f.queueId)}`];
  if (f.tiers) c.push(`${a}.tier_bucket = ANY(${p.add(f.tiers)})`);
  if (f.region) c.push(`${a}.region = ${p.add(f.region)}`);
  return c;
}

const round = (n: number, d: number) => {
  const m = 10 ** d;
  return Math.round(n * m) / m;
};
const ratio = (a: number, b: number) => (b > 0 ? round(a / b, 4) : 0);

export const STAT_COLS = `
  count(*)::int AS games,
  coalesce(sum(win::int), 0)::int AS wins,
  coalesce(sum(kills), 0)::float AS k, coalesce(sum(deaths), 0)::float AS d, coalesce(sum(assists), 0)::float AS a,
  coalesce(sum(cs), 0)::float AS cs, coalesce(sum(game_duration), 0)::float AS secs,
  coalesce(sum(gold), 0)::float AS gold, coalesce(sum(damage), 0)::float AS dmg,
  coalesce(sum(vision_score), 0)::float AS vis`;

export interface StatRow {
  games: number; wins: number; k: number; d: number; a: number;
  cs: number; secs: number; gold: number; dmg: number; vis: number;
}

export function statLine(r: StatRow) {
  const g = r.games || 1;
  return {
    games: r.games,
    wins: r.wins,
    winRate: ratio(r.wins, r.games),
    kda: round((r.k + r.a) / Math.max(1, r.d), 2),
    avgKills: round(r.k / g, 2),
    avgDeaths: round(r.d / g, 2),
    avgAssists: round(r.a / g, 2),
    csPerMin: r.secs > 0 ? round(r.cs / (r.secs / 60), 2) : 0,
    avgGold: Math.round(r.gold / g),
    avgDamageToChampions: Math.round(r.dmg / g),
    avgVisionScore: round(r.vis / g, 1),
  };
}

/** Lower bound of the 95% Wilson interval, 0-100. */
export function wilsonScore(wins: number, games: number): number {
  if (games === 0) return 0;
  const z = 1.96;
  const p = wins / games;
  const lower =
    (p + (z * z) / (2 * games) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * games)) / games)) /
    (1 + (z * z) / games);
  return round(Math.max(0, lower) * 100, 2);
}

export async function totalMatches(f: Filter): Promise<number> {
  const p = new Params();
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM matches m WHERE ${conditions(f, p, 'm').join(' AND ')}`,
    p.values,
  );
  return rows[0].n;
}

// ---------- champion stats ----------
export async function championStats(f: Filter, championKey: number) {
  const total = await totalMatches(f);

  const pc = new Params();
  const base = [...conditions(f, pc, 'p'), `p.champion_id = ${pc.add(championKey)}`];
  if (f.role) base.push(`p.role = ${pc.add(f.role)}`);
  const overall = await pool.query<StatRow>(
    `SELECT ${STAT_COLS} FROM match_participants p WHERE ${base.join(' AND ')}`,
    pc.values,
  );

  const pb = new Params();
  const bans = await pool.query<{ n: number }>(
    `SELECT count(DISTINCT b.match_id)::int AS n FROM match_bans b JOIN matches m ON m.match_id = b.match_id
     WHERE b.champion_id = ${pb.add(championKey)} AND ${conditions(f, pb, 'm').join(' AND ')}`,
    pb.values,
  );

  const pr = new Params();
  const byRoleWhere = [...conditions(f, pr, 'p'), `p.champion_id = ${pr.add(championKey)}`, 'p.role IS NOT NULL'];
  if (f.role) byRoleWhere.push(`p.role = ${pr.add(f.role)}`);
  const byRole = await pool.query<StatRow & { role: Role }>(
    `SELECT p.role, ${STAT_COLS} FROM match_participants p WHERE ${byRoleWhere.join(' AND ')}
     GROUP BY p.role ORDER BY games DESC`,
    pr.values,
  );

  const ps = new Params();
  const slots = await pool.query<{ role: Role; n: number }>(
    `SELECT p.role, count(*)::int AS n FROM match_participants p
     WHERE ${conditions(f, ps, 'p').join(' AND ')} AND p.role IS NOT NULL GROUP BY p.role`,
    ps.values,
  );
  const slotsByRole = new Map(slots.rows.map((r) => [r.role, r.n]));

  const o = overall.rows[0];
  const low = (games: number) => games < config.lowSampleGames;
  return {
    totalMatches: total,
    overall: {
      ...statLine(o),
      pickRate: ratio(o.games, total),
      banRate: ratio(bans.rows[0].n, total),
      lowSample: low(o.games),
    },
    byRole: byRole.rows.map((r) => ({
      role: r.role,
      ...statLine(r),
      pickRate: ratio(r.games, slotsByRole.get(r.role) ?? 0),
      roleRate: ratio(r.games, o.games),
      lowSample: low(r.games),
    })),
  };
}

// ---------- builds ----------
async function resolveRole(f: Filter, championKey: number): Promise<Role | null> {
  if (f.role) return f.role;
  const p = new Params();
  const { rows } = await pool.query<{ role: Role }>(
    `SELECT p.role FROM match_participants p
     WHERE ${conditions(f, p, 'p').join(' AND ')} AND p.champion_id = ${p.add(championKey)} AND p.role IS NOT NULL
     GROUP BY p.role ORDER BY count(*) DESC LIMIT 1`,
    p.values,
  );
  return rows[0]?.role ?? null;
}

/** Fresh params + base WHERE (filters, champion, role) for one builds sub-query. */
function buildBase(f: Filter, championKey: number, role: Role, opponentKey?: number) {
  const p = new Params();
  const parts = [...conditions(f, p, 'p'), `p.champion_id = ${p.add(championKey)}`, `p.role = ${p.add(role)}`];
  // Optional: only games where the lane opponent (same role, other team) played this champion.
  if (opponentKey != null) {
    parts.push(
      `EXISTS (SELECT 1 FROM match_participants o WHERE o.match_id = p.match_id AND o.role = p.role
               AND o.team_id <> p.team_id AND o.champion_id = ${p.add(opponentKey)})`,
    );
  }
  return { p, where: parts.join(' AND ') };
}

const TOP = (n: number) => `ORDER BY games DESC LIMIT ${n}`;

export async function championBuilds(f: Filter, championKey: number, opponentKey?: number) {
  const role = await resolveRole(f, championKey);
  const empty = {
    role: null as Role | null, games: 0, winRate: 0, runes: [], summonerSpells: [], boots: [], items: [],
    coreSets: [], skillOrder: null, startingItems: null,
  };
  if (!role) return empty;

  const q = async <T extends QueryResultRow>(sql: (where: string) => string) => {
    const { p, where } = buildBase(f, championKey, role, opponentKey);
    return (await pool.query<T>(sql(where), p.values)).rows;
  };

  const [base] = await q<{ games: number; wins: number; skill_sample: number; start_sample: number }>(
    (w) => `SELECT count(*)::int AS games, coalesce(sum(win::int),0)::int AS wins,
              count(*) FILTER (WHERE skill_max_order IS NOT NULL)::int AS skill_sample,
              count(*) FILTER (WHERE starting_items IS NOT NULL)::int AS start_sample
            FROM match_participants p WHERE ${w}`,
  );
  const games = base.games;
  const withRate = <R extends { games: number; wins: number }>(r: R) => ({
    games: r.games,
    winRate: ratio(r.wins, r.games),
    pickRate: ratio(r.games, games),
  });

  const [runes, spells, boots, items, core, skills, starts] = await Promise.all([
    q<{ primary_style: number; sub_style: number; keystone: number; primary_perks: number[]; secondary_perks: number[]; stat_shards: number[]; games: number; wins: number }>(
      (w) => `SELECT primary_style, sub_style, keystone, primary_perks, secondary_perks, stat_shards,
                count(*)::int AS games, sum(win::int)::int AS wins
              FROM match_participants p WHERE ${w} AND p.keystone IS NOT NULL
              GROUP BY primary_style, sub_style, keystone, primary_perks, secondary_perks, stat_shards ${TOP(5)}`),
    q<{ a: number; b: number; games: number; wins: number }>(
      (w) => `SELECT LEAST(spell1, spell2) AS a, GREATEST(spell1, spell2) AS b,
                count(*)::int AS games, sum(win::int)::int AS wins
              FROM match_participants p WHERE ${w} GROUP BY 1, 2 ${TOP(5)}`),
    q<{ item_id: number; games: number; wins: number }>(
      (w) => `SELECT boots AS item_id, count(*)::int AS games, sum(win::int)::int AS wins
              FROM match_participants p WHERE ${w} AND p.boots IS NOT NULL GROUP BY boots ${TOP(5)}`),
    q<{ item_id: number; games: number; wins: number }>(
      (w) => `SELECT i.item_id, count(*)::int AS games, sum(p.win::int)::int AS wins
              FROM match_participants p
              CROSS JOIN LATERAL (SELECT DISTINCT x AS item_id FROM unnest(p.completed_items) AS x) i
              WHERE ${w} GROUP BY i.item_id ${TOP(12)}`),
    q<{ core_items: number[]; games: number; wins: number }>(
      (w) => `SELECT core_items, count(*)::int AS games, sum(win::int)::int AS wins
              FROM match_participants p WHERE ${w} AND p.core_items IS NOT NULL GROUP BY core_items ${TOP(5)}`),
    q<{ skill_max_order: string; sequence: string; games: number; wins: number }>(
      (w) => `SELECT skill_max_order, mode() WITHIN GROUP (ORDER BY skill_order) AS sequence,
                count(*)::int AS games, sum(win::int)::int AS wins
              FROM match_participants p WHERE ${w} AND p.skill_max_order IS NOT NULL
              GROUP BY skill_max_order ${TOP(5)}`),
    q<{ starting_items: number[]; games: number; wins: number }>(
      (w) => `SELECT starting_items, count(*)::int AS games, sum(win::int)::int AS wins
              FROM match_participants p WHERE ${w} AND p.starting_items IS NOT NULL
              GROUP BY starting_items ${TOP(5)}`),
  ]);

  return {
    role,
    games,
    winRate: ratio(base.wins, games),
    runes: runes.map((r) => ({
      primaryStyle: r.primary_style, subStyle: r.sub_style, keystone: r.keystone,
      primaryPerks: r.primary_perks, secondaryPerks: r.secondary_perks, statShards: r.stat_shards,
      ...withRate(r),
    })),
    summonerSpells: spells.map((r) => ({ spellIds: [r.a, r.b], ...withRate(r) })),
    boots: boots.map((r) => ({ itemId: r.item_id, ...withRate(r) })),
    items: items.map((r) => ({ itemId: r.item_id, ...withRate(r) })),
    coreSets: core.map((r) => ({ itemIds: r.core_items, ...withRate(r) })),
    skillOrder: base.skill_sample
      ? {
          sampleSize: base.skill_sample,
          orders: skills.map((r) => ({
            maxOrder: r.skill_max_order, sequence: r.sequence, games: r.games, winRate: ratio(r.wins, r.games),
          })),
        }
      : null,
    startingItems: base.start_sample
      ? {
          sampleSize: base.start_sample,
          sets: starts.map((r) => ({ itemIds: r.starting_items, games: r.games, winRate: ratio(r.wins, r.games) })),
        }
      : null,
  };
}

// ---------- matchups ----------
export async function championMatchups(f: Filter, championKey: number, minGames: number) {
  const role = await resolveRole(f, championKey);
  if (!role) return { role: null, rows: [] as { opponentKey: number; games: number; wins: number; winRate: number }[] };
  const { p, where } = buildBase(f, championKey, role);
  const { rows } = await pool.query<{ opponent_key: number; games: number; wins: number }>(
    `SELECT o.champion_id AS opponent_key, count(*)::int AS games, sum(p.win::int)::int AS wins
     FROM match_participants p
     JOIN match_participants o ON o.match_id = p.match_id AND o.role = p.role AND o.team_id <> p.team_id
     WHERE ${where}
     GROUP BY o.champion_id HAVING count(*) >= ${p.add(minGames)}
     ORDER BY games DESC`,
    p.values,
  );
  return {
    role,
    rows: rows.map((r) => ({ opponentKey: r.opponent_key, games: r.games, wins: r.wins, winRate: ratio(r.wins, r.games) })),
  };
}

// ---------- tier list ----------
export async function tierList(f: Filter, minGames: number) {
  const total = await totalMatches(f);

  const p = new Params();
  const where = [...conditions(f, p, 'p'), 'p.role IS NOT NULL'];
  if (f.role) where.push(`p.role = ${p.add(f.role)}`);
  const rows = await pool.query<{ champion_id: number; role: Role; games: number; wins: number }>(
    `SELECT p.champion_id, p.role, count(*)::int AS games, sum(p.win::int)::int AS wins
     FROM match_participants p WHERE ${where.join(' AND ')}
     GROUP BY p.champion_id, p.role HAVING count(*) >= ${p.add(minGames)}`,
    p.values,
  );

  const ps = new Params();
  const slots = await pool.query<{ role: Role; n: number }>(
    `SELECT p.role, count(*)::int AS n FROM match_participants p
     WHERE ${conditions(f, ps, 'p').join(' AND ')} AND p.role IS NOT NULL GROUP BY p.role`,
    ps.values,
  );
  const slotsByRole = new Map(slots.rows.map((r) => [r.role, r.n]));

  const pb = new Params();
  const bans = await pool.query<{ champion_id: number; n: number }>(
    `SELECT b.champion_id, count(DISTINCT b.match_id)::int AS n FROM match_bans b
     JOIN matches m ON m.match_id = b.match_id WHERE ${conditions(f, pb, 'm').join(' AND ')}
     GROUP BY b.champion_id`,
    pb.values,
  );
  const banByChamp = new Map(bans.rows.map((r) => [r.champion_id, r.n]));

  return {
    totalMatches: total,
    rows: rows.rows.map((r) => ({
      championKey: r.champion_id,
      role: r.role,
      games: r.games,
      winRate: ratio(r.wins, r.games),
      pickRate: ratio(r.games, slotsByRole.get(r.role) ?? 0),
      banRate: ratio(banByChamp.get(r.champion_id) ?? 0, total),
      score: wilsonScore(r.wins, r.games),
    })),
  };
}
