import { pool } from '../db.js';

export interface ItemInfo {
  boots: boolean;
  completed: boolean;
  cost: number;
}
export type ItemMap = Map<number, ItemInfo>;

interface DDragonItem {
  tags?: string[];
  into?: string[];
  gold?: { total?: number; purchasable?: boolean };
}

let cache: { version: string; items: ItemMap }[] | null = null;
export const clearItemCache = () => { cache = null; };

async function load() {
  if (cache) return cache;
  const { rows } = await pool.query<{ version: string; data: { data: Record<string, DDragonItem> } }>(
    `SELECT a.version, a.data FROM static_assets a JOIN patches p USING (version)
     WHERE a.kind = 'items' ORDER BY p.synced_at DESC`,
  );
  cache = rows.map((r) => {
    const items: ItemMap = new Map();
    for (const [id, it] of Object.entries(r.data.data)) {
      const tags = it.tags ?? [];
      const cost = it.gold?.total ?? 0;
      items.set(Number(id), {
        boots: tags.includes('Boots'),
        completed:
          !tags.includes('Consumable') && !tags.includes('Trinket') &&
          it.gold?.purchasable !== false && (it.into ?? []).length === 0 && cost >= 1000,
        cost,
      });
    }
    return { version: r.version, items };
  });
  return cache;
}

/** Item data for a `major.minor` patch; falls back to the newest synced patch. null if none synced. */
export async function itemsForPatch(patch: string): Promise<ItemMap | null> {
  const all = await load();
  if (!all.length) return null;
  return (all.find((a) => a.version.startsWith(`${patch}.`)) ?? all[0]).items;
}

export interface Classified {
  boots: number | null;
  completedItems: number[]; // completed non-boots, most expensive first
  coreItems: number[] | null; // 3 most expensive, ascending
}

/** `slots` = item0..item5 (the trinket is excluded by the caller). */
export function classifyItems(slots: number[], map: ItemMap | null): Classified {
  const owned = slots.filter((id) => id > 0);
  if (!map) {
    const completedItems = [...owned];
    return { boots: null, completedItems, coreItems: coreOf(completedItems) };
  }
  let boots: number | null = null;
  const completed: { id: number; cost: number }[] = [];
  for (const id of owned) {
    const info = map.get(id);
    if (!info) continue;
    if (info.boots) {
      if (boots === null || info.cost > (map.get(boots)?.cost ?? 0)) boots = id;
    } else if (info.completed) {
      completed.push({ id, cost: info.cost });
    }
  }
  completed.sort((a, b) => b.cost - a.cost || a.id - b.id);
  const completedItems = completed.map((c) => c.id);
  return { boots, completedItems, coreItems: coreOf(completedItems) };
}

const coreOf = (completedByCost: number[]) =>
  completedByCost.length >= 3 ? [...completedByCost.slice(0, 3)].sort((a, b) => a - b) : null;
