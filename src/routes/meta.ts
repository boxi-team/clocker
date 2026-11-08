import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db.js';
import { notFound } from '../errors.js';
import { ok, resolveStaticPatch } from '../http.js';

const assetQuery = z.object({
  patch: z.string().regex(/^(latest|\d+\.\d+\.\d+)$/).default('latest'),
});

export async function metaRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    await pool.query('SELECT 1');
    return { data: { ok: true } };
  });

  app.get('/patches', async () => {
    const { rows } = await pool.query(
      `SELECT version, locale, synced_at AS "syncedAt" FROM patches ORDER BY synced_at DESC, version DESC`,
    );
    return { data: rows };
  });

  app.get('/patches/latest', async () => {
    const v = await resolveStaticPatch('latest');
    const { rows } = await pool.query(
      `SELECT version, locale, synced_at AS "syncedAt" FROM patches WHERE version = $1`,
      [v],
    );
    return { data: rows[0] };
  });

  const asset = (path: string, kind: 'items' | 'runes' | 'spells') =>
    app.get(path, async (req, reply) => {
      const patch = await resolveStaticPatch(assetQuery.parse(req.query).patch);
      const { rows } = await pool.query<{ data: unknown }>(
        'SELECT data FROM static_assets WHERE version = $1 AND kind = $2',
        [patch, kind],
      );
      if (!rows[0]) throw notFound('NOT_FOUND', `No ${kind} data for patch ${patch}`);
      reply.header('Cache-Control', 'public, max-age=3600');
      return ok(rows[0].data, { patch });
    });

  asset('/items', 'items');
  asset('/runes', 'runes');
  asset('/summoner-spells', 'spells');
}
