import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');

for (const file of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
  console.log(`Applying ${file}`);
  await pool.query(await readFile(path.join(dir, file), 'utf8'));
}

await pool.end();
console.log('Migrations done.');
