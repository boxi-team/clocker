import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db.js';
import { QUEUES, analyticsQuery, minGamesSchema, tierFilterToBuckets } from '../domain.js';
import { championImageUrl, splashUrl } from '../ddragon.js';
import { notFound } from '../errors.js';
import { championIndex, ok, resolveAnalyticsPatch, resolveChampion, resolveStaticPatch } from '../http.js';
import {
  championBuilds, championMatchups, championStats, tierList, totalMatches, type Filter,
} from '../queries/stats.js';

const staticQuery = z.object({
  patch: z.string().regex(/^(latest|\d+\.\d+\.\d+)$/).default('latest'),
  tag: z.enum(['Assassin', 'Fighter', 'Mage', 'Marksman', 'Support', 'Tank']).optional(),
  search: z.string().max(32).optional(),
});

interface ChampionRow {
  key: number; patch: string; id: string; name: string; title: string; blurb: string; lore: string;
  tags: string[]; partype: string; info: unknown; stats: unknown; spells: unknown; passive: unknown;
  skins: unknown; image: { full: string };
}

const summary = (r: ChampionRow) => ({
  key: r.key, id: r.id, name: r.name, title: r.title, blurb: r.blurb, tags: r.tags, partype: r.partype,
  info: r.info, stats: r.stats,
  iconUrl: championImageUrl(r.patch, r.image.full),
  splashUrl: splashUrl(r.id),
});

async function toFilter(raw: unknown): Promise<{ filter: Filter; meta: Record<string, unknown> }> {
  const q = analyticsQuery.parse(raw);
  const patch = await resolveAnalyticsPatch(q.patch);
  const filter: Filter = {
    patch,
    queueId: QUEUES[q.queue].id,
    tiers: tierFilterToBuckets(q.tier),
    region: q.region === 'all' ? null : q.region,
    role: q.role,
  };
  return { filter, meta: { patch, tier: q.tier, queue: q.queue, region: q.region } };
}

export async function championRoutes(app: FastifyInstance) {
  // ---- static ----
  app.get('/champions', async (req, reply) => {
    const q = staticQuery.parse(req.query);
    const patch = await resolveStaticPatch(q.patch);
    const params: unknown[] = [patch];
    let where = 'patch = $1';
    if (q.tag) where += ` AND $${params.push(q.tag)} = ANY(tags)`;
    if (q.search) where += ` AND name ILIKE $${params.push(`%${q.search}%`)}`;
    const { rows } = await pool.query<ChampionRow>(
      `SELECT key, patch, id, name, title, blurb, tags, partype, info, stats, image
       FROM champions WHERE ${where} ORDER BY name`,
      params,
    );
    reply.header('Cache-Control', 'public, max-age=300');
    return ok(rows.map(summary), { patch });
  });

  app.get<{ Params: { idOrKey: string } }>('/champions/:idOrKey', async (req, reply) => {
    const q = staticQuery.pick({ patch: true }).parse(req.query);
    const patch = await resolveStaticPatch(q.patch);
    const ref = await resolveChampion(req.params.idOrKey);
    const { rows } = await pool.query<ChampionRow>('SELECT * FROM champions WHERE key = $1 AND patch = $2', [ref.key, patch]);
    if (!rows[0]) throw notFound('CHAMPION_NOT_FOUND', `${ref.name} does not exist in patch ${patch}`);
    reply.header('Cache-Control', 'public, max-age=300');
    return ok(
      { ...summary(rows[0]), lore: rows[0].lore, passive: rows[0].passive, spells: rows[0].spells, skins: rows[0].skins },
      { patch },
    );
  });

  // ---- analytics ----
  app.get<{ Params: { idOrKey: string } }>('/champions/:idOrKey/stats', async (req, reply) => {
    const champ = await resolveChampion(req.params.idOrKey);
    const { filter, meta } = await toFilter(req.query);
    const { totalMatches: total, ...data } = await championStats(filter, champ.key);
    reply.header('Cache-Control', 'public, max-age=300');
    return ok({ championKey: champ.key, championId: champ.id, ...data }, { ...meta, totalMatches: total });
  });

  app.get<{ Params: { idOrKey: string } }>('/champions/:idOrKey/builds', async (req, reply) => {
    const champ = await resolveChampion(req.params.idOrKey);
    const { filter, meta } = await toFilter(req.query);
    const vs = (req.query as { vs?: string }).vs;
    const opponent = vs ? await resolveChampion(vs) : null;
    const [data, total] = await Promise.all([
      championBuilds(filter, champ.key, opponent?.key),
      totalMatches(filter),
    ]);
    reply.header('Cache-Control', 'public, max-age=300');
    return ok(
      {
        championKey: champ.key, championId: champ.id,
        vsChampionKey: opponent?.key ?? null, vsChampionId: opponent?.id ?? null,
        ...data,
      },
      { ...meta, totalMatches: total },
    );
  });

  app.get<{ Params: { idOrKey: string } }>('/champions/:idOrKey/matchups', async (req, reply) => {
    const champ = await resolveChampion(req.params.idOrKey);
    const minGames = minGamesSchema.parse((req.query as { minGames?: string }).minGames);
    const { filter, meta } = await toFilter(req.query);
    const [{ role, rows }, index, total] = await Promise.all([
      championMatchups(filter, champ.key, minGames),
      championIndex(),
      totalMatches(filter),
    ]);
    reply.header('Cache-Control', 'public, max-age=300');
    return ok(
      {
        championKey: champ.key,
        championId: champ.id,
        role,
        matchups: rows.map((r) => ({ ...r, opponentId: index.byKey.get(r.opponentKey)?.id ?? String(r.opponentKey) })),
      },
      { ...meta, totalMatches: total },
    );
  });

  const tierQuery = z.object({
    minGames: minGamesSchema,
    sort: z.enum(['score', 'winRate', 'pickRate', 'banRate', 'games']).default('score'),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  });

  app.get('/tier-list', async (req, reply) => {
    const { minGames, sort, limit } = tierQuery.parse(req.query);
    const { filter, meta } = await toFilter(req.query);
    const [{ totalMatches: total, rows }, index] = await Promise.all([tierList(filter, minGames), championIndex()]);
    const sorted = rows
      .filter((r) => index.byKey.has(r.championKey))
      .sort((a, b) => b[sort] - a[sort] || b.games - a.games)
      .slice(0, limit)
      .map((r, i) => {
        const c = index.byKey.get(r.championKey)!;
        return {
          rank: i + 1, championKey: r.championKey, championId: c.id, name: c.name, role: r.role,
          games: r.games, winRate: r.winRate, pickRate: r.pickRate, banRate: r.banRate, score: r.score,
          iconUrl: championImageUrl(index.patch, c.image.full),
        };
      });
    reply.header('Cache-Control', 'public, max-age=300');
    return ok(sorted, { ...meta, totalMatches: total });
  });
}
