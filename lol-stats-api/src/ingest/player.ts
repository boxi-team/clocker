import { config } from '../config.js';
import { pool } from '../db.js';
import { QUEUES, queueFromRiot, type Queue, type Region } from '../domain.js';
import { AppError, notFound } from '../errors.js';
import { riot, RiotNotFound } from '../riot/client.js';
import { ingestMatch } from './match.js';

export interface PlayerRow {
  puuid: string;
  region: Region;
  game_name: string;
  tag_line: string;
  summoner_level: number | null;
  profile_icon_id: number | null;
  last_refresh_requested_at: Date | null;
  last_refreshed_at: Date | null;
  last_match_creation: string | null; // bigint comes back as string
}

export async function findPlayer(region: Region, gameName: string, tagLine: string) {
  const { rows } = await pool.query<PlayerRow>(
    `SELECT * FROM players WHERE region = $1 AND lower(game_name) = lower($2) AND lower(tag_line) = lower($3)`,
    [region, gameName, tagLine],
  );
  return rows[0] ?? null;
}

export async function getPlayerByPuuid(puuid: string) {
  const { rows } = await pool.query<PlayerRow>('SELECT * FROM players WHERE puuid = $1', [puuid]);
  return rows[0] ?? null;
}

/** Calls Riot (account, summoner, league) and stores the result. Throws PLAYER_NOT_FOUND on a Riot 404. */
export async function fetchAndStorePlayer(region: Region, gameName: string, tagLine: string): Promise<PlayerRow> {
  try {
    const account = await riot.account(region, gameName, tagLine);
    const [summoner, entries] = await Promise.all([
      riot.summoner(region, account.puuid),
      riot.leagueEntries(region, account.puuid),
    ]);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // A Riot ID can be re-assigned to a different account; free it before inserting.
      await client.query(
        `DELETE FROM players WHERE region = $1 AND lower(game_name) = lower($2) AND lower(tag_line) = lower($3) AND puuid <> $4`,
        [region, account.gameName, account.tagLine, account.puuid],
      );
      await client.query(
        `INSERT INTO players (puuid, region, game_name, tag_line, summoner_level, profile_icon_id)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (puuid) DO UPDATE SET region = EXCLUDED.region, game_name = EXCLUDED.game_name,
           tag_line = EXCLUDED.tag_line, summoner_level = EXCLUDED.summoner_level,
           profile_icon_id = EXCLUDED.profile_icon_id`,
        [account.puuid, region, account.gameName, account.tagLine, summoner.summonerLevel, summoner.profileIconId],
      );
      await client.query('DELETE FROM player_ranks WHERE puuid = $1', [account.puuid]);
      for (const e of entries) {
        const queue = queueFromRiot(e.queueType);
        if (!queue) continue; // TFT etc.
        await client.query(
          `INSERT INTO player_ranks (puuid, queue, tier, division, league_points, wins, losses)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [account.puuid, queue, e.tier, e.rank, e.leaguePoints, e.wins, e.losses],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return (await getPlayerByPuuid(account.puuid))!;
  } catch (err) {
    if (err instanceof RiotNotFound) throw notFound('PLAYER_NOT_FOUND', `Player ${gameName}#${tagLine} not found on ${region}`);
    throw err;
  }
}

async function tierBucketFor(puuid: string, queue: Queue): Promise<string> {
  const { rows } = await pool.query<{ tier: string }>(
    'SELECT tier FROM player_ranks WHERE puuid = $1 AND queue = $2',
    [puuid, queue],
  );
  return rows[0]?.tier.toLowerCase() ?? 'unranked';
}

/**
 * Imports new ranked matches for a player (both queues). First time: the latest
 * `firstImportCount` per queue. Afterwards: everything since the newest stored match, up to 100.
 */
export async function importPlayerMatches(
  puuid: string,
  onProgress?: (done: number, total: number) => Promise<void> | void,
): Promise<{ stored: number; skipped: number; existing: number }> {
  const player = await getPlayerByPuuid(puuid);
  if (!player) throw new AppError(404, 'PLAYER_NOT_FOUND', 'Unknown player');

  const lastCreation = player.last_match_creation ? Number(player.last_match_creation) : null;
  const toFetch: { id: string; queue: Queue }[] = [];
  for (const queue of Object.keys(QUEUES) as Queue[]) {
    const ids = await riot.matchIds(player.region, puuid, {
      queue: QUEUES[queue].id,
      count: lastCreation ? 100 : config.firstImportCount,
      startTime: lastCreation ? Math.floor(lastCreation / 1000) : undefined,
    });
    for (const id of ids) toFetch.push({ id, queue });
  }

  const out = { stored: 0, skipped: 0, existing: 0 };
  let done = 0;
  await onProgress?.(0, toFetch.length);
  for (const { id, queue } of toFetch) {
    const tier = await tierBucketFor(puuid, queue);
    const outcome = await ingestMatch(player.region, id, { tierBucket: tier });
    if (outcome === 'stored') out.stored++;
    else if (outcome === 'skipped') out.skipped++;
    else out.existing++;
    await onProgress?.(++done, toFetch.length);
  }

  await pool.query(
    `UPDATE players SET last_refreshed_at = now(),
       last_match_creation = COALESCE((SELECT max(game_creation) FROM match_participants WHERE puuid = $1), last_match_creation)
     WHERE puuid = $1`,
    [puuid],
  );
  return out;
}
