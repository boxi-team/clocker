# API: champion, build and player stats for the LoL stats site

**Type:** Story  **Component:** Backend / API  **Contract:** `docs/openapi.yaml` (OpenAPI 3.1, source of truth for request and response shapes)

## Summary

Build the backend API for an op.gg-style League of Legends site. It must serve:

- champion data (static info, win/pick/ban rates, builds, matchups, tier list)
- player data (profile, ranks, match history, overall stats, stats per champion)
- match detail

Riot's API only returns raw data. Everything statistical is computed by us from ranked matches we ingest.

## Where each piece of data comes from

| Data | Source | How |
|---|---|---|
| Champions, items, runes, summoner spells | Data Dragon (no key, no limit) | Synced per patch, stored in Postgres |
| Player profile, ranks | Riot `account-v1`, `summoner-v4`, `league-v4` | Fetched on first lookup and on refresh |
| Matches (ranked Solo/Duo 420, Flex 440) | Riot `match-v5` (+ timeline for a sample) | Imported per player and by ladder crawl, stored once |
| Win/pick/ban rate, builds, matchups, tier list, player stats | **Computed by us** from stored matches | SQL over `match_participants` |

## Endpoints (all under `/v1`, JSON, `{ data, meta }` envelope)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health`, `/patches`, `/patches/latest` | Service and data status |
| GET | `/items`, `/runes`, `/summoner-spells` | Static data per patch |
| GET | `/champions`, `/champions/{idOrKey}` | Static champion data |
| GET | `/champions/{idOrKey}/stats` | Win, pick, ban rate; overall and per role |
| GET | `/champions/{idOrKey}/builds` | Runes, spells, boots, items, core sets, skill order, starting items |
| GET | `/champions/{idOrKey}/matchups` | Win rate vs lane opponents |
| GET | `/tier-list` | Champions ranked by Wilson-adjusted win rate |
| GET | `/players/{region}/{gameName}/{tagLine}` | Profile + ranks; creates player on first sight |
| POST | `/players/{region}/{gameName}/{tagLine}/refresh` | "Update" button; returns a job |
| GET | `/players/.../matches` | Match history (filter by queue, champion, role; paged) |
| GET | `/players/.../stats` | Overall KDA, win rate, CS/min, per role, last 20 |
| GET | `/players/.../champions` | Stats grouped by champion |
| GET | `/players/.../champions/{idOrKey}` | One champion: stats, per role, top keystones and items |
| GET | `/matches/{region}/{matchId}` | Full match, both teams |
| GET | `/jobs/{jobId}` | Background job status |
| POST | `/admin/sync`, `/admin/crawl` | Static sync; ladder crawl (header `x-admin-token`) |

Common filters on analytics endpoints: `patch` (`latest` or `15.21`), `tier` (default `master_plus`), `queue` (`ranked_solo` default, `ranked_flex`), `region` (platform code or `all`), `role` (`top|jungle|mid|adc|support`).

## Metric definitions

- **winRate** = wins / games.
- **pickRate** (champion overall) = games / matches in the filter. **pickRate** (per role, tier list) = games in role / all games in that role.
- **banRate** = matches where the champion was banned / matches in the filter (a match counts once even if both teams ban).
- **kda** = (total kills + total assists) / max(1, total deaths). **csPerMin** = total CS / total minutes.
- **score** (tier list) = lower bound of the 95% Wilson interval of win rate, 0 to 100.
- **lowSample** = fewer than 100 games (`LOW_SAMPLE_GAMES`).
- **Core set** = the 3 most expensive completed items in the final inventory. **Max order** = order in which Q, W, E reach level 5.

## Rules and behaviour

