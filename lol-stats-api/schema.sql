-- Run this once on an empty database (Postgres 13+). Safe to run again.

CREATE TABLE IF NOT EXISTS patches (
  version   TEXT PRIMARY KEY,            -- e.g. "15.21.1"
  locale    TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS champions (
  key     INT  NOT NULL,                 -- numeric id used in match data (e.g. 103)
  patch   TEXT NOT NULL REFERENCES patches(version) ON DELETE CASCADE,
  id      TEXT NOT NULL,                 -- Data Dragon id, e.g. "Ahri" (used in image URLs)
  name    TEXT NOT NULL,
  title   TEXT,
  blurb   TEXT,
  lore    TEXT,
  tags    TEXT[] NOT NULL DEFAULT '{}',  -- {"Mage","Assassin"}
  partype TEXT,                          -- resource type: Mana, Energy, ...
  info    JSONB,                         -- attack/defense/magic/difficulty ratings
  stats   JSONB,                         -- hp, armor, attackdamage, ...
  spells  JSONB,
  passive JSONB,
  skins   JSONB,
  image   JSONB,
  PRIMARY KEY (key, patch)
);

CREATE INDEX IF NOT EXISTS champions_patch_idx ON champions (patch);
CREATE INDEX IF NOT EXISTS champions_id_idx    ON champions (id);
CREATE INDEX IF NOT EXISTS champions_tags_idx  ON champions USING GIN (tags);

-- Static Data Dragon payloads that are served as-is (items, runes, summoner spells).
CREATE TABLE IF NOT EXISTS static_assets (
  version TEXT NOT NULL REFERENCES patches(version) ON DELETE CASCADE,
  kind    TEXT NOT NULL CHECK (kind IN ('items', 'runes', 'spells')),
  data    JSONB NOT NULL,
  PRIMARY KEY (version, kind)
);

CREATE TABLE IF NOT EXISTS players (
  puuid                   TEXT PRIMARY KEY,
  region                  TEXT NOT NULL,
  game_name               TEXT NOT NULL,
  tag_line                TEXT NOT NULL,
  summoner_level          INT,
  profile_icon_id         INT,
  last_refresh_requested_at TIMESTAMPTZ,
  last_refreshed_at       TIMESTAMPTZ,
  last_match_creation     BIGINT,           -- game_creation (ms) of the newest imported match
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS players_riot_id_idx
  ON players (region, lower(game_name), lower(tag_line));

CREATE TABLE IF NOT EXISTS player_ranks (
  puuid         TEXT NOT NULL REFERENCES players(puuid) ON DELETE CASCADE,
  queue         TEXT NOT NULL CHECK (queue IN ('ranked_solo', 'ranked_flex')),
  tier          TEXT NOT NULL,
  division      TEXT NOT NULL,
  league_points INT  NOT NULL,
  wins          INT  NOT NULL,
  losses        INT  NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (puuid, queue)
);

CREATE TABLE IF NOT EXISTS matches (
  match_id      TEXT PRIMARY KEY,           -- e.g. EUW1_7123456789
  region        TEXT NOT NULL,
  queue_id      INT  NOT NULL,              -- 420 solo/duo, 440 flex
  patch         TEXT NOT NULL,              -- major.minor, e.g. 15.21
  game_version  TEXT NOT NULL,
  game_creation BIGINT NOT NULL,            -- ms
  game_duration INT  NOT NULL,              -- seconds
  winning_team  INT  NOT NULL,
  tier_bucket   TEXT NOT NULL,              -- iron..challenger or unranked
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS matches_filter_idx ON matches (patch, queue_id, tier_bucket, region);

-- patch/queue/region/tier/creation/duration are copied from matches so stats queries need no join.
CREATE TABLE IF NOT EXISTS match_participants (
  match_id        TEXT NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  puuid           TEXT NOT NULL,
  game_name       TEXT,
  tag_line        TEXT,
  team_id         INT  NOT NULL,
  champion_id     INT  NOT NULL,            -- numeric champion key
  role            TEXT CHECK (role IN ('top', 'jungle', 'mid', 'adc', 'support')),
  win             BOOLEAN NOT NULL,
  kills           INT NOT NULL,
  deaths          INT NOT NULL,
  assists         INT NOT NULL,
  cs              INT NOT NULL,
  gold            INT NOT NULL,
  damage          INT NOT NULL,
  vision_score    INT NOT NULL,
  champ_level     INT NOT NULL,
  items           INT[] NOT NULL,           -- 7 slots, 0 = empty
  boots           INT,
  completed_items INT[] NOT NULL DEFAULT '{}', -- completed non-boots items, most expensive first
  core_items      INT[],                    -- 3 most expensive completed items, ascending; null if fewer than 3
  spell1          INT NOT NULL,
  spell2          INT NOT NULL,
  primary_style   INT,
  sub_style       INT,
  keystone        INT,
  primary_perks   INT[],
  secondary_perks INT[],
  stat_shards     INT[],                    -- [offense, flex, defense]
  skill_order     TEXT,                     -- first 15 skill-ups, e.g. QWEQQRQEQEREEWW (timeline sample only)
  skill_max_order TEXT,                     -- e.g. Q>E>W
  starting_items  INT[],                    -- items bought in the first 90s, ascending (timeline sample only)
  patch           TEXT NOT NULL,
  queue_id        INT  NOT NULL,
  region          TEXT NOT NULL,
  tier_bucket     TEXT NOT NULL,
  game_creation   BIGINT NOT NULL,
  game_duration   INT  NOT NULL,
  PRIMARY KEY (match_id, puuid)
);
CREATE INDEX IF NOT EXISTS mp_champion_idx ON match_participants (patch, queue_id, tier_bucket, champion_id, role);
CREATE INDEX IF NOT EXISTS mp_role_idx     ON match_participants (patch, queue_id, tier_bucket, role);
CREATE INDEX IF NOT EXISTS mp_player_idx   ON match_participants (puuid, queue_id, game_creation DESC);
CREATE INDEX IF NOT EXISTS mp_player_champ_idx ON match_participants (puuid, champion_id);

CREATE TABLE IF NOT EXISTS match_bans (
  match_id    TEXT NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  team_id     INT  NOT NULL,
  pick_turn   INT  NOT NULL,
  champion_id INT  NOT NULL,
  PRIMARY KEY (match_id, team_id, pick_turn)
);
CREATE INDEX IF NOT EXISTS match_bans_champion_idx ON match_bans (champion_id);

CREATE TABLE IF NOT EXISTS jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type           TEXT NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  priority       INT  NOT NULL DEFAULT 0,
  dedupe_key     TEXT,
  progress_done  INT  NOT NULL DEFAULT 0,
  progress_total INT  NOT NULL DEFAULT 0,
  result         JSONB,
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at     TIMESTAMPTZ,
  finished_at    TIMESTAMPTZ
);
-- At most one active job per dedupe key (e.g. one refresh per player).
CREATE UNIQUE INDEX IF NOT EXISTS jobs_active_dedupe_idx
  ON jobs (dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS jobs_queue_idx ON jobs (status, priority DESC, created_at);
