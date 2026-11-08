/**
 * End-to-end test: real Postgres, mocked Riot + Data Dragon, real HTTP routes via app.inject().
 *
 *   createdb lolstats_test
 *   TEST_DATABASE_URL=postgres://lol:lol@localhost:5432/lolstats_test npm test
 *
 * The database name must end in _test because the test wipes the public schema.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMock } from './mock-riot.js';

const MOCK_PORT = 4010;
const here = path.dirname(fileURLToPath(import.meta.url));

const dbUrl = process.env.TEST_DATABASE_URL;
if (!dbUrl || !/_test$/.test(new URL(dbUrl).pathname.slice(1))) {
  throw new Error('Set TEST_DATABASE_URL to a database whose name ends in _test (it gets wiped).');
}

// Config is read at import time, so set the environment first.
process.env.DATABASE_URL = dbUrl;
process.env.DDRAGON_BASE = `http://localhost:${MOCK_PORT}/ddragon`;
process.env.RIOT_BASE_URL = `http://localhost:${MOCK_PORT}/riot`;
process.env.ADMIN_TOKEN = 'secret';
process.env.TIMELINE_SAMPLE_RATE = '1';
process.env.RIOT_RATE_LIMITS = '1000:1000';
process.env.INBOUND_RATE_LIMIT = '100000';
process.env.WORKER_CONCURRENCY = '2';

let failures = 0;
let passes = 0;
function check(name: string, cond: unknown, detail?: unknown) {
  if (cond) { passes++; console.log(`  ok   ${name}`); }
  else { failures++; console.log(`  FAIL ${name}${detail !== undefined ? '\n       got: ' + JSON.stringify(detail) : ''}`); }
}
const eq = (name: string, got: unknown, want: unknown) =>
  check(name, JSON.stringify(got) === JSON.stringify(want), { got, want });

const mock = await startMock(MOCK_PORT);

const { pool } = await import('../src/db.js');
const { config } = await import('../src/config.js');
const { buildApp } = await import('../src/app.js');
const { startWorker } = await import('../src/jobs.js');
const { RateLimiter } = await import('../src/riot/limiter.js');
const { wilsonScore } = await import('../src/queries/stats.js');

await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
const migDir = path.join(here, '../migrations');
for (const f of (await readdir(migDir)).filter((x) => x.endsWith('.sql')).sort()) {
  await pool.query(await readFile(path.join(migDir, f), 'utf8'));
}
await pool.query(await readFile(path.join(migDir, '002_players_matches_jobs.sql'), 'utf8')); // migrations must be re-runnable

const app = await buildApp({ logger: false });
const stopWorker = await startWorker({ error: (e, m) => console.log('worker error:', m, e) });

async function call(method: 'GET' | 'POST', url: string, opts: { headers?: Record<string, string>; payload?: unknown } = {}) {
  const res = await app.inject({ method, url, headers: opts.headers, payload: opts.payload as object });
  let body: any = null;
  try { body = res.json(); } catch { /* empty body */ }
  return { status: res.statusCode, body, headers: res.headers };
}
const get = (u: string) => call('GET', u);
async function waitJob(id: string, timeoutMs = 20000) {
  const t0 = Date.now();
  for (;;) {
    const { body } = await get(`/v1/jobs/${id}`);
    if (body.data.status === 'succeeded' || body.data.status === 'failed') return body.data;
    if (Date.now() - t0 > timeoutMs) throw new Error('job timeout');
    await new Promise((r) => setTimeout(r, 100));
  }
}
const P = '/v1/players/euw1/Tester/EUW';

