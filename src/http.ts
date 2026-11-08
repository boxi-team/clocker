import { pool, latestPatch } from './db.js';
import { AppError, dataNotReady, notFound } from './errors.js';

export const ok = <T>(data: T, meta: Record<string, unknown> = {}) => ({
  data,
  meta: { generatedAt: new Date().toISOString(), ...meta },
});

/** "latest" -> major.minor of the newest synced patch (e.g. "15.21"); otherwise the given major.minor. */
export async function resolveAnalyticsPatch(p: string): Promise<string> {
  if (p !== 'latest') return p;
  const v = await latestPatch();
  if (!v) throw dataNotReady();
  return v.split('.').slice(0, 2).join('.');
}

/** "latest" -> newest synced Data Dragon version; otherwise the given full version. */
export async function resolveStaticPatch(p: string): Promise<string> {
  if (p !== 'latest') return p;
  const v = await latestPatch();
  if (!v) throw dataNotReady();
  return v;
}

export interface ChampionRef {
  key: number;
  id: string;
  name: string;
  image: { full: string };
}

/** Accepts a Data Dragon id ("Ahri", case-insensitive) or a numeric key ("103"). Looks in the newest patch. */
export async function resolveChampion(idOrKey: string): Promise<ChampionRef> {
  const patch = await latestPatch();
  if (!patch) throw dataNotReady();
  const numeric = /^\d+$/.test(idOrKey);
  const { rows } = await pool.query<ChampionRef>(
    `SELECT key, id, name, image FROM champions
     WHERE patch = $1 AND ${numeric ? 'key = $2' : 'lower(id) = lower($2)'}`,
    [patch, numeric ? Number(idOrKey) : idOrKey],
  );
  if (!rows[0]) throw notFound('CHAMPION_NOT_FOUND', `Champion "${idOrKey}" not found`);
  return rows[0];
}

/** key -> { id, name, image } for every champion of the newest patch. */
export async function championIndex(): Promise<{ patch: string; byKey: Map<number, ChampionRef> }> {
  const patch = await latestPatch();
  if (!patch) throw dataNotReady();
  const { rows } = await pool.query<ChampionRef>('SELECT key, id, name, image FROM champions WHERE patch = $1', [patch]);
  return { patch, byKey: new Map(rows.map((r) => [r.key, r])) };
}

export function requireAdmin(token: string | string[] | undefined, expected: string) {
  if (!expected || typeof token !== 'string' || token !== expected) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid x-admin-token');
  }
}
