-- Completed items (no boots or consumables) in the order they were purchased.
-- Only filled for matches with a timeline (TIMELINE_SAMPLE_RATE).
ALTER TABLE match_participants ADD COLUMN IF NOT EXISTS item_order INT[];