try {
  console.log('\n# pure functions');
  const lim = new RateLimiter([{ max: 3, windowMs: 200 }]);
  const t0 = Date.now();
  for (let i = 0; i < 7; i++) await lim.acquire();
  check('rate limiter spaces 7 calls over >= 2 windows (3 per 200ms)', Date.now() - t0 >= 380, Date.now() - t0);
  check('wilsonScore(50/100) ~ 40.4', wilsonScore(50, 100) > 40 && wilsonScore(50, 100) < 41, wilsonScore(50, 100));
  check('wilsonScore ranks 60/100 above 6/10', wilsonScore(60, 100) > wilsonScore(6, 10));

  console.log('\n# before any data');
  let r = await get('/v1/health');
  eq('health ok', r.body, { data: { ok: true } });
  r = await get('/v1/champions');
  check('champions before sync -> 503 DATA_NOT_READY', r.status === 503 && r.body.error.code === 'DATA_NOT_READY', r.body);
  r = await get('/v1/nothing');
  check('unknown route -> 404 NOT_FOUND envelope', r.status === 404 && r.body.error.code === 'NOT_FOUND');

  console.log('\n# admin + static data');
  r = await call('POST', '/v1/admin/sync');
  check('sync without token -> 401', r.status === 401 && r.body.error.code === 'UNAUTHORIZED');
  r = await call('POST', '/v1/admin/sync', { headers: { 'x-admin-token': 'secret' } });
  eq('sync stores latest patch', r.body.data, { patch: '15.21.1', synced: true, champions: 5 });
  r = await call('POST', '/v1/admin/sync', { headers: { 'x-admin-token': 'secret' } });
  eq('second sync is a no-op', r.body.data.synced, false);
  r = await get('/v1/patches/latest');
  eq('latest patch', r.body.data.version, '15.21.1');
  r = await get('/v1/champions');
  check('champions list', r.status === 200 && r.body.data.length === 5 && r.body.meta.patch === '15.21.1', r.body.meta);
  check('champion has icon + splash urls', r.body.data[0].iconUrl.endsWith('/img/champion/Ahri.png') && r.body.data[0].splashUrl.endsWith('Ahri_0.jpg'), r.body.data[0]);
  r = await get('/v1/champions?tag=Mage');
  eq('tag filter', r.body.data.map((c: any) => c.id), ['Ahri', 'Lux']);
  r = await get('/v1/champions?search=zE');
  eq('search is case-insensitive', r.body.data.map((c: any) => c.id), ['Zed']);
  r = await get('/v1/champions/103');
  check('detail by key', r.body.data.id === 'Ahri' && r.body.data.lore === 'lore' && r.body.data.spells.length === 1, r.body.data);
  r = await get('/v1/champions/ahri');
  check('detail by id, case-insensitive', r.body.data.key === 103);
  r = await get('/v1/champions/Nope');
  check('unknown champion -> 404 CHAMPION_NOT_FOUND', r.status === 404 && r.body.error.code === 'CHAMPION_NOT_FOUND');
  r = await get('/v1/items');
  check('items served', r.status === 200 && r.body.data.data['3089'].name.includes('Rabadon'));
  r = await get('/v1/runes');
  check('runes served', r.status === 200 && r.body.data[0].id === 8100);
  r = await get('/v1/summoner-spells');
  check('summoner spells served', r.status === 200);

  console.log('\n# player profile + import job');
  r = await get('/v1/players/euw1/Nobody/EUW');
  check('unknown Riot ID -> 404 PLAYER_NOT_FOUND', r.status === 404 && r.body.error.code === 'PLAYER_NOT_FOUND', r.body);
  r = await get('/v1/players/xx1/Tester/EUW');
  check('bad region -> 400 INVALID_PARAMETER', r.status === 400 && r.body.error.code === 'INVALID_PARAMETER');
  r = await get(`${P}/stats`);
  check('stats before profile -> 404', r.status === 404 && r.body.error.code === 'PLAYER_NOT_FOUND');

  r = await get(P);
  const prof = r.body.data;
  check('profile 200', r.status === 200, r.body);
  check('profile fields', prof.puuid === 'P0' && prof.gameName === 'Tester' && prof.summonerLevel === 321 && prof.profileIconUrl.endsWith('/15.21.1/img/profileicon/29.png'), prof);
  eq('ranked: solo only (TFT ignored)', prof.ranked, [{ queue: 'ranked_solo', tier: 'EMERALD', division: 'II', leaguePoints: 55, wins: 60, losses: 40, winRate: 0.6 }]);
  check('new player has a pending import job', prof.matchesStatus === 'pending' && !!prof.jobId, prof);

  const job = await waitJob(prof.jobId);
  check('import job succeeded', job.status === 'succeeded', job);
  eq('import result: 14 stored (12 solo + 2 flex), 1 remake skipped', job.result, { stored: 14, skipped: 1, existing: 0 });
  eq('job progress is complete', job.progress, { done: 15, total: 15 });

  r = await get(P);
  check('profile now ready with 14 matches', r.body.data.matchesStatus === 'ready' && r.body.data.matchesIndexed === 14 && r.body.data.jobId === null, r.body.data);

  console.log('\n# refresh');
  r = await call('POST', `${P}/refresh`);
  check('refresh right after creation -> 429 REFRESH_COOLDOWN + Retry-After', r.status === 429 && r.body.error.code === 'REFRESH_COOLDOWN' && Number(r.headers['retry-after']) > 0, { b: r.body, h: r.headers['retry-after'] });
  config.refreshCooldownSeconds = 0;
  r = await call('POST', `${P}/refresh`);
  check('refresh -> 202 with job', r.status === 202 && r.body.data.type === 'player_refresh', r.body);
  const rj = await waitJob(r.body.data.id);
  check('refresh imports nothing new', rj.status === 'succeeded' && rj.result.stored === 0, rj);
  const { enqueue } = await import('../src/jobs.js');
  const j1 = await enqueue('crawl', { region: 'euw1', tier: 'iron', division: 'IV', pages: 1, matchesPerPlayer: 1, queue: 'ranked_solo' }, { dedupeKey: 'dedupe-test' });
  const j2 = await enqueue('crawl', {}, { dedupeKey: 'dedupe-test' });
  check('enqueue with the same dedupe key returns the active job', j1.id === j2.id);
  await pool.query(`UPDATE jobs SET status = 'failed' WHERE id = $1`, [j1.id]); // keep the worker away from it
  r = await call('POST', '/v1/players/euw1/Ghost/EUW/refresh');
  check('refresh of unknown player -> 404', r.status === 404);
  config.refreshCooldownSeconds = 120;

  console.log('\n# player endpoints');
  r = await get(`${P}/matches?count=5`);
  check('matches page', r.status === 200 && r.body.data.length === 5 && r.body.meta.total === 12 && r.body.meta.start === 0, r.body.meta);
  const m0 = r.body.data[0];
  check('matches newest first', m0.matchId === 'EUW1_1011' && r.body.data[4].matchId === 'EUW1_1007', r.body.data.map((m: any) => m.matchId));
  check('match fields', m0.championKey === 103 && m0.championId === 'Ahri' && m0.role === 'mid' && m0.cs === 190 && m0.kills === 5 && m0.queue === 'ranked_solo' && m0.items.length === 7 && m0.keystone === 8112 && m0.csPerMin > 5, m0);
  r = await get(`${P}/matches?start=10&count=5`);
  eq('matches pagination tail', r.body.data.map((m: any) => m.matchId), ['EUW1_1001', 'EUW1_1000']);
  r = await get(`${P}/matches?queue=ranked_flex`);
  check('flex matches', r.body.meta.total === 2, r.body.meta);
  r = await get(`${P}/matches?championId=Zed`);
  check('champion filter (id) -> none', r.body.meta.total === 0);
  r = await get(`${P}/matches?championId=103&role=mid`);
  check('champion filter (key) + role', r.body.meta.total === 12);
  r = await get(`${P}/matches?count=1000`);
  check('count > 100 -> 400', r.status === 400);

  r = await get(`${P}/stats`);
  const s = r.body.data;
  check('stats summary', s.summary.games === 12 && s.summary.wins === 6 && s.summary.winRate === 0.5 && s.summary.kda === 6 && s.summary.avgKills === 5, s.summary);
  check('stats byRole + last20', s.byRole.length === 1 && s.byRole[0].role === 'mid' && s.last20.games === 12 && s.last20.wins === 6, s);
  r = await get(`${P}/stats?patch=15.20`);
  check('stats on a patch with no games', r.body.data.summary.games === 0 && r.body.data.summary.winRate === 0);
  r = await get(`${P}/stats?patch=latest`);
  check('player patch=latest is rejected (major.minor only)', r.status === 400);

  r = await get(`${P}/champions`);
  check('per-champion list', r.body.data.length === 1 && r.body.data[0].championId === 'Ahri' && r.body.data[0].name === 'Ahri' && r.body.data[0].games === 12 && r.body.data[0].iconUrl.endsWith('Ahri.png'), r.body.data);
  r = await get(`${P}/champions/Ahri`);
  const d = r.body.data;
  check('per-champion detail', d.championKey === 103 && d.summary.games === 12 && d.topKeystones[0].keystone === 8112 && d.topKeystones[0].games === 12 && d.byRole[0].role === 'mid', d);
  eq('per-champion top items (completed only)', d.topItems.map((i: any) => i.itemId).sort(), [3089, 3157, 6655]);
  r = await get(`${P}/champions/Zed`);
  check('player has no games on Zed -> zeros, not an error', r.status === 200 && r.body.data.summary.games === 0);

  console.log('\n# champion analytics');
  r = await get('/v1/champions/Ahri/stats?minGames=1');
  const st = r.body.data;
  check('Ahri totalMatches = 12 (emerald_plus default)', r.body.meta.totalMatches === 12 && r.body.meta.tier === 'emerald_plus' && r.body.meta.patch === '15.21', r.body.meta);
  check('Ahri overall', st.overall.games === 12 && st.overall.pickRate === 1 && st.overall.banRate === 0 && st.overall.winRate === 0.5 && st.overall.lowSample === true, st.overall);
  check('Ahri byRole', st.byRole.length === 1 && st.byRole[0].role === 'mid' && st.byRole[0].roleRate === 1 && st.byRole[0].pickRate === 0.5, st.byRole);
  r = await get('/v1/champions/Zed/stats');
  check('Zed ban rate counts a match once even if both teams ban', r.body.data.overall.banRate === 1 && r.body.data.overall.winRate === 0.5, r.body.data.overall);
  r = await get('/v1/champions/Ahri/stats?tier=gold');
  check('no gold matches yet -> zeros', r.body.data.overall.games === 0 && r.body.meta.totalMatches === 0);
  r = await get('/v1/champions/Ahri/stats?queue=ranked_flex');
  check('flex matches are "unranked" (player has no flex rank), so emerald_plus excludes them', r.body.meta.totalMatches === 0, r.body.meta);
  r = await get('/v1/champions/Ahri/stats?queue=ranked_flex&tier=all');
  check('flex queue filter', r.body.meta.totalMatches === 2 && r.body.data.overall.games === 2, r.body.meta);
  r = await get('/v1/champions/Ahri/stats?role=top');
  check('role filter with no data', r.body.data.overall.games === 0 && r.body.data.byRole.length === 0);
  r = await get('/v1/champions/Ahri/stats?region=na1');
  check('region filter', r.body.data.overall.games === 0);
  r = await get('/v1/champions/Ahri/stats?tier=banana');
  check('bad tier -> 400 with details', r.status === 400 && r.body.error.code === 'INVALID_PARAMETER' && r.body.error.details[0].path === 'tier', r.body);
  r = await get('/v1/champions/Ahri/stats?patch=15');
  check('bad patch -> 400', r.status === 400);

  r = await get('/v1/champions/Ahri/builds');
  const b = r.body.data;
  check('builds: role auto-resolved to mid, 12 games', b.role === 'mid' && b.games === 12 && b.winRate === 0.5, { role: b.role, games: b.games });
  check('builds: runes', b.runes.length === 1 && b.runes[0].keystone === 8112 && b.runes[0].primaryStyle === 8100 && b.runes[0].subStyle === 8200 && JSON.stringify(b.runes[0].statShards) === '[5008,5008,5002]' && b.runes[0].pickRate === 1, b.runes);
  eq('builds: summoner spells', b.summonerSpells.map((x: any) => x.spellIds), [[4, 14]]);
  eq('builds: boots', b.boots.map((x: any) => [x.itemId, x.games]), [[3020, 12]]);
  eq('builds: items exclude boots, trinket, consumable, Doran', b.items.map((x: any) => x.itemId).sort(), [3089, 3157, 6655]);
  eq('builds: core set = 3 most expensive, ascending', b.coreSets.map((x: any) => x.itemIds), [[3089, 3157, 6655]]);
  check('builds: skill order from timelines', b.skillOrder?.sampleSize === 12 && b.skillOrder.orders[0].maxOrder === 'Q>E>W' && b.skillOrder.orders[0].sequence === 'QWEQQRQEQEREEWW' && b.skillOrder.orders[0].games === 12, b.skillOrder);
  eq('builds: starting items (undo handled, other players ignored)', b.startingItems?.sets.map((x: any) => x.itemIds), [[1055, 2003]]);
  r = await get('/v1/champions/Ahri/builds?role=top');
  check('builds for a role with no games -> empty, null skill/start', r.body.data.role === 'top' && r.body.data.games === 0 && r.body.data.runes.length === 0 && r.body.data.skillOrder === null && r.body.data.startingItems === null, r.body.data);
  r = await get('/v1/champions/Garen/builds?tier=gold');
  check('builds with no matches in filter', r.body.data.role === null && r.body.data.games === 0 && r.body.data.skillOrder === null && r.body.data.startingItems === null, r.body.data);

  r = await get('/v1/champions/Ahri/builds?vs=Zed');
  check('builds vs Zed (lane opponent): same 12 games, vs fields set', r.body.data.games === 12 && r.body.data.role === 'mid' && r.body.data.vsChampionId === 'Zed' && r.body.data.vsChampionKey === 238 && r.body.data.coreSets.length === 1, r.body.data);
  r = await get('/v1/champions/Ahri/builds?vs=238');
  check('builds vs accepts champion key', r.status === 200 && r.body.data.games === 12 && r.body.data.vsChampionId === 'Zed', r.body.data);
  r = await get('/v1/champions/Ahri/builds?vs=Garen');
  check('builds vs a champion never faced -> role kept, 0 games, empty', r.status === 200 && r.body.data.role === 'mid' && r.body.data.games === 0 && r.body.data.runes.length === 0 && r.body.data.skillOrder === null && r.body.data.startingItems === null, r.body.data);
  r = await get('/v1/champions/Ahri/builds');
  check('builds without vs -> vs fields null', r.body.data.vsChampionId === null && r.body.data.vsChampionKey === null && r.body.data.games === 12, r.body.data);
  r = await get('/v1/champions/Ahri/builds?vs=Nobody');
  check('builds vs unknown champion -> 404', r.status === 404, r.body);

  r = await get('/v1/champions/Ahri/matchups?minGames=1');
  eq('matchups vs lane opponent (Zed)', r.body.data.matchups, [{ opponentKey: 238, games: 12, wins: 6, winRate: 0.5, opponentId: 'Zed' }]);
  check('matchups role', r.body.data.role === 'mid');
  r = await get('/v1/champions/Ahri/matchups');
  check('matchups hides rows under minGames (default 100)', r.body.data.matchups.length === 0);
  r = await get('/v1/champions/Zed/matchups?minGames=1');
  eq('reverse matchup', r.body.data.matchups.map((m: any) => [m.opponentId, m.wins]), [['Ahri', 6]]);

  r = await get('/v1/tier-list?minGames=1');
  check('tier list meta', r.status === 200 && r.body.meta.totalMatches === 12, r.body.meta);
  eq('tier list skips champions without static data (keys 11, 64, 24, 51, 12)', r.body.data.map((e: any) => e.championId).sort(), ['Ahri', 'Garen', 'Jinx', 'Lux', 'Zed']);
  eq('tier list ranks are 1..n', r.body.data.map((e: any) => e.rank), [1, 2, 3, 4, 5]);
  const ahri = r.body.data.find((e: any) => e.championId === 'Ahri');
  check('tier list entry', ahri.games === 12 && ahri.winRate === 0.5 && ahri.pickRate === 0.5 && ahri.banRate === 0 && ahri.score > 0 && ahri.score < 50, ahri);
  const zed = r.body.data.find((e: any) => e.championId === 'Zed');
  check('tier list ban rate', zed.banRate === 1);
  r = await get('/v1/tier-list?minGames=1&sort=banRate');
  check('tier list sort by banRate puts Zed first', r.body.data[0].championId === 'Zed');
  r = await get('/v1/tier-list');
  check('tier list default minGames=100 hides everything', r.body.data.length === 0);
  r = await get('/v1/tier-list?minGames=1&role=top');
  eq('tier list role filter', r.body.data.map((e: any) => [e.championId, e.role]), [['Garen', 'top']]);

  console.log('\n# matches');
  r = await get('/v1/matches/euw1/EUW1_1000');
  const md = r.body.data;
  check('match detail', r.status === 200 && md.matchId === 'EUW1_1000' && md.queue === 'ranked_solo' && md.patch === '15.21' && md.winningTeamId === 100 && md.tierBucket === 'emerald', md);
  check('two teams x five players, ordered by role', md.teams.length === 2 && md.teams.every((t: any) => t.participants.length === 5) && md.teams[0].participants.map((p: any) => p.role).join() === 'top,jungle,mid,adc,support', md.teams.map((t: any) => t.participants.map((p: any) => p.role)));
  eq('bans exclude "no ban" (-1)', md.teams.map((t: any) => t.bans), [[238], [238, 91]]);
  const tester = md.teams[0].participants[2];
  check('participant fields', tester.puuid === 'P0' && tester.gameName === 'Tester' && tester.championId === 'Ahri' && tester.runes.keystone === 8112 && tester.damageToChampions === 22000, tester);
  r = await get('/v1/matches/euw1/EUW1_2000');
  check('flex match', r.body.data.queue === 'ranked_flex');
  r = await get('/v1/matches/na1/EUW1_1000');
  check('region/match-id mismatch -> 400', r.status === 400 && r.body.error.code === 'INVALID_PARAMETER');
  r = await get('/v1/matches/euw1/EUW1_9999');
  check('unknown match -> 404 MATCH_NOT_FOUND', r.status === 404 && r.body.error.code === 'MATCH_NOT_FOUND', r.body);
  r = await get('/v1/matches/euw1/EUW1_4000');
  check('non-ranked match -> 422 UNSUPPORTED_MATCH', r.status === 422 && r.body.error.code === 'UNSUPPORTED_MATCH', r.body);
  r = await get('/v1/matches/euw1/EUW1_3000');
  check('remake -> 422', r.status === 422);
  r = await get('/v1/matches/euw1/not-an-id');
  check('malformed match id -> 400', r.status === 400);

  console.log('\n# crawl + jobs');
  r = await call('POST', '/v1/admin/crawl', { payload: { region: 'euw1', tier: 'gold', division: 'I' } });
  check('crawl without token -> 401', r.status === 401);
  r = await call('POST', '/v1/admin/crawl', { headers: { 'x-admin-token': 'secret' }, payload: { region: 'euw1', tier: 'gold' } });
  check('crawl without division -> 400', r.status === 400 && r.body.error.code === 'INVALID_PARAMETER');
  r = await call('POST', '/v1/admin/crawl', { headers: { 'x-admin-token': 'secret' }, payload: { region: 'euw1', tier: 'gold', division: 'I', matchesPerPlayer: 5 } });
  check('crawl accepted', r.status === 202 && r.body.data.type === 'crawl', r.body);
  const cj = await waitJob(r.body.data.id);
  check('crawl result', cj.status === 'succeeded' && cj.result.players === 1 && cj.result.stored === 3 && cj.result.skipped === 0, cj);
  r = await get('/v1/champions/Ahri/stats?tier=gold');
  check('crawled matches are bucketed by the crawled tier', r.body.meta.totalMatches === 3 && r.body.data.overall.games === 3, r.body.meta);
  r = await get('/v1/champions/Ahri/stats?tier=all');
  check('tier=all sees every bucket', r.body.meta.totalMatches === 15, r.body.meta);
  r = await get('/v1/champions/Ahri/stats?tier=emerald_plus');
  check('emerald_plus excludes gold', r.body.meta.totalMatches === 12);
  r = await get('/v1/jobs/00000000-0000-4000-8000-000000000000');
  check('unknown job -> 404', r.status === 404 && r.body.error.code === 'JOB_NOT_FOUND');
  r = await get('/v1/jobs/nope');
  check('malformed job id -> 400', r.status === 400);

  console.log('\n# robustness');
  const calls: string[] = await (await fetch(`http://localhost:${MOCK_PORT}/__calls`)).json();
  const matchCalls = calls.filter((c) => /matches\/EUW1_1000$/.test(c)).length;
  check('a match is fetched from Riot only once (cache in DB)', matchCalls === 1, matchCalls);
  const { rows: dupes } = await pool.query(`SELECT match_id FROM match_participants GROUP BY match_id, puuid HAVING count(*) > 1`);
  check('no duplicate participants', dupes.length === 0);
} finally {
  await stopWorker();
  await app.close();
  await pool.end();
  mock.close();
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
