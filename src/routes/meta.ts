import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db.js';
import { notFound } from '../errors.js';
import { ok, resolveStaticPatch } from '../http.js';
import { patchChanges } from '../patchDiff.js';

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
      `SELECT version, locale, synced_at AS "syncedAt" FROM patches ORDER BY string_to_array(version, '.')::int[] DESC`,
    );
    return { data: rows };
  });

  const patchWithChanges = async (version: string) => {
    const { rows } = await pool.query(
      `SELECT version, locale, synced_at AS "syncedAt" FROM patches WHERE version = $1`,
      [version],
    );
    if (!rows[0]) throw notFound('NOT_FOUND', `Patch ${version} is not synced`);
    // `changes` is null for the oldest synced patch (nothing to compare with).
    return { data: { ...rows[0], changes: await patchChanges(version) } };
  };

  app.get('/patches/latest', async () => patchWithChanges(await resolveStaticPatch('latest')));

  app.get('/patches/:version', async (req) =>
    patchWithChanges(z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/) }).parse(req.params).version),
  );

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
