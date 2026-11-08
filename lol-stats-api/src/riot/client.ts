import { config } from '../config.js';
import { AppError } from '../errors.js';
import { ROUTING, type Region } from '../domain.js';
import { RateLimiter } from './limiter.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class RiotNotFound extends Error {
  constructor(public path: string) {
    super(`Riot 404: ${path}`);
  }
}

// ---- response shapes (only the fields we read) ----
export interface RiotAccount { puuid: string; gameName: string; tagLine: string }
export interface RiotSummoner { puuid: string; profileIconId: number; summonerLevel: number; id?: string }
export interface RiotLeagueEntry {
  queueType: string; tier: string; rank: string; leaguePoints: number; wins: number; losses: number;
  puuid?: string; summonerId?: string;
}
export interface RiotPerkSelection { perk: number }
export interface RiotParticipant {
  puuid: string; riotIdGameName?: string; riotIdTagline?: string;
  championId: number; teamId: number; teamPosition: string; win: boolean;
  kills: number; deaths: number; assists: number;
  totalMinionsKilled: number; neutralMinionsKilled: number;
  goldEarned: number; totalDamageDealtToChampions: number; visionScore: number; champLevel: number;
  item0: number; item1: number; item2: number; item3: number; item4: number; item5: number; item6: number;
  summoner1Id: number; summoner2Id: number;
  perks: {
    statPerks: { offense: number; flex: number; defense: number };
    styles: { description: string; style: number; selections: RiotPerkSelection[] }[];
  };
}
export interface RiotMatch {
  metadata: { matchId: string; participants: string[] };
  info: {
    queueId: number; gameVersion: string; gameCreation: number; gameDuration: number;
    participants: RiotParticipant[];
    teams: { teamId: number; win: boolean; bans: { championId: number; pickTurn: number }[] }[];
  };
}
export interface RiotTimelineEvent {
  type: string; timestamp: number; participantId?: number;
  skillSlot?: number; levelUpType?: string; itemId?: number; beforeId?: number; afterId?: number;
}
export interface RiotTimeline {
  metadata: { participants: string[] };
  info: { frames: { events: RiotTimelineEvent[] }[] };
}

const limiters = new Map<string, RateLimiter>();
const limiterFor = (host: string) => {
  let l = limiters.get(host);
  if (!l) limiters.set(host, (l = new RateLimiter(config.riotLimits)));
  return l;
};

function urlFor(host: string, path: string, query: Record<string, string | number | undefined>) {
  const base = config.riotBaseUrl
    ? `${config.riotBaseUrl}/${host}`
    : `https://${host}.api.riotgames.com`;
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));
  return url;
}

/** `host` is a platform ("euw1") or a regional route ("europe"). */
async function riotGet<T>(
  host: string,
  path: string,
  query: Record<string, string | number | undefined> = {},
): Promise<T> {
  if (!config.riotApiKey && !config.riotBaseUrl) {
    throw new AppError(502, 'UPSTREAM_ERROR', 'RIOT_API_KEY is not configured on the server');
  }
  const limiter = limiterFor(host);

  for (let attempt = 0; ; attempt++) {
    await limiter.acquire();
    let res: Response;
    try {
      res = await fetch(urlFor(host, path, query), { headers: { 'X-Riot-Token': config.riotApiKey } });
    } catch (err) {
      if (attempt < 3) { await sleep(500 * 2 ** attempt); continue; }
      throw new AppError(502, 'UPSTREAM_ERROR', `Riot API unreachable: ${(err as Error).message}`);
    }

    if (res.ok) return (await res.json()) as T;
    if (res.status === 404) throw new RiotNotFound(path);

    if (res.status === 429 && attempt < 4) {
      const retryAfter = Number(res.headers.get('retry-after') ?? '1');
      limiter.blockFor(retryAfter * 1000 + 250);
      continue;
    }
    if (res.status >= 500 && attempt < 3) { await sleep(500 * 2 ** attempt); continue; }

    if (res.status === 401 || res.status === 403) {
      throw new AppError(502, 'UPSTREAM_ERROR', 'Riot rejected the API key (invalid or expired)');
    }
    throw new AppError(502, 'UPSTREAM_ERROR', `Riot API returned ${res.status}`);
  }
}

const enc = encodeURIComponent;

export const riot = {
  account: (region: Region, gameName: string, tagLine: string) =>
    riotGet<RiotAccount>(ROUTING[region], `/riot/account/v1/accounts/by-riot-id/${enc(gameName)}/${enc(tagLine)}`),

  summoner: (region: Region, puuid: string) =>
    riotGet<RiotSummoner>(region, `/lol/summoner/v4/summoners/by-puuid/${enc(puuid)}`),

  leagueEntries: (region: Region, puuid: string) =>
    riotGet<RiotLeagueEntry[]>(region, `/lol/league/v4/entries/by-puuid/${enc(puuid)}`),

  matchIds: (
    region: Region,
    puuid: string,
    q: { queue: number; start?: number; count: number; startTime?: number },
  ) => riotGet<string[]>(ROUTING[region], `/lol/match/v5/matches/by-puuid/${enc(puuid)}/ids`, q),

  match: (region: Region, matchId: string) =>
    riotGet<RiotMatch>(ROUTING[region], `/lol/match/v5/matches/${enc(matchId)}`),

  timeline: (region: Region, matchId: string) =>
    riotGet<RiotTimeline>(ROUTING[region], `/lol/match/v5/matches/${enc(matchId)}/timeline`),

  /** Players of one division (iron..diamond). */
  divisionEntries: (region: Region, queueRiot: string, tier: string, division: string, page: number) =>
    riotGet<RiotLeagueEntry[]>(region, `/lol/league/v4/entries/${queueRiot}/${tier.toUpperCase()}/${division}`, { page }),

  /** Players of master, grandmaster or challenger. */
  apexEntries: (region: Region, queueRiot: string, tier: 'master' | 'grandmaster' | 'challenger') =>
    riotGet<{ entries: RiotLeagueEntry[] }>(region, `/lol/league/v4/${tier}leagues/by-queue/${queueRiot}`),

  /** Fallback when a league entry has no puuid. */
  summonerBySummonerId: (region: Region, summonerId: string) =>
    riotGet<RiotSummoner>(region, `/lol/summoner/v4/summoners/${enc(summonerId)}`),
};
