import { pool } from '../db.js';
import { syncChampions } from '../sync.js';

const force = process.argv.includes('--force');
console.log(await syncChampions(force));
await pool.end();
