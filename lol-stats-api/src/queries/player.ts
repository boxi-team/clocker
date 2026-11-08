import { pool } from '../db.js';
import type { Role } from '../domain.js';
import { STAT_COLS, statLine, type StatRow } from './stats.js';

export interface PlayerFilter {
  puuid: string;
  queueId: number;
  patch?: string; // major.minor; undefined = all stored matches
  championKey?: number;
  role?: Role;
}

function where(f: PlayerFilter, a = 'p') {
  const v: unknown[] = [f.puuid, f.queueId];
  const c = [`${a}.puuid = $1`, `${a}.queue_id = $2`];
  const add = (x: unknown) => `$${v.push(x)}`;
  if (f.patch) c.push(`${a}.patch = ${add(f.patch)}`);
  if (f.championKey !== undefined) c.push(`${a}.champion_id = ${add(f.championKey)}`);
  if (f.role) c.push(`${a}.role = ${add(f.role)}`);
  return { sql: c.join(' AND '), values: v, add };
}

export async function countIndexed(puuid: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM match_participants WHERE puuid = $1',
    [puuid],
  );
  return rows[0].n;
}

export async function listMatches(f: PlayerFilter, start: number, count: number, latestPatchVersion: string | null) {
  const w = where(f);
  const total = (
    await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM match_participants p WHERE ${w.sql}`, w.values)
  ).rows[0].n;

  const rows = await pool.query(
    `SELECT p.*, c.id AS champion_name
     FROM match_participants p
     LEFT JOIN champions c ON c.key = p.champion_id AND c.patch = ${w.add(latestPatchVersion)}
     WHERE ${w.sql}
     ORDER BY p.game_creation DESC
     LIMIT ${w.add(count)} OFFSET ${w.add(start)}`,
    w.values,
  );
  return { total, rows: rows.rows };
}

export async function playerStats(f: PlayerFilter) {
  const w = where({ ...f, championKey: undefined, role: undefined });
  const summary = await pool.query<StatRow>(`SELECT ${STAT_COLS} FROM match_participants p WHERE ${w.sql}`, w.values);
  const byRole = await pool.query<StatRow & { role: Role }>(
    `SELECT p.role, ${STAT_COLS} FROM match_participants p WHERE ${w.sql} AND p.role IS NOT NULL
     GROUP BY p.role ORDER BY games DESC`,
    w.values,
  );
  const last = await pool.query<{ games: number; wins: number }>(
    `SELECT count(*)::int AS games, coalesce(sum(win::int), 0)::int AS wins FROM (
       SELECT p.win FROM match_participants p WHERE ${w.sql} ORDER BY p.game_creation DESC LIMIT 20
     ) t`,
    w.values,
  );
  const l = last.rows[0];
  return {
    summary: statLine(summary.rows[0]),
    byRole: byRole.rows.map((r) => ({ role: r.role, ...statLine(r) })),
    last20: { games: l.games, wins: l.wins, winRate: l.games ? Math.round((l.wins / l.games) * 10000) / 10000 : 0 },
  };
}

const CHAMPION_SORT = {
  games: 'games DESC',
  winRate: 'wins::float / games DESC, games DESC',
  kda: '(k + a) / GREATEST(1, d) DESC, games DESC',
} as const;

export async function playerChampions(f: PlayerFilter, sort: keyof typeof CHAMPION_SORT, limit: number) {
  const w = where({ ...f, championKey: undefined });
  const { rows } = await pool.query<StatRow & { champion_id: number }>(
    `SELECT p.champion_id, ${STAT_COLS} FROM match_participants p WHERE ${w.sql}
     GROUP BY p.champion_id ORDER BY ${CHAMPION_SORT[sort]} LIMIT ${w.add(limit)}`,
    w.values,
  );
  return rows.map((r) => ({ championKey: r.champion_id, ...statLine(r) }));
}

export async function playerChampionDetail(f: PlayerFilter & { championKey: number }) {
  const w = where({ ...f, role: undefined });
  const summary = await pool.query<StatRow>(`SELECT ${STAT_COLS} FROM match_participants p WHERE ${w.sql}`, w.values);
  const byRole = await pool.query<StatRow & { role: Role }>(
    `SELECT p.role, ${STAT_COLS} FROM match_participants p WHERE ${w.sql} AND p.role IS NOT NULL
     GROUP BY p.role ORDER BY games DESC`,
    w.values,
  );
  const keystones = await pool.query<{ keystone: number; games: number; wins: number }>(
    `SELECT p.keystone, count(*)::int AS games, sum(p.win::int)::int AS wins
     FROM match_participants p WHERE ${w.sql} AND p.keystone IS NOT NULL
     GROUP BY p.keystone ORDER BY games DESC LIMIT 3`,
    w.values,
  );
  const items = await pool.query<{ item_id: number; games: number; wins: number }>(
    `SELECT i.item_id, count(*)::int AS games, sum(p.win::int)::int AS wins
     FROM match_participants p
     CROSS JOIN LATERAL (SELECT DISTINCT x AS item_id FROM unnest(p.completed_items) AS x) i
     WHERE ${w.sql} GROUP BY i.item_id ORDER BY games DESC LIMIT 8`,
    w.values,
  );
  const rate = (wins: number, games: number) => (games ? Math.round((wins / games) * 10000) / 10000 : 0);
  return {
    summary: statLine(summary.rows[0]),
    byRole: byRole.rows.map((r) => ({ role: r.role, ...statLine(r) })),
    topKeystones: keystones.rows.map((r) => ({ keystone: r.keystone, games: r.games, winRate: rate(r.wins, r.games) })),
    topItems: items.rows.map((r) => ({ itemId: r.item_id, games: r.games, winRate: rate(r.wins, r.games) })),
  };
}
