# boxi.gg

A League of Legends stats site in the style of op.gg / u.gg: player profiles, match history, champion lists, tier list, recommended builds, matchups and per-champion details.

The project has two parts:

- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4 (`lucide-react` for icons)
- **Backend**: Java 17 + Spring Boot 3.5 + PostgreSQL (hosted on Supabase, Flyway for migrations), built with Gradle

The backend computes all statistics (win/pick/ban rates, builds, matchups, tier list) from ranked matches imported from the Riot API. Static data (champions, items, runes, summoner spells) comes from Data Dragon.

---

## Features

### Pages
| Page | Description |
|---|---|
| **Home** | Riot ID + region search, animated typewriter headline, meta snapshot, tier list / live games / top players panels, desktop app download button (coming soon) |
| **Profile** | Solo/flex rank, top champions, expandable match history (all 10 players), *Update* button that polls the import job |
| **Champions** | Grid with search and tag filter, plus a *Tier list* view (rank, role, queue, patch, min games, sortable columns) |
| **Champion detail** | Build (runes, summoner spells, boots, items, item order, skill order, starting items), matchups (counters / strong against), abilities, base stats with a level slider, 3D skin carousel |

### Good to know
- All filters on the champion pages live in the URL (`/champions/Ahri?tier=gold&role=mid&vs=Zed`), so links are shareable.
- Clicking an opponent in *Matchups* shows the build against them (`?vs=`).
- Minimal router on the History API (no extra dependency) in `hooks/useUrl.js`.
- If the backend is down, Home and Profile fall back to mock data (development only); the champion pages show an error state with *Retry*.
- Leaderboards and Live Game still use mock data (the backend has no endpoints for them yet).

---

## Requirements

- Node.js `^20.19` or `>=22.12`
- JDK 17+
- Access to the team's **Supabase** project (the shared PostgreSQL database)
- A Riot API key from https://developer.riotgames.com (a dev key expires every 24 hours)

---

## Quick start

### 1. Database (Supabase)

The database is a PostgreSQL instance hosted on **Supabase** and **shared** by the whole team: everyone sees the same matches, players and statistics. No local Docker setup is needed.

Get the connection details from Supabase: *Project Settings → Database → Connection string*. The backend uses JDBC, so the format is:

```
DB_URL=jdbc:postgresql://<HOST>:<PORT>/postgres?sslmode=require
DB_USER=<user>
DB_PASSWORD=<database password>
```

Which connection to pick in Supabase:

| Type | Host / port | User | When |
|---|---|---|---|
| Direct | `db.<ref>.supabase.co:5432` | `postgres` | Works if your network supports IPv6 |
| **Session pooler** | `aws-0-<region>.pooler.supabase.com:5432` | `postgres.<ref>` | Recommended for this backend |
| Transaction pooler | `...pooler.supabase.com:6543` | `postgres.<ref>` | **Do not use**: it can break Flyway and prepared statements |

