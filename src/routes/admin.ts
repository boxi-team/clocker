import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { TIER_BUCKETS, queueSchema, regionSchema } from '../domain.js';
import { AppError } from '../errors.js';
import { requireAdmin } from '../http.js';
import { enqueue } from '../jobs.js';
import { syncChampions } from '../sync.js';
import { toJob } from './jobs.js';

const crawlBody = z.object({
  region: regionSchema,
  queue: queueSchema.default('ranked_solo'),
  tier: z.enum(TIER_BUCKETS),
  division: z.enum(['I', 'II', 'III', 'IV']).optional(),
  pages: z.number().int().min(1).max(20).default(1),
  matchesPerPlayer: z.number().int().min(1).max(100).default(10),
});

export async function adminRoutes(app: FastifyInstance) {
  app.post('/admin/sync', async (req) => {
    requireAdmin(req.headers['x-admin-token'], config.adminToken);
    const { force, version } = z
      .object({
        force: z.enum(['true', 'false']).default('false'),
        version: z.string().regex(/^\d+\.\d+\.\d+$/).optional(), // e.g. 16.21.1, to back-fill an older patch
      })
      .parse(req.query);
    return { data: await syncChampions(force === 'true', version) };
  });

  app.post('/admin/crawl', async (req, reply) => {
    requireAdmin(req.headers['x-admin-token'], config.adminToken);
    const body = crawlBody.parse(req.body);
    const apex = ['master', 'grandmaster', 'challenger'].includes(body.tier);
    if (!apex && !body.division) {
      throw new AppError(400, 'INVALID_PARAMETER', 'division is required for iron through diamond');
    }
    const job = await enqueue('crawl', body, { priority: 0 });
    return reply.code(202).send({ data: toJob(job) });
  });
}
