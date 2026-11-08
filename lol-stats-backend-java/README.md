# LoL Stats Backend (Spring Boot)

Java / Spring Boot port of the Node (Fastify) `lol-stats-backend`. Same REST API under `/v1`, same Postgres schema,
same response shapes. Build tool: **Gradle (Groovy DSL)**.

## Run

```
docker compose up -d postgres          # Postgres 16 on :5432 (user/password/db: lol/lol/lolstats)
export RIOT_API_KEY=...                # from https://developer.riotgames.com
export ADMIN_TOKEN=change-me
./gradlew bootRun                      # Gradle wrapper (9.9.0) is included
```

Flyway creates / adopts the schema on startup. On boot (and hourly) the app syncs champion data from Data Dragon.
To trigger it by hand:

```
curl -X POST localhost:3000/v1/admin/sync -H "x-admin-token: change-me"
```

## Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 3000 | HTTP port |
| `DB_URL` / `DB_USER` / `DB_PASSWORD` | `jdbc:postgresql://localhost:5432/lolstats` / `lol` / `lol` | Postgres |
| `ADMIN_TOKEN` | empty (admin routes disabled) | Sent as `x-admin-token` for `POST /v1/admin/*` |
| `RIOT_API_KEY` | empty | Riot API key. Never expose it to the browser. |
| `RIOT_RATE_LIMITS` | `20:1000,100:120000` | Riot limits per host as `max:windowMs` pairs |
| `DDRAGON_LOCALE` | `en_US` | Language for champion text |
| `ENABLE_CRON` | true | Sync Data Dragon on boot and hourly |
| `ENABLE_WORKER` / `WORKER_CONCURRENCY` | true / 2 | Background job worker |
| `TIMELINE_SAMPLE_RATE` | 0.25 | Share of matches that also fetch the timeline |
| `FIRST_IMPORT_COUNT` | 20 | Matches imported per queue the first time a player is seen |
| `REFRESH_COOLDOWN_SECONDS` | 120 | Minimum time between player refreshes |
| `LOW_SAMPLE_GAMES` | 100 | Rows with fewer games are flagged `lowSample` |
| `INBOUND_RATE_LIMIT` | 120 | Requests per IP per minute |

## Endpoints

All under `/v1`. Full spec: `docs/openapi.yaml`.

| Method | Path |
|---|---|
| GET | `/health`, `/patches`, `/patches/latest`, `/patches/{version}` |
| GET | `/items`, `/runes`, `/summoner-spells` |
| GET | `/champions`, `/champions/{idOrKey}` |
| GET | `/champions/{idOrKey}/stats`, `/builds` (optional `?vs=` lane opponent), `/matchups` |
| GET | `/tier-list` |
| GET | `/players/{region}/{gameName}/{tagLine}` and `/matches`, `/stats`, `/champions`, `/champions/{idOrKey}` |
| POST | `/players/{region}/{gameName}/{tagLine}/refresh` |
| GET | `/matches/{region}/{matchId}`, `/jobs/{jobId}` |
| POST | `/admin/sync`, `/admin/crawl` (need `x-admin-token`) |

Errors are always `{ "error": { "code", "message", "details?" } }`.

## Layout

```
src/main/java/com/lolstats
  config/   AppProps, CORS, inbound rate limit
  common/   errors, validation (Q), Db helper, domain constants, response helpers
  data/     Catalog (patch/champion lookups), Data Dragon client, sync + scheduler
  riot/     Riot API client + sliding-window rate limiter
  ingest/   items, match ingest, players, ladder crawl
  jobs/     job queue (jobs table) + worker threads
  query/    analytics SQL (champions, tier list, players), patch diff
  web/      REST controllers
src/main/resources/db/migration   Flyway migrations (same SQL as the Node project)
src/test/java                     unit tests (no DB or network)
```

## Tests

```
./gradlew test
```
