-- Top ranked solo/duo players per region and tier, replaced on every leaderboard refresh.
-- Names and profile icons come from the players table (joined on puuid).
CREATE TABLE IF NOT EXISTS leaderboard_entries (
                                                   region        TEXT NOT NULL,
                                                   tier          TEXT NOT NULL,              -- iron..challenger
                                                   rank          INT  NOT NULL,              -- 1 = highest LP
                                                   puuid         TEXT NOT NULL,
                                                   division      TEXT,                       -- I..IV, null for master/grandmaster/challenger
                                                   league_points INT  NOT NULL,
                                                   wins          INT  NOT NULL,
                                                   losses        INT  NOT NULL,
                                                   updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (region, tier, rank)
    );