Rules for the shared database:
- **Never commit the password.** Put the variables in a `.env` file in the backend root (already in `.gitignore`; the app reads it automatically) or export them in your terminal.
- The schema (Flyway) is applied on first start. Teammates don't need to do anything; new migrations apply themselves, so tell the team when you add a migration such as `V4__...sql`.
- The data is common: a crawl run by one of you populates the statistics for everyone. Avoid running crawls at the same time (they share the Riot key's rate limit if you use the same key).
- If you need isolated test data, create a separate Supabase project or your own schema.

### 2. Backend

```bash
export DB_URL="jdbc:postgresql://<HOST>:5432/postgres?sslmode=require"
export DB_USER=...             # from Supabase
export DB_PASSWORD=...         # from Supabase
export RIOT_API_KEY=...        # your Riot key
export ADMIN_TOKEN=change-me   # protects /v1/admin/*
./gradlew bootRun              # starts on http://localhost:3000
```

Flyway creates the schema on startup. On boot (and then hourly) the app syncs static data from Data Dragon. You can also trigger it manually:

```bash
curl -X POST localhost:3000/v1/admin/sync -H "x-admin-token: change-me"
```

### 3. Populate the statistics

Champion stats and the tier list only appear once there are matches in the database. You can populate them by crawling a ladder:

```bash
curl -X POST localhost:3000/v1/admin/crawl \
  -H "x-admin-token: change-me" -H "Content-Type: application/json" \
  -d '{"region":"euw1","tier":"challenger","queue":"ranked_solo","matchesPerPlayer":10}'
```

For tiers from iron to diamond the `division` field (`I`–`IV`) is required. Progress is visible at `GET /v1/jobs/{jobId}`. Matches of any player searched on the site are imported automatically.

### 4. Frontend

```bash
npm install
npm run dev                    # http://localhost:5173
```

The frontend talks to `http://localhost:3000` by default. To use another backend, set `VITE_API_URL` (for example in a `.env` file).

---

## Backend configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DB_URL` / `DB_USER` / `DB_PASSWORD` | `jdbc:postgresql://localhost:5432/lolstats` / `lol` / `lol` | Postgres connection. The defaults are for a local Postgres; for Supabase you must set them (see "Database") |
| `ADMIN_TOKEN` | empty (admin routes disabled) | `x-admin-token` header for `POST /v1/admin/*` |
| `RIOT_API_KEY` | empty | Riot key. Never expose it to the browser |
| `RIOT_RATE_LIMITS` | `20:1000,100:120000` | Riot limits per host as `max:windowMs` pairs |
| `DDRAGON_LOCALE` | `en_US` | Language of champion text (`ro_RO`, `de_DE`, ...) |
| `ENABLE_CRON` | `true` | Data Dragon sync on boot and hourly |
| `ENABLE_WORKER` / `WORKER_CONCURRENCY` | `true` / `2` | Background job worker |
| `TIMELINE_SAMPLE_RATE` | `0.25` | Share of matches that also fetch the timeline (skill order, starting items) |
| `FIRST_IMPORT_COUNT` | `20` | Matches imported per queue the first time a player is searched |
| `REFRESH_COOLDOWN_SECONDS` | `120` | Minimum time between two refreshes of the same player |
| `LOW_SAMPLE_GAMES` | `100` | Rows with fewer games are flagged `lowSample` |
| `INBOUND_RATE_LIMIT` | `120` | Requests per minute per IP |
| `RIOT_BASE_URL` | empty | Tests only: redirects Riot requests |

Frontend: `VITE_API_URL` (default `http://localhost:3000`).

---

## API

All routes are under `/v1`. The full spec is in `openapi.yaml`.

| Method | Path |
|---|---|
| GET | `/health`, `/patches`, `/patches/latest`, `/patches/{version}` |
| GET | `/items`, `/runes`, `/summoner-spells` |
| GET | `/champions`, `/champions/{idOrKey}`, `/champions/{idOrKey}/full` |
| GET | `/champions/{idOrKey}/stats`, `/builds` (optional `?vs=`), `/matchups` |
| GET | `/tier-list` |
| GET | `/players/{region}/{gameName}/{tagLine}` and `/matches`, `/stats`, `/champions`, `/champions/{idOrKey}` |
| POST | `/players/{region}/{gameName}/{tagLine}/refresh` |
| GET | `/matches/{region}/{matchId}`, `/jobs/{jobId}` |
| POST | `/admin/sync`, `/admin/crawl` (require `x-admin-token`) |

Conventions:
- Success: `{ "data": ..., "meta": {...} }`. Error: `{ "error": { "code", "message", "details?" } }`.
- Rates (`winRate`, `pickRate`, `banRate`) are fractions between 0 and 1.
- Analytics filters: `patch`, `tier`, `queue`, `region`, `role`.
- When there are no matches for a filter, endpoints return empty structures (`games: 0`, `recommended: null`), not errors.

---

## Project structure

### Frontend (`src/`)
```
App.jsx                   layout + navigation (state + URL)
main.jsx, index.css       entry point, Tailwind theme, animations, background
pages/                    Home, Profile, Champions, ChampionDetail
components/               Navbar, Footer, Stage, MatchCard, RegionSelect, Link, ui (Glass, Tile, RankBadge, WinDonut)
components/champion/      BuildSection, MatchupsSection, AbilitiesSection, StatsSection, SkinCarousel, common
hooks/                    useUrl (mini router), useAsync, useRequest
services/riotService.js   all backend calls + mock fallback
data/mock.js              mock data (development)
lib/constants.js          tiers, roles, regions, labels
```

### Backend (`src/main/java/com/lolstats`)
```
config/   AppProps, CORS, per-IP rate limit
common/   errors, validation (Q), Db helper, domain constants, response helpers
data/     Catalog, Data Dragon client, sync + scheduler
riot/     Riot API client with sliding-window rate limiter and retries
ingest/   match import, players, items, ladder crawl
jobs/     job queue (jobs table) + worker threads
query/    analytics SQL (champions, tier list, players), patch diff
web/      REST controllers
src/main/resources/db/migration   Flyway migrations (V1–V3)
```

---

## How the statistics are computed

- **Tier list**: the score is the lower bound of the 95% Wilson confidence interval of the win rate, so champions with few games don't outrank champions with many. The S/A/B/C/D letters are computed in the frontend from the score percentile.
- **Builds**: the recommended option is the most played one; alternatives (max 2) need at least `max(50, 5% of games)` games.
- **Skill order, starting items, item order**: these come from match timelines, which are only fetched for a sample of matches (`TIMELINE_SAMPLE_RATE`), so each section shows its `sample` size.
- **Pick rate**: games played / total matches in the current filter (or / games in that role, in the tier list).
- **A match's tier** comes from the rank of the player it was discovered through; it is an approximation of the lobby rank.

---

## Tests

```bash
./gradlew test
```

## Notes

- Riot rate limiting follows the dev key limits (20 requests/second, 100 per 2 minutes), so a large crawl takes a while.
- `docker-compose.yml` (local Postgres + Redis) remains only as an option for offline development; it is not needed with Supabase. Redis is not used yet.
- `env.example` uses `DATABASE_URL`, but the app reads `DB_URL`, `DB_USER` and `DB_PASSWORD`. Use the latter.
- The footer links to pages (About, Terms, Privacy) that are not built yet; the same goes for Live Game and Leaderboards.
