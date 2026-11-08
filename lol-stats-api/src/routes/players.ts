import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { pool, latestPatch } from '../db.js';
import { QUEUES, playerParams, queueSchema, roleSchema } from '../domain.js';
import { championImageUrl, profileIconUrl } from '../ddragon.js';
import { AppError, dataNotReady, notFound } from '../errors.js';
import { championIndex, ok, resolveChampion } from '../http.js';
import { activeJobFor, enqueue, playerJobKey } from '../jobs.js';
import { fetchAndStorePlayer, findPlayer, type PlayerRow } from '../ingest/player.js';
import {
  countIndexed, listMatches, playerChampionDetail, playerChampions, playerStats, type PlayerFilter,
} from '../queries/player.js';
import { toJob } from './jobs.js';

const patchQuery = z.string().regex(/^\d+\.\d+$/).optional();

async function requirePlayer(params: unknown): Promise<PlayerRow> {
  const p = playerParams.parse(params);
  const player = await findPlayer(p.region, p.gameName, p.tagLine);
  if (!player) {
    throw notFound('PLAYER_NOT_FOUND', `${p.gameName}#${p.tagLine} is not loaded yet. GET the player profile first.`);
  }
  return player;
}

async function profile(player: PlayerRow) {
  const version = await latestPatch();
  if (!version) throw dataNotReady();
  const [ranks, indexed, job] = await Promise.all([
    pool.query(
      `SELECT queue, tier, division, league_points AS "leaguePoints", wins, losses
       FROM player_ranks WHERE puuid = $1 ORDER BY queue`,
      [player.puuid],
    ),
    countIndexed(player.puuid),
    activeJobFor(playerJobKey(player.puuid)),
  ]);
  return {
    puuid: player.puuid,
    region: player.region,
    gameName: player.game_name,
    tagLine: player.tag_line,
    summonerLevel: player.summoner_level ?? 0,
    profileIconId: player.profile_icon_id ?? 0,
    profileIconUrl: profileIconUrl(version, player.profile_icon_id ?? 0),
    ranked: ranks.rows.map((r: { wins: number; losses: number }) => ({
      ...r,
      winRate: r.wins + r.losses ? Math.round((r.wins / (r.wins + r.losses)) * 10000) / 10000 : 0,
    })),
    matchesStatus: job ? 'pending' : indexed > 0 ? 'ready' : 'empty',
    matchesIndexed: indexed,
    jobId: job?.id ?? null,
    lastRefreshedAt: player.last_refreshed_at,
  };
}

async function startRefresh(player: PlayerRow, skipProfile: boolean) {
  await pool.query('UPDATE players SET last_refresh_requested_at = now() WHERE puuid = $1', [player.puuid]);
  return enqueue('player_refresh', { puuid: player.puuid, skipProfile }, {
    dedupeKey: playerJobKey(player.puuid),
    priority: 10,
  });
}

