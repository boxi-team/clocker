import 'dotenv/config';

const num = (v: string | undefined, d: number) => (v !== undefined && v !== '' ? Number(v) : d);

/** "20:1000,100:120000" -> [{max:20, windowMs:1000}, {max:100, windowMs:120000}] */
function parseLimits(v: string): { max: number; windowMs: number }[] {
  return v.split(',').map((part) => {
    const [max, windowMs] = part.split(':').map(Number);
    return { max, windowMs };
  });
}

export const config = {
  port: num(process.env.PORT, 3000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://lol:lol@localhost:5432/lolstats',
  adminToken: process.env.ADMIN_TOKEN ?? '',
  locale: process.env.DDRAGON_LOCALE ?? 'en_US',
  enableCron: (process.env.ENABLE_CRON ?? 'true') === 'true',
  enableWorker: (process.env.ENABLE_WORKER ?? 'true') === 'true',
  workerConcurrency: num(process.env.WORKER_CONCURRENCY, 2),

  ddragonBase: process.env.DDRAGON_BASE ?? 'https://ddragon.leagueoflegends.com',

  riotApiKey: process.env.RIOT_API_KEY ?? '',
  /** Test hook: when set, requests go to `${riotBaseUrl}/${host}${path}` instead of https://{host}.api.riotgames.com */
  riotBaseUrl: process.env.RIOT_BASE_URL ?? '',
  /** Riot app limits per host. Dev key: 20 per 1s and 100 per 2min. Raise for a production key. */
  riotLimits: parseLimits(process.env.RIOT_RATE_LIMITS ?? '20:1000,100:120000'),

  /** Share of ingested matches for which the (extra) timeline call is made. 0 to 1. */
  timelineSampleRate: num(process.env.TIMELINE_SAMPLE_RATE, 0.25),
  /** Matches imported for a player the first time they are seen, per queue. */
  firstImportCount: num(process.env.FIRST_IMPORT_COUNT, 20),
  refreshCooldownSeconds: num(process.env.REFRESH_COOLDOWN_SECONDS, 120),
  /** Rows with fewer games than this are flagged lowSample. */
  lowSampleGames: num(process.env.LOW_SAMPLE_GAMES, 100),
  /** Inbound limit per IP per minute. */
  inboundRateLimit: num(process.env.INBOUND_RATE_LIMIT, 120),
};
