import { config } from './config.js';

// Only the fields we rely on are typed; the rest is stored as-is in JSONB.
export interface DDragonChampionSummary {
  id: string;
  key: string;
  name: string;
}

export interface DDragonChampionDetail {
  id: string;
  key: string;
  name: string;
  title: string;
  blurb: string;
  lore: string;
  tags: string[];
  partype: string;
  info: unknown;
  stats: unknown;
  spells: unknown;
  passive: unknown;
  skins: unknown;
  image: { full: string } & Record<string, unknown>;
}

async function getJson<T>(url: string, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
  throw lastErr;
}

export async function fetchLatestVersion(): Promise<string> {
  const versions = await getJson<string[]>(`${config.ddragonBase}/api/versions.json`);
  return versions[0];
}

export async function fetchChampionList(version: string): Promise<DDragonChampionSummary[]> {
  const body = await getJson<{ data: Record<string, DDragonChampionSummary> }>(
    `${config.ddragonBase}/cdn/${version}/data/${config.locale}/champion.json`,
  );
  return Object.values(body.data);
}

export async function fetchChampionDetail(
  version: string,
  id: string,
): Promise<DDragonChampionDetail> {
  const body = await getJson<{ data: Record<string, DDragonChampionDetail> }>(
    `${config.ddragonBase}/cdn/${version}/data/${config.locale}/champion/${id}.json`,
  );
  return body.data[id];
}

export const fetchItems = (version: string) =>
  getJson<unknown>(`${config.ddragonBase}/cdn/${version}/data/${config.locale}/item.json`);

export const fetchRunes = (version: string) =>
  getJson<unknown>(`${config.ddragonBase}/cdn/${version}/data/${config.locale}/runesReforged.json`);

export const fetchSummonerSpells = (version: string) =>
  getJson<unknown>(`${config.ddragonBase}/cdn/${version}/data/${config.locale}/summoner.json`);

export const profileIconUrl = (version: string, iconId: number) =>
  `${config.ddragonBase}/cdn/${version}/img/profileicon/${iconId}.png`;

export function championImageUrl(version: string, imageFile: string): string {
  return `${config.ddragonBase}/cdn/${version}/img/champion/${imageFile}`;
}

export function splashUrl(id: string, skinNum = 0): string {
  return `${config.ddragonBase}/cdn/img/champion/splash/${id}_${skinNum}.jpg`;
}