export async function playerRoutes(app: FastifyInstance) {
  const base = '/players/:region/:gameName/:tagLine';

  // ---- profile (creates the player on first sight) ----
  app.get(base, async (req, reply) => {
    const p = playerParams.parse(req.params);
    let player = await findPlayer(p.region, p.gameName, p.tagLine);
    if (!player) {
      player = await fetchAndStorePlayer(p.region, p.gameName, p.tagLine);
      await startRefresh(player, true);
    }
    reply.header('Cache-Control', 'public, max-age=30');
    return ok(await profile(player));
  });

  // ---- refresh ("Update" button) ----
  app.post(`${base}/refresh`, async (req, reply) => {
    const player = await requirePlayer(req.params);

    const active = await activeJobFor(playerJobKey(player.puuid));
    if (active) return reply.code(202).send({ data: toJob(active) });

    if (player.last_refresh_requested_at) {
      const elapsed = (Date.now() - player.last_refresh_requested_at.getTime()) / 1000;
      const wait = Math.ceil(config.refreshCooldownSeconds - elapsed);
      if (wait > 0) {
        throw new AppError(429, 'REFRESH_COOLDOWN', `Player was refreshed recently. Try again in ${wait}s.`, undefined, wait);
      }
    }
    const job = await startRefresh(player, false);
    return reply.code(202).send({ data: toJob(job) });
  });

  // ---- match list ----
  const matchesQuery = z.object({
    queue: queueSchema.default('ranked_solo'),
    championId: z.string().optional(),
    role: roleSchema.optional(),
    start: z.coerce.number().int().min(0).default(0),
    count: z.coerce.number().int().min(1).max(100).default(20),
  });

  app.get(`${base}/matches`, async (req) => {
    const player = await requirePlayer(req.params);
    const q = matchesQuery.parse(req.query);
    const champ = q.championId ? await resolveChampion(q.championId) : null;
    const filter: PlayerFilter = {
      puuid: player.puuid, queueId: QUEUES[q.queue].id, championKey: champ?.key, role: q.role,
    };
    const { total, rows } = await listMatches(filter, q.start, q.count, await latestPatch());
    const queueName = q.queue;
    const data = rows.map((r) => ({
      matchId: r.match_id,
      queue: queueName,
      patch: r.patch,
      gameCreation: Number(r.game_creation),
      gameDuration: r.game_duration,
      win: r.win,
      championKey: r.champion_id,
      championId: r.champion_name ?? null,
      role: r.role,
      kills: r.kills, deaths: r.deaths, assists: r.assists,
      cs: r.cs,
      csPerMin: Math.round((r.cs / (r.game_duration / 60)) * 100) / 100,
      gold: r.gold,
      damageToChampions: r.damage,
      visionScore: r.vision_score,
      champLevel: r.champ_level,
      items: r.items,
      summonerSpells: [r.spell1, r.spell2],
      keystone: r.keystone,
    }));
    return ok(data, { start: q.start, count: data.length, total });
  });

  // ---- aggregate stats ----
  const statsQuery = z.object({ queue: queueSchema.default('ranked_solo'), patch: patchQuery });

  app.get(`${base}/stats`, async (req) => {
    const player = await requirePlayer(req.params);
    const q = statsQuery.parse(req.query);
    const data = await playerStats({ puuid: player.puuid, queueId: QUEUES[q.queue].id, patch: q.patch });
    return ok(data, { patch: q.patch });
  });

  // ---- per champion ----
  const championsQuery = statsQuery.extend({
    role: roleSchema.optional(),
    sort: z.enum(['games', 'winRate', 'kda']).default('games'),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  });

  app.get(`${base}/champions`, async (req) => {
    const player = await requirePlayer(req.params);
    const q = championsQuery.parse(req.query);
    const rows = await playerChampions(
      { puuid: player.puuid, queueId: QUEUES[q.queue].id, patch: q.patch, role: q.role },
      q.sort,
      q.limit,
    );
    const index = await championIndex();
    const data = rows.map((r) => {
      const c = index.byKey.get(r.championKey);
      return {
        ...r,
        championId: c?.id ?? null,
        name: c?.name ?? null,
        iconUrl: c ? championImageUrl(index.patch, c.image.full) : null,
      };
    });
    return ok(data, { patch: q.patch });
  });

  app.get<{ Params: { region: string; gameName: string; tagLine: string; idOrKey: string } }>(
    `${base}/champions/:idOrKey`,
    async (req) => {
      const player = await requirePlayer(req.params);
      const q = statsQuery.parse(req.query);
      const champ = await resolveChampion(req.params.idOrKey);
      const data = await playerChampionDetail({
        puuid: player.puuid, queueId: QUEUES[q.queue].id, patch: q.patch, championKey: champ.key,
      });
      return ok({ championKey: champ.key, championId: champ.id, ...data }, { patch: q.patch });
    },
  );
}
