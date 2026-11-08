import cron from 'node-cron';
import { buildApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { startWorker } from './jobs.js';
import { syncChampions } from './sync.js';

const app = await buildApp();

async function runSync() {
  try {
    app.log.info(await syncChampions(), 'static data sync finished');
  } catch (err) {
    app.log.error(err, 'static data sync failed');
  }
}

if (config.enableCron) {
  void runSync(); // check once on boot
  cron.schedule('0 * * * *', () => void runSync()); // then hourly; one request when there is no new patch
}

const stopWorker = config.enableWorker ? await startWorker(app.log) : async () => undefined;

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    await stopWorker();
    await pool.end();
    process.exit(0);
  });
}

await app.listen({ port: config.port, host: '0.0.0.0' });
