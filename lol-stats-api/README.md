# lol-stats-backend

Backend API for an op.gg-style League of Legends site: champion stats, builds, matchups, tier list,
player profiles and per-champion player stats, and match detail.

Stack: Node 20+, TypeScript, Fastify, PostgreSQL, zod.

- **API contract:** [`docs/openapi.yaml`](docs/openapi.yaml)
- **Jira ticket text:** [`docs/TICKET.md`](docs/TICKET.md)

## Run it

```bash
cp .env.example .env        # set RIOT_API_KEY and ADMIN_TOKEN
docker compose up -d postgres
npm install
npm run migrate             # creates the tables (safe to re-run)
npm run dev                 # http://localhost:3000/v1
```

On boot the server syncs static data (champions, items, runes, spells) from Data Dragon and starts the
background worker. Then seed match data, which is what all win/pick/ban rates are computed from:

```bash
# import ~10 recent ranked matches for every player in Gold I (EUW)
curl -X POST localhost:3000/v1/admin/crawl -H "x-admin-token: change-me" -H "content-type: application/json" \
  -d '{"region":"euw1","tier":"gold","division":"I","pages":2,"matchesPerPlayer":10}'
# watch it
curl localhost:3000/v1/jobs/<id>
```

Players are imported on demand: `GET /v1/players/euw1/Name/TAG` fetches the profile and queues the match import.

## Try it

```bash
curl localhost:3000/v1/champions/Ahri
curl "localhost:3000/v1/champions/Ahri/stats?tier=emerald_plus&patch=latest"
curl "localhost:3000/v1/champions/Ahri/builds?role=mid"
curl "localhost:3000/v1/champions/Ahri/builds?role=mid&vs=Zed"   # build vs lane opponent (optional)
curl "localhost:3000/v1/champions/Ahri/matchups?minGames=20"
curl "localhost:3000/v1/tier-list?role=mid&minGames=50"
curl localhost:3000/v1/players/euw1/Name/TAG
curl localhost:3000/v1/players/euw1/Name/TAG/champions
curl -X POST localhost:3000/v1/players/euw1/Name/TAG/refresh
```

## Tests

End-to-end tests run the real routes against a real Postgres, with Riot and Data Dragon replaced by a local mock
(`test/mock-riot.ts`), so no API key is needed:

```bash
docker compose exec postgres createdb -U lol lolstats_test
TEST_DATABASE_URL=postgres://lol:lol@localhost:5432/lolstats_test npm test
npm run typecheck
```

The test database is wiped on every run, so its name must end in `_test`.

## Layout

```
migrations/            SQL, applied in order by `npm run migrate`
src/riot/              Riot HTTP client + sliding-window rate limiter
src/ingest/            match, player and ladder-crawl import; item classification
src/jobs.ts            Postgres-backed job queue and worker (player refresh, crawl)
src/queries/           SQL for champion analytics and player stats
src/routes/            HTTP routes (all mounted under /v1)
test/                  mock Riot server + end-to-end test
```

## Limits to know about

- A Riot **dev key** expires every 24 hours and allows about 20 requests/s and 100 per 2 minutes. A public site needs a production key.
- Skill order and starting items need match timelines (one extra call per match), so they are fetched for a sample (`TIMELINE_SAMPLE_RATE`).
- A match's tier is the rank of the player it was found through, which approximates the lobby rank.
- The job queue lives in Postgres and runs in the API process. If you outgrow that, move the worker to its own process or to BullMQ.
