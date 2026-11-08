import { pool } from './db.js';

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}
export interface EntityRef {
  id: string | number;
  name: string;
}
export interface EntityChange extends EntityRef {
  changes: FieldChange[];
}
export interface Diff {
  added: EntityRef[];
  removed: EntityRef[];
  changed: EntityChange[];
}
export interface PatchChanges {
  /** Previous synced patch the comparison was made against. */
  previousVersion: string;
  champions: Diff;
  items: Diff;
}

const versionParts = (v: string) => v.split('.').map(Number);

/** Compare Data Dragon versions numerically ("15.9.1" < "15.21.1"). */
export function compareVersions(a: string, b: string): number {
  const x = versionParts(a);
  const y = versionParts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** The synced patch directly before `version`, or null if it is the oldest one. */
export async function previousPatch(version: string): Promise<string | null> {
  const { rows } = await pool.query<{ version: string }>('SELECT version FROM patches');
  const older = rows.map((r) => r.version).filter((v) => compareVersions(v, version) < 0);
  older.sort(compareVersions);
  return older.at(-1) ?? null;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Flat field-by-field diff of two plain objects (one level; nested values compared as JSON). */
function diffObject(prefix: string, a: Record<string, unknown> = {}, b: Record<string, unknown> = {}): FieldChange[] {
  const out: FieldChange[] = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!same(a[k], b[k])) out.push({ field: `${prefix}${k}`, from: a[k] ?? null, to: b[k] ?? null });
  }
  return out;
}

function diffMaps<T>(
  prev: Map<string, T>,
  curr: Map<string, T>,
  ref: (id: string, v: T) => EntityRef,
  compare: (a: T, b: T) => FieldChange[],
): Diff {
  const diff: Diff = { added: [], removed: [], changed: [] };
  for (const [id, v] of curr) {
    const old = prev.get(id);
    if (!old) { diff.added.push(ref(id, v)); continue; }
    const changes = compare(old, v);
    if (changes.length) diff.changed.push({ ...ref(id, v), changes });
  }
  for (const [id, v] of prev) if (!curr.has(id)) diff.removed.push(ref(id, v));
  return diff;
}

// ---- champions ----------------------------------------------------------------------------

interface SpellJson { cooldownBurn?: string; costBurn?: string; rangeBurn?: string; maxrank?: number }
interface ChampRow {
  key: number; id: string; name: string; title: string | null; tags: string[]; partype: string | null;
  info: Record<string, unknown> | null; stats: Record<string, unknown> | null; spells: SpellJson[] | null;
}
const SPELL_SLOTS = ['Q', 'W', 'E', 'R'];

function diffChampion(a: ChampRow, b: ChampRow): FieldChange[] {
  const out: FieldChange[] = [];
  if (a.name !== b.name) out.push({ field: 'name', from: a.name, to: b.name });
  if (a.title !== b.title) out.push({ field: 'title', from: a.title, to: b.title });
  if (a.partype !== b.partype) out.push({ field: 'partype', from: a.partype, to: b.partype });
  if (!same(a.tags, b.tags)) out.push({ field: 'tags', from: a.tags, to: b.tags });
  out.push(...diffObject('stats.', a.stats ?? {}, b.stats ?? {}));
  out.push(...diffObject('info.', a.info ?? {}, b.info ?? {}));
  (b.spells ?? []).forEach((s, i) => {
    const o = a.spells?.[i] ?? {};
    const slot = SPELL_SLOTS[i] ?? String(i);
    for (const f of ['cooldownBurn', 'costBurn', 'rangeBurn', 'maxrank'] as const) {
      if (!same(o[f], s[f])) out.push({ field: `spells.${slot}.${f}`, from: o[f] ?? null, to: s[f] ?? null });
    }
  });
  return out;
}

async function loadChampions(version: string) {
  const { rows } = await pool.query<ChampRow>(
    'SELECT key, id, name, title, tags, partype, info, stats, spells FROM champions WHERE patch = $1',
    [version],
  );
  return new Map(rows.map((r) => [String(r.key), r]));
}

// ---- items --------------------------------------------------------------------------------

interface ItemJson {
  name?: string;
  gold?: { total?: number; base?: number; sell?: number; purchasable?: boolean };
  stats?: Record<string, unknown>;
  into?: string[];
  from?: string[];
}

function diffItem(a: ItemJson, b: ItemJson): FieldChange[] {
  const out: FieldChange[] = [];
  if (a.name !== b.name) out.push({ field: 'name', from: a.name ?? null, to: b.name ?? null });
  out.push(...diffObject('gold.', a.gold ?? {}, b.gold ?? {}));
  out.push(...diffObject('stats.', a.stats ?? {}, b.stats ?? {}));
  if (!same(a.from ?? [], b.from ?? [])) out.push({ field: 'from', from: a.from ?? [], to: b.from ?? [] });
  return out;
}

async function loadItems(version: string) {
  const { rows } = await pool.query<{ data: { data: Record<string, ItemJson> } }>(
    "SELECT data FROM static_assets WHERE version = $1 AND kind = 'items'",
    [version],
  );
  return new Map(Object.entries(rows[0]?.data?.data ?? {}));
}

/** What changed in `version` compared with the synced patch before it. null if there is no earlier patch. */
export async function patchChanges(version: string): Promise<PatchChanges | null> {
  const prev = await previousPatch(version);
  if (!prev) return null;
  const [pc, cc, pi, ci] = await Promise.all([
    loadChampions(prev), loadChampions(version), loadItems(prev), loadItems(version),
  ]);
  return {
    previousVersion: prev,
    champions: diffMaps(pc, cc, (_id, c) => ({ id: c.key, name: c.name }), diffChampion),
    items: diffMaps(pi, ci, (id, i) => ({ id: Number(id), name: i.name ?? id }), diffItem),
  };
}
