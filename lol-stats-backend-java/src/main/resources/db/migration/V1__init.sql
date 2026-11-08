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
