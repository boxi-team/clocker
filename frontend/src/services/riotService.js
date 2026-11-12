// Leagă frontend-ul de backend. Componentele NU se schimbă:
// returnăm exact aceleași forme ca în data/mock.js.
import { TOP_PLAYERS, LIVE_GAMES } from '../data/mock';
import { SEARCH_REGIONS } from '../lib/constants';
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Regiunile din UI -> regiunile din backend
const REGION = SEARCH_REGIONS;
// Rolurile din backend -> rolurile din UI
const ROLE = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'ADC', support: 'Support' };

// "DIAMOND" -> "Diamond"
const cap = (s) => (s ? s[0] + s.slice(1).toLowerCase() : s);

// Sună backend-ul. Întoarce { data, meta } sau aruncă eroare.
async function api(path) {
    let res;
    const t0 = performance.now();
    try {
        res = await fetch(`${API}/v1${path}`, { cache: 'no-store' });
    } catch {
        const err = new Error('Backend unreachable');
        err.offline = true; // the server is off (different from an error answer such as "player not found")
        throw err;
    }
    const body = await res.json();
    // Timing of every backend call, visible in the browser console (F12)
    console.log(`[api] GET ${path.split('?')[0]} -> ${res.status} in ${Math.round(performance.now() - t0)} ms`);
    if (!res.ok) throw new Error(body.error?.message ?? 'Request failed');
    return body;
}

// 1700000000000 -> "3 hours ago"
function timeAgo(ms) {
    const min = Math.floor((Date.now() - ms) / 60000);
    if (min < 60) return `${Math.max(min, 1)} min ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} hours ago`;
    return `${Math.floor(h / 24)} days ago`;
}

// puuid -> calea jucătorului în backend (ca getMatchHistory să știe pe cine întreabă)
const who = new Map();

// Id -> { name, img } pentru iteme, vrăji și rune. Se încarcă o singură dată.
let assetsPromise;
function loadAssets() {
    assetsPromise ??= (async () => {
        const [items, spells, runes] = await Promise.all([api('/items'), api('/summoner-spells'), api('/runes')]);
        const ver = items.meta.patch;
        const cdn = `https://ddragon.leagueoflegends.com/cdn/${ver}/img`;
        const itemMap = {}, spellMap = {}, runeMap = {};
        for (const [id, it] of Object.entries(items.data.data)) itemMap[id] = { name: it.name, img: `${cdn}/item/${it.image.full}` };
        for (const s of Object.values(spells.data.data)) spellMap[s.key] = { name: s.name, img: `${cdn}/spell/${s.image.full}` };
        for (const style of runes.data) {
            runeMap[style.id] = { name: style.name, img: `https://ddragon.leagueoflegends.com/cdn/img/${style.icon}` };
            for (const slot of style.slots) for (const r of slot.runes)
                runeMap[r.id] = { name: r.name, img: `https://ddragon.leagueoflegends.com/cdn/img/${r.icon}` };
        }
        return { cdn, itemMap, spellMap, runeMap };
    })().catch((e) => { // dacă pică, afișăm placeholdere, nu stricăm pagina
        console.warn('Assets unavailable:', e.message);
        assetsPromise = undefined;
        return { cdn: '', itemMap: {}, spellMap: {}, runeMap: {} };
    });
    return assetsPromise;
}

