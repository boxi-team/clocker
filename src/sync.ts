import { config } from './config.js';
import { pool } from './db.js';
import {
  fetchChampionDetail,
  fetchChampionList,
  fetchItems,
  fetchLatestVersion,
  fetchRunes,
  fetchSummonerSpells,
  type DDragonChampionDetail,
} from './ddragon.js';
import { clearItemCache } from './ingest/items.js';

const CONCURRENCY = 10;

export interface SyncResult {
  patch: string;
  synced: boolean;
  champions: number;
}

/** Run `fn` over `items` with at most `limit` in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Downloads champion data for the latest patch and upserts it into Postgres.
 * Does nothing if that patch is already stored, unless `force` is true.
 */
export async function syncChampions(force = false): Promise<SyncResult> {
  const patch = await fetchLatestVersion();

  if (!force) {
    const { rowCount } = await pool.query('SELECT 1 FROM patches WHERE version = $1', [patch]);
    if (rowCount) return { patch, synced: false, champions: 0 };
  }

  // Fetch everything first so a failed download never leaves a half-written patch.
  const list = await fetchChampionList(patch);
  const details = await mapLimit(list, CONCURRENCY, (c) => fetchChampionDetail(patch, c.id));
  const [items, runes, spells] = await Promise.all([
    fetchItems(patch),
    fetchRunes(patch),
    fetchSummonerSpells(patch),
  ]);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO patches (version, locale) VALUES ($1, $2)
       ON CONFLICT (version) DO UPDATE SET synced_at = now(), locale = EXCLUDED.locale`,
      [patch, config.locale],
    );
    for (const d of details) await upsertChampion(client, patch, d);
    for (const [kind, data] of [['items', items], ['runes', runes], ['spells', spells]] as const) {
      await client.query(
        `INSERT INTO static_assets (version, kind, data) VALUES ($1, $2, $3)
         ON CONFLICT (version, kind) DO UPDATE SET data = EXCLUDED.data`,
        [patch, kind, JSON.stringify(data)],
      );
    }
    await client.query('COMMIT');
    clearItemCache();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { patch, synced: true, champions: details.length };
}

async function upsertChampion(
  client: { query: (text: string, values: unknown[]) => Promise<unknown> },
  patch: string,
  d: DDragonChampionDetail,
) {
  await client.query(
    `INSERT INTO champions
       (key, patch, id, name, title, blurb, lore, tags, partype, info, stats, spells, passive, skins, image)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (key, patch) DO UPDATE SET
       id = EXCLUDED.id, name = EXCLUDED.name, title = EXCLUDED.title, blurb = EXCLUDED.blurb,
       lore = EXCLUDED.lore, tags = EXCLUDED.tags, partype = EXCLUDED.partype, info = EXCLUDED.info,
       stats = EXCLUDED.stats, spells = EXCLUDED.spells, passive = EXCLUDED.passive,
       skins = EXCLUDED.skins, image = EXCLUDED.image`,
    [
      Number(d.key),
      patch,
      d.id,
      d.name,
      d.title,
      d.blurb,
      d.lore,
      d.tags,
      d.partype,
      JSON.stringify(d.info),
      JSON.stringify(d.stats),
      JSON.stringify(d.spells),
      JSON.stringify(d.passive),
      JSON.stringify(d.skins),
      JSON.stringify(d.image),
    ],
  );
}
