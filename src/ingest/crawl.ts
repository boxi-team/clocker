import { QUEUES, type Queue, type Region } from '../domain.js';
import { riot, type RiotLeagueEntry } from '../riot/client.js';
import { ingestMatch } from './match.js';

export interface CrawlPayload {
  region: Region;
  queue: Queue;
  tier: string; // iron..challenger
  division?: string; // I..IV for iron..diamond
  pages: number;
  matchesPerPlayer: number;
}

const APEX = ['master', 'grandmaster', 'challenger'] as const;

async function puuidOf(region: Region, e: RiotLeagueEntry): Promise<string | null> {
  if (e.puuid) return e.puuid;
  if (!e.summonerId) return null;
  return (await riot.summonerBySummonerId(region, e.summonerId)).puuid;
}

/**
 * Seeds the database from a ladder: lists players of a tier, then imports their recent ranked matches.
 * Every stored match gets `tier` as its tier bucket.
 */
export async function crawlLadder(
  p: CrawlPayload,
  onProgress: (done: number, total: number) => Promise<void>,
) {
  const queueRiot = QUEUES[p.queue].riot;
  const entries: RiotLeagueEntry[] = [];
  if ((APEX as readonly string[]).includes(p.tier)) {
    entries.push(...(await riot.apexEntries(p.region, queueRiot, p.tier as (typeof APEX)[number])).entries);
  } else {
    for (let page = 1; page <= p.pages; page++) {
      const batch = await riot.divisionEntries(p.region, queueRiot, p.tier, p.division ?? 'I', page);
      if (!batch.length) break;
      entries.push(...batch);
    }
  }
  const players = entries;
  await onProgress(0, players.length);

  const out = { players: 0, stored: 0, skipped: 0, existing: 0 };
  let done = 0;
  for (const e of players) {
    const puuid = await puuidOf(p.region, e);
    if (puuid) {
      const ids = await riot.matchIds(p.region, puuid, { queue: QUEUES[p.queue].id, count: p.matchesPerPlayer });
      for (const id of ids) {
        const r = await ingestMatch(p.region, id, { tierBucket: p.tier });
        if (r === 'stored') out.stored++;
        else if (r === 'skipped') out.skipped++;
        else out.existing++;
      }
      out.players++;
    }
    await onProgress(++done, players.length);
  }
  return out;
}