// ---- Icons ----
// Champion name -> Data Dragon id, only where it is not just "the name without spaces/punctuation".
const CHAMP_ID = {
    Wukong: 'MonkeyKing', 'Nunu & Willump': 'Nunu', 'Renata Glasc': 'Renata', LeBlanc: 'Leblanc',
    "Cho'Gath": 'Chogath', "Kha'Zix": 'Khazix', "Kai'Sa": 'Kaisa', "Vel'Koz": 'Velkoz', "Bel'Veth": 'Belveth',
    "K'Sante": 'KSante', "Rek'Sai": 'RekSai', "Kog'Maw": 'KogMaw',
};
// Works for any champion (name like "Lee Sin" or id like "LeeSin"). The tiles URL needs no patch version.
export const champIcon = (nameOrId) => {
    const id = CHAMP_ID[nameOrId] ?? String(nameOrId).replace(/[^A-Za-z0-9]/g, '');
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${id}_0.jpg`;
};

// Latest Data Dragon version, loaded once (needed only for profile icons).
let ddVersionPromise;
const ddVersion = () => (ddVersionPromise ??= fetch('https://ddragon.leagueoflegends.com/api/versions.json')
    .then((r) => r.json()).then((v) => v[0])
    .catch(() => { ddVersionPromise = undefined; return null; }));

// Same name -> same icon, always. Used for players the backend doesn't know (profileIconId wins when it exists).
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const playerIcon = (p, v) => (v ? `https://ddragon.leagueoflegends.com/cdn/${v}/img/profileicon/${p.profileIconId ?? 1 + (hash(p.name) % 28)}.png` : undefined);

// Top champions of the current meta (Home). Throws when the backend fails, the caller shows the error.
export async function getMetaSnapshot() {
    // Ask for champions with a real sample first; only if the DB is that small, accept tiny samples (they get a "N games" label in the UI)
    let { data } = await api('/tier-list?tier=all&minGames=20&limit=8');
    if (!data.length) ({ data } = await api('/tier-list?tier=all&minGames=1&limit=8'));
    return data.map((r) => ({
        id: r.championId,          // Data Dragon id, used for /champions/:id
        champ: r.name,
        roleKey: r.role,           // backend role ('mid'), used in URLs and icons
        role: ROLE[r.role],        // UI label ('Mid')
        wr: +(r.winRate * 100).toFixed(1),
        games: r.games,
        img: r.iconUrl || champIcon(r.championId),
    }));
}

// Most banned champions (one row per champion, the tier list repeats a champion once per role).
export async function getMostBanned(limit = 8) {
    const { data } = await api('/tier-list?tier=all&minGames=1&sort=banRate&limit=100');
    const seen = new Set();
    const out = [];
    for (const r of data) {
        if (r.banRate <= 0 || seen.has(r.championKey)) continue;
        seen.add(r.championKey);
        out.push({ id: r.championId, name: r.name, banRate: r.banRate, img: r.iconUrl || champIcon(r.championId) });
        if (out.length === limit) break;
    }
    return out;
}

// riotId = "Nume#TAG" (dacă lipsește #TAG, folosim regiunea ca tag)
// Backend errors (player not found, backend offline...) are thrown and shown to the user. No mock fallback.
export const getSummoner = (riotId, region) => loadSummoner(riotId, region);

async function loadSummoner(riotId, region) {
    const start = performance.now();
    try {
        return await loadSummonerInner(riotId, region);
    } finally {
        console.log(`[profile] ${riotId} (${region}) load attempt took ${Math.round(performance.now() - start)} ms total`);
    }
}

async function loadSummonerInner(riotId, region) {
    const [gameName, tagLine = region] = riotId.split('#');
    const path = `/players/${REGION[region]}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;

    const { data: p } = await api(path);
    who.set(p.puuid, path);
    const { data: champs } = await api(`${path}/champions?limit=3`);

    const rank = (queue) => {
        const r = p.ranked.find((x) => x.queue === queue);
        return r
            ? { tier: cap(r.tier), div: r.division, lp: r.leaguePoints, wins: r.wins, losses: r.losses }
            : { tier: 'Unranked', div: '', lp: 0, wins: 0, losses: 0 };
    };

    return {
        puuid: p.puuid,
        name: p.gameName,
        tag: p.tagLine,
        region,
        level: p.summonerLevel,
        profileIcon: p.profileIconUrl,
        ranks: { solo: rank('ranked_solo'), flex: rank('ranked_flex') },
        topChamps: champs.map((c) => ({
            champ: c.name ?? String(c.championKey),
            img: c.iconUrl,
            games: c.games,
            kda: c.kda,
            csMin: c.csPerMin,
        })),
    };
}

// 'pending' | 'ready' | 'empty' (importul de meciuri din fundal)
export async function getMatchesStatus(puuid) {
    const path = who.get(puuid);
    if (!path) return 'ready';
    const { data } = await api(path);
    return data.matchesStatus;
}

// Pornește un refresh. Întoarce { ok: true } sau { ok: false, message } (ex. cooldown).
export async function refreshPlayer(puuid) {
    const path = who.get(puuid);
    if (!path) return { ok: false, message: 'Player not loaded' };
    let res;
    try {
        res = await fetch(`${API}/v1${path}/refresh`, { method: 'POST' });
    } catch {
        return { ok: false, message: 'Backend unreachable' };
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, message: body.error?.message ?? 'Refresh failed' };
    }
    return { ok: true };
}

// Aggregate stats of the player (solo queue): { summary, byRole[], last20 }
export async function getPlayerStats(puuid) {
    const path = who.get(puuid);
    if (!path) return null;
    const { data } = await api(`${path}/stats`);
    return data;
}

export async function getMatchHistory(puuid) {
    if (!puuid || !who.has(puuid)) return [];
    const [{ data }, A] = await Promise.all([api(`${who.get(puuid)}/matches?count=20`), loadAssets()]);
    const item = (id) => (id ? A.itemMap[id] ?? { name: String(id) } : null);
    return data.map((m) => ({
        id: m.matchId,
        win: m.win,
        mode: m.queue === 'ranked_solo' ? 'Ranked Solo' : 'Ranked Flex',
        role: m.role,
        ago: timeAgo(m.gameCreation),
        mins: Math.round(m.gameDuration / 60),
        champ: m.championId ?? String(m.championKey),
        champImg: m.championId ? `${A.cdn}/champion/${m.championId}.png` : undefined,
        spells: m.summonerSpells.map((id) => A.spellMap[id] ?? { name: String(id) }),
        rune: A.runeMap[m.keystone] ?? { name: String(m.keystone ?? '?') },
        k: m.kills,
        d: m.deaths,
        a: m.assists,
        cs: m.cs,
        vision: m.visionScore,
        items: m.items.slice(0, 6).map(item),
        trinket: item(m.items[6]),
    }));
}

// Toți cei 10 jucători dintr-un meci. Regiunea se deduce din id ("EUN1_123" -> "eun1").
export async function getMatchDetail(matchId) {
    try {
        const region = matchId.split('_')[0].toLowerCase();
        const [{ data }, A] = await Promise.all([api(`/matches/${region}/${matchId}`), loadAssets()]);
        const item = (id) => (id ? A.itemMap[id] ?? { name: String(id) } : null);
        const teams = data.teams.map((t) => ({
            teamId: t.teamId,
            win: t.win,
            participants: t.participants.map((p) => {
                const champ = p.championId ?? String(p.championKey);
                return {
                    puuid: p.puuid,
                    name: p.gameName ?? 'Unknown',
                    tag: p.tagLine,
                    role: p.role,
                    champ,
                    champImg: p.championId ? `${A.cdn}/champion/${p.championId}.png` : undefined,
                    level: p.champLevel,
                    spells: p.summonerSpells.map((id) => A.spellMap[id] ?? { name: String(id) }),
                    rune: A.runeMap[p.runes?.keystone] ?? { name: String(p.runes?.keystone ?? '?') },
                    k: p.kills, d: p.deaths, a: p.assists,
                    cs: p.cs, gold: p.gold, dmg: p.damageToChampions, vision: p.visionScore,
                    items: p.items.slice(0, 6).map(item),
                    trinket: item(p.items[6]),
                };
            }),
        }));
        const maxDmg = Math.max(1, ...teams.flatMap((t) => t.participants.map((p) => p.dmg)));
        return { teams, maxDmg };
    } catch (e) {
        return { error: e.message };
    }
}

// ---- Still mock: the backend has no leaderboard / live-game endpoint yet ----
const fake = (data) => new Promise((res) => setTimeout(() => res(data), 250));

export const getTopPlayers = async (region) => {
    const v = await ddVersion();
    return fake(TOP_PLAYERS.map((p) => ({ ...p, tag: region, icon: playerIcon(p, v) })));
};
export const getLiveGames = () => fake(LIVE_GAMES.map((g) => ({ ...g, img: champIcon(g.champ) })));

// ---- Champions (LoL Stats API v1.1.0). Same { data, meta } shape as the backend; no mock fallback. ----
const qs = (o = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v != null && v !== '') p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : '';
};
const cid = (id) => encodeURIComponent(id);

export const getChampions = (f) => api(`/champions${qs(f)}`);                          // static list
export const getChampion = (id) => api(`/champions/${cid(id)}`);                        // raw DDragon detail (base stats, lore)
export const getChampionFull = (id, f) => api(`/champions/${cid(id)}/full${qs(f)}`);    // champion page in one call
export const getMatchups = (id, f) => api(`/champions/${cid(id)}/matchups${qs(f)}`);
export const getChampionBuilds = (id, f) => api(`/champions/${cid(id)}/builds${qs(f)}`); // f.vs = lane opponent
export const getTierList = (f) => api(`/tier-list${qs(f)}`);
export const getPatches = () => api('/patches');
export { api, loadAssets };