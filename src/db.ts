import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

/** Version string of the most recently synced patch, or null if nothing is synced yet. */
export async function latestPatch(): Promise<string | null> {
  const { rows } = await pool.query<{ version: string }>(
    'SELECT version FROM patches ORDER BY synced_at DESC, version DESC LIMIT 1',
  );
  return rows[0]?.version ?? null;
}