1. **Errors:** always `{ "error": { "code", "message", "details?" } }`. Codes: `INVALID_PARAMETER` 400, `UNAUTHORIZED` 401, `*_NOT_FOUND` 404, `UNSUPPORTED_MATCH` 422, `RATE_LIMITED` / `REFRESH_COOLDOWN` 429 (with `Retry-After`), `UPSTREAM_ERROR` 502, `DATA_NOT_READY` 503.
2. **First player lookup:** fetch profile and ranks from Riot synchronously (3 calls), queue an import job, return `matchesStatus: "pending"` and the `jobId`. The client polls `/jobs/{id}` or re-fetches the profile.
3. **Refresh:** 202 + job. One per player per 120 s (`REFRESH_COOLDOWN_SECONDS`); a second request while a job is active returns that job.
4. **Import:** first time, the last 20 matches per queue; later, everything since the newest stored match (max 100). Matches are stored once (by `match_id`). Remakes (< 5 min) and non-ranked queues are skipped.
5. **Riot client:** per-host sliding-window limiter (default 20/s and 100/2 min), waits on 429 using `Retry-After`, retries 5xx with backoff, maps 404 to our own not-found and 401/403 to `UPSTREAM_ERROR`. The key never leaves the server.
6. **Tier of a match** is the rank of the player it was discovered through (crawled tier, or the player's current rank for that queue, else `unranked`). This approximates lobby rank.
7. **Skill order and starting items** need the match timeline, which costs one extra Riot call. It is fetched for a sample (`TIMELINE_SAMPLE_RATE`, default 25%). The response reports `sampleSize`, and the fields are `null` when there is no timeline data.
8. **Caching:** `Cache-Control` 5 min on analytics, 1 h on static data and matches, 30 s on profiles. Inbound limit 120 req/min per IP.
9. **Patch change:** the sync job runs on boot and hourly; a new patch is downloaded once. Old patches stay in the database.

## Acceptance criteria

- [ ] Every endpoint above exists, validates input, and matches `docs/openapi.yaml`.
- [ ] `GET /champions/{id}/stats` returns correct win, pick and ban rates for a seeded data set, including per-role values.
- [ ] `GET /champions/{id}/builds` returns runes, spells, boots, items and core sets; skill order and starting items are `null` with no timeline data.
- [ ] Looking up an unknown Riot ID returns 404 `PLAYER_NOT_FOUND`; a known one returns profile, ranks and a pending job on first sight.
- [ ] After the job finishes, player stats and per-champion stats are consistent with the stored matches.
- [ ] A second refresh within the cooldown returns 429 `REFRESH_COOLDOWN` with `Retry-After`.
- [ ] A match is downloaded from Riot at most once.
- [ ] The Riot limiter never exceeds the configured limits and recovers from a 429.
- [ ] Invalid parameters never return 500.
- [ ] Migrations can be run twice without error.
- [ ] `npm run typecheck` and `npm test` pass.

## Out of scope

Frontend, accounts/login, live game (spectator), LP history graph, match timeline viewer, champion mastery, multi-language, TFT/Valorant, rollup tables for very large data (queries run directly on `match_participants` with indexes).

## Risks and open questions

- **Production key:** a dev key expires every 24 h and is limited to about 20 req/s and 100 per 2 min. A public site needs an approved production key. Limits are configurable (`RIOT_RATE_LIMITS`).
- **PUUID in league entries:** the ladder crawl uses `puuid` from league-v4 entries when present and falls back to a summoner-id lookup otherwise. Verify against the live API with a real key.
- **Data volume for trustworthy stats:** rates are only meaningful with thousands of matches per champion and patch. Seed with `POST /admin/crawl` across tiers and regions; expect hours at dev-key limits.
- **Tier approximation** (rule 6) and **timeline sampling** (rule 7) are deliberate trade-offs to save Riot calls.
- **Riot policy:** the site must follow Riot's developer policies (attribution, no key exposure) before launch.

## Suggested sub-tasks

1. DB schema and migrations (players, matches, participants, bans, jobs, static assets).
2. Data Dragon sync for champions, items, runes, spells.
3. Riot client with rate limiter and retries.
4. Match ingestion (+ timeline sample) and player import jobs.
5. Ladder crawl for seeding.
6. Champion analytics queries and routes.
7. Player routes (profile, refresh, matches, stats, per champion).
8. Match detail route, error model, validation, caching, inbound rate limit.
9. Tests and docs.
