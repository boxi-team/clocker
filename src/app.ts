import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { config } from './config.js';
import { registerErrorHandling } from './errors.js';
import { adminRoutes } from './routes/admin.js';
import { championRoutes } from './routes/champions.js';
import { jobRoutes } from './routes/jobs.js';
import { matchRoutes } from './routes/matches.js';
import { metaRoutes } from './routes/meta.js';
import { playerRoutes } from './routes/players.js';

export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? true });
  registerErrorHandling(app);

  await app.register(cors, { origin: true });
  await app.register(rateLimit, { max: config.inboundRateLimit, timeWindow: '1 minute' });

  await app.register(
    async (v1) => {
      await v1.register(metaRoutes);
      await v1.register(championRoutes);
      await v1.register(playerRoutes);
      await v1.register(matchRoutes);
      await v1.register(jobRoutes);
      await v1.register(adminRoutes);
    },
    { prefix: '/v1' },
  );
  return app;
}
