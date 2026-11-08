import { pool } from './db.js';
import { config } from './config.js';
import { importPlayerMatches, fetchAndStorePlayer, getPlayerByPuuid } from './ingest/player.js';
import { crawlLadder, type CrawlPayload } from './ingest/crawl.js';

export type JobType = 'player_refresh' | 'crawl';

export interface JobRow {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  progress_done: number;
  progress_total: number;
  result: unknown;
  error: string | null;
  created_at: Date;
  finished_at: Date | null;
}

/** Queue a job. With a dedupe key, an already active job with that key is returned instead. */
export async function enqueue(
  type: JobType,
  payload: object,
  opts: { dedupeKey?: string; priority?: number } = {},
): Promise<JobRow> {
  const { rows } = await pool.query<JobRow>(
    `INSERT INTO jobs (type, payload, dedupe_key, priority) VALUES ($1,$2,$3,$4)
     ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('queued','running') DO NOTHING
     RETURNING *`,
    [type, JSON.stringify(payload), opts.dedupeKey ?? null, opts.priority ?? 0],
  );
  if (rows[0]) return rows[0];
  const existing = await pool.query<JobRow>(
    `SELECT * FROM jobs WHERE dedupe_key = $1 AND status IN ('queued','running') LIMIT 1`,
    [opts.dedupeKey],
  );
  return existing.rows[0];
}

export async function getJob(id: string): Promise<JobRow | null> {
  const { rows } = await pool.query<JobRow>('SELECT * FROM jobs WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function activeJobFor(dedupeKey: string): Promise<JobRow | null> {
  const { rows } = await pool.query<JobRow>(
    `SELECT * FROM jobs WHERE dedupe_key = $1 AND status IN ('queued','running') LIMIT 1`,
    [dedupeKey],
  );
  return rows[0] ?? null;
}

export const playerJobKey = (puuid: string) => `player:${puuid}`;

type Progress = (done: number, total: number) => Promise<void>;

async function run(job: JobRow, progress: Progress): Promise<unknown> {
  switch (job.type) {
    case 'player_refresh': {
      const { puuid, skipProfile } = job.payload as { puuid: string; skipProfile?: boolean };
      const player = await getPlayerByPuuid(puuid);
      if (!player) throw new Error('player vanished');
      // Re-read name, level and ranks from Riot (skipped right after the profile was just fetched).
      if (!skipProfile) await fetchAndStorePlayer(player.region, player.game_name, player.tag_line);
      return importPlayerMatches(puuid, progress);
    }
    case 'crawl':
      return crawlLadder(job.payload as unknown as CrawlPayload, progress);
  }
}

async function claim(): Promise<JobRow | null> {
  const { rows } = await pool.query<JobRow>(
    `UPDATE jobs SET status = 'running', started_at = now()
     WHERE id = (SELECT id FROM jobs WHERE status = 'queued'
                 ORDER BY priority DESC, created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
     RETURNING *`,
  );
  return rows[0] ?? null;
}

async function work(job: JobRow, log: { error: (o: unknown, m: string) => void }) {
  const progress: Progress = async (done, total) => {
    await pool.query('UPDATE jobs SET progress_done = $2, progress_total = $3 WHERE id = $1', [job.id, done, total]);
  };
  try {
    const result = await run(job, progress);
    await pool.query(
      `UPDATE jobs SET status = 'succeeded', result = $2, finished_at = now() WHERE id = $1`,
      [job.id, JSON.stringify(result ?? null)],
    );
  } catch (err) {
    log.error(err, `job ${job.id} (${job.type}) failed`);
    await pool.query(
      `UPDATE jobs SET status = 'failed', error = $2, finished_at = now() WHERE id = $1`,
      [job.id, (err as Error).message],
    );
  }
}

/** Polls the jobs table. Returns a function that stops the workers. */
export async function startWorker(log: { error: (o: unknown, m: string) => void }) {
  // Jobs left running by a crashed process can never finish.
  await pool.query(
    `UPDATE jobs SET status = 'failed', error = 'interrupted by restart', finished_at = now() WHERE status = 'running'`,
  );
  let stopped = false;
  const loops = Array.from({ length: config.workerConcurrency }, async () => {
    while (!stopped) {
      const job = await claim().catch(() => null);
      if (job) await work(job, log);
      else await new Promise((r) => setTimeout(r, 1000));
    }
  });
  return async () => {
    stopped = true;
    await Promise.all(loops);
  };
}
