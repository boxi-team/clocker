import { useEffect, useRef, useState } from 'react';
import { Search, ListOrdered, Radio, Trophy, ArrowRight } from 'lucide-react';
import RegionSelect from '../components/RegionSelect';
import { Glass, Tile, ROLE_ICONS } from '../components/ui';
import { REGIONS } from '../data/mock';
import { getMetaSnapshot, getTopPlayers, getLiveGames, getSummoner, getMatchHistory } from '../services/riotService';
import { useAsync } from '../hooks/useAsync';
import Stage from '../components/Stage';

function SearchHero({ onSearch, region, setRegion }) {
    const [name, setName] = useState('');
    const submit = (e) => { e.preventDefault(); if (name.trim()) onSearch(name.trim(), region); };
    return (
        <form onSubmit={submit} role="search"
              className="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.05] p-2 pl-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,.8)] backdrop-blur-(--glass-blur) transition focus-within:border-accent/60 focus-within:shadow-[0_0_0_4px_rgba(94,225,255,.1),0_0_50px_rgba(94,225,255,.25)]">
            <Search className="shrink-0 text-white/45" size={20} aria-hidden />
            <label htmlFor="hero-search" className="sr-only">Riot ID</label>
            <input id="hero-search" value={name} onChange={(e) => setName(e.target.value)} placeholder="Riot ID / Summoner Name  (Name#TAG)"
                   className="min-w-0 flex-1 bg-transparent py-3 text-lg outline-none placeholder:text-white/35" />
            <RegionSelect value={region} onChange={setRegion} options={REGIONS} />
            <button className="rounded-xl bg-accent px-6 py-3 font-semibold text-ink shadow-[0_0_24px_-4px_rgba(94,225,255,.6)] transition hover:bg-white active:scale-95">Search</button>
        </form>
    );
}

const WR_MIN = 35, WR_MAX = 65, LOW_SAMPLE = 30;
const barWidth = (wr) => Math.min(100, Math.max(4, ((wr - WR_MIN) / (WR_MAX - WR_MIN)) * 100));

const LOR_ROLE_ICONS = {
    'Top': 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-top.svg',
    'Jungle': 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-jungle.svg',
    'Mid': 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-middle.svg',
    'ADC': 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-bottom.svg',
    'Support': 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-utility.svg'
};

function MetaSnapshot() {
    const meta = useAsync(getMetaSnapshot);
    return (
        <section className="animate-rise mx-auto mt-16 w-full max-w-5xl" style={{ animationDelay: '260ms' }}>
            <div className="mb-4 flex items-end justify-between">
                <h2 className="font-display text-xl font-semibold tracking-tight">Current Patch Meta Snapshot</h2>
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">Win rate</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {meta === null
                    ? Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-[84px]" />)
                    : meta.map((m, i) => {
                        // 2. Extragem calea către imagine din noul nostru dicționar
                        const iconSrc = LOR_ROLE_ICONS[m.role];

                        return (
                            <Glass key={m.champ} className="animate-rise group flex items-center gap-3 p-3"
                                   style={{ animationDelay: `${i * 60}ms` }}>
                                <Tile label={m.champ} src={m.img} className="h-12 w-12 !rounded-xl" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{m.champ}</p>
                                    <p className="flex items-center gap-1.5 text-xs text-white/50">
                                        {iconSrc && (
                                            <span
                                                // Aici am pus gradientul exact ca la text-accent-shine
                                                className="h-3.5 w-3.5 bg-gradient-to-r from-accent to-violet"
                                                style={{
                                                    mask: `url(${iconSrc}) center / contain no-repeat`,
                                                    WebkitMask: `url(${iconSrc}) center / contain no-repeat`
                                                }}
                                                aria-hidden
                                            />
                                        )}
                                        {m.role}
                                        {m.games != null && m.games < LOW_SAMPLE && (
                                            <span className="text-white/35" title="Few games: this win rate is not reliable yet">· {m.games} {m.games === 1 ? 'game' : 'games'}</span>
                                        )}
                                    </p>
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                                            <div className="h-full rounded-full bg-gradient-to-r from-accent to-violet"
                                                 style={{ width: `${barWidth(m.wr)}%` }} />
                                        </div>
                                        <span className="text-xs font-semibold tabular-nums text-accent">{m.wr}%</span>
                                    </div>
                                </div>
                            </Glass>
                        );
                    })}
            </div>
        </section>
    );
}

function Reveal({ children, className = '' }) {
    const ref = useRef(null);
    const [seen, setSeen] = useState(false);
    useEffect(() => {
        const io = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) { setSeen(true); io.disconnect(); }
        }, { threshold: 0.15 });
        io.observe(ref.current);
        return () => io.disconnect();
    }, []);
    return <div ref={ref} className={`${seen ? 'animate-rise' : 'opacity-0'} ${className}`}>{children}</div>;
}

const grade = (wr) => (wr >= 52 ? 'S' : wr >= 51 ? 'A' : wr >= 50 ? 'B' : 'C');
const GRADE_STYLE = {
    S: 'bg-amber-300/15 text-amber-300 ring-amber-300/30',
    A: 'bg-accent/15 text-accent ring-accent/30',
    B: 'bg-white/[0.06] text-white/70 ring-white/15',
    C: 'bg-white/[0.03] text-white/40 ring-white/10',
};

const RowSkeletons = ({ n }) => Array.from({ length: n }, (_, i) => <div key={i} className="skeleton h-8 !rounded-lg" />);

function Panel({ title, icon: Icon, linkLabel, onLink, children }) {
    return (
        <Glass className="flex flex-col p-5">
            <h3 className="mb-3 flex items-center gap-2.5 border-b border-white/[0.07] pb-3 font-display text-lg font-semibold tracking-tight">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 ring-1 ring-inset ring-accent/20">
                    <Icon size={16} className="text-accent" aria-hidden />
                </span>
                {title}
            </h3>
            <div className="flex-1 space-y-0.5">{children}</div>
            <button onClick={onLink} className="group mt-4 flex items-center gap-1.5 self-start rounded text-sm font-medium text-accent transition hover:text-white">
                {linkLabel}
                <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
            </button>
        </Glass>
    );
}

function TierPanel({ onNavigate }) {
    const meta = useAsync(getMetaSnapshot);
    return (
        <Panel title="Tier list" icon={ListOrdered} linkLabel="See the full tier list" onLink={() => onNavigate('tiers')}>
            {meta === null ? <RowSkeletons n={8} /> : meta.map((m) => {
                const g = grade(m.wr);
                return (
                    <div key={m.champ} className="flex items-center gap-3 rounded-lg px-2 py-1 text-sm transition hover:bg-white/[0.04]">
                        <span className={`grid h-5 w-5 place-items-center rounded font-display text-[11px] font-bold ring-1 ring-inset ${GRADE_STYLE[g]}`}>{g}</span>
                        <Tile label={m.champ} src={m.img} className="h-7 w-7 text-[10px] !rounded-md" />
                        <span className="flex-1 truncate">{m.champ}</span>
                        <span className="tabular-nums text-white/55">{m.wr}%</span>
                    </div>
                );
            })}
        </Panel>
    );
}

function LivePanel({ onNavigate }) {
    const games = useAsync(getLiveGames);
    return (
        <Panel title="Live games" icon={Radio} linkLabel="See all live games" onLink={() => onNavigate('live')}>
            {games === null ? <RowSkeletons n={6} /> : games.map((g) => (
                <div key={g.id} className="flex items-center gap-3 rounded-lg px-2 py-1 text-sm transition hover:bg-white/[0.04]">
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-loss/70" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-loss" />
                    </span>
                    <Tile label={g.champ} src={g.img} className="h-7 w-7 text-[10px] !rounded-md" />
                    <span className="flex-1 truncate">{g.player}<span className="block text-xs text-white/40">{g.mode}</span></span>
                    <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-xs tabular-nums text-white/60">{g.mins}m</span>
                </div>
            ))}
        </Panel>
    );
}

const PODIUM = ['text-amber-300', 'text-slate-300', 'text-orange-400'];

function PlayersPanel({ region, onSearch, onNavigate }) {
    const players = useAsync(() => getTopPlayers(region), [region]);
    return (
        <Panel title={`Top 10 · ${region}`} icon={Trophy} linkLabel="See the full leaderboard" onLink={() => onNavigate('leaders')}>
            {players === null ? <RowSkeletons n={10} /> : players.map((p, i) => (
                <button key={p.name} onClick={() => onSearch(`${p.name}#${p.tag}`, region)}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left text-sm transition hover:bg-white/[0.06]">
                    <span className={`w-4 font-display font-bold tabular-nums ${PODIUM[i] ?? 'text-white/30'}`}>{i + 1}</span>
                    <Tile label={p.name} src={p.icon} className="h-7 w-7 text-[10px] !rounded-full" />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="font-medium tabular-nums text-accent">{p.lp} LP</span>
                    <span className="w-12 text-right tabular-nums text-white/55">{p.wr}%</span>
                </button>
            ))}
        </Panel>
    );
}

function DownloadCta() {
    return (
        <Glass className="relative mx-auto flex max-w-3xl flex-col items-center overflow-hidden p-8 text-center sm:p-12">
            <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[480px] -translate-x-1/2 rounded-full bg-accent/20 blur-[90px]" />
            <span className="relative rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Desktop</span>
            <h2 className="relative mt-4 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">Download boxi.gg desktop app</h2>
            <ul className="relative mx-auto mt-7 grid w-fit gap-2.5 text-left text-white/70">
                {['Explains every death in plain words', 'Gives you one thing to fix after each game', 'Suggests builds and runes for your matchup', 'Tracks your progress week after week'].map((t) => (
                    <li key={t} className="flex items-center gap-3">
                        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rotate-45 bg-accent" />{t}
                    </li>
                ))}
            </ul>
            <button type="button" aria-disabled="true" onClick={(e) => e.preventDefault()}
                    className="group relative mt-9 grid w-44 cursor-not-allowed place-items-center rounded-xl bg-blue-600 py-3 font-semibold text-white shadow-[0_10px_30px_-10px_rgba(37,99,235,.8)] transition-colors duration-200 hover:bg-gray-300 hover:text-[#2f3438] focus-visible:bg-gray-300 focus-visible:text-[#2f3438]">
                <span className="[grid-area:1/1] transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0">Download</span>
                <span className="[grid-area:1/1] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">Coming soon</span>
            </button>
        </Glass>
    );
}

const BAND = 'bg-black/40';

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
const CYCLE_PHRASES = [
    { main: 'Know your ', accent: 'Rift.' },
    { main: 'Be ', accent: 'Inevitable.' },
    { main: 'Outsmart. ', accent: 'Outplay.' },
    { main: 'Mind the ', accent: 'Gap.' },
    { main: 'Vision beyond the ', accent: 'Map.' },
];

const mapRiotRole = (rawRole) => {
    if (!rawRole) return null;
    const r = String(rawRole).toUpperCase();
    if (r === 'UTILITY' || r === 'SUPPORT') return 'Support';
    if (r === 'BOTTOM' || r === 'ADC' || r === 'DUO_CARRY') return 'ADC';
    if (r === 'MIDDLE' || r === 'MID') return 'Mid';
    if (r === 'JUNGLE') return 'Jungle';
    if (r === 'TOP') return 'Top';
    return null;
};

// ============================================================================
// Typewriter care stă 100% cuminte până e gata tot
// ============================================================================
function TypewriterTitle({ main, accent, isSpecial, isReady }) {
    const [idx, setIdx] = useState(0);
    const full = main + accent;

    useEffect(() => {
        if (!isReady) {
            setIdx(0); // Forțăm să stea pe 0 cât timp se încarcă
            return;
        }
        if (idx < full.length) {
            const timer = setTimeout(() => setIdx(i => i + 1), 60);
            return () => clearTimeout(timer);
        }
    }, [isReady, idx, full.length]);

    const typedMain = full.slice(0, Math.min(idx, main.length));
    const typedAccent = idx > main.length ? full.slice(main.length, idx) : '';
    const isDoneTyping = isReady && idx >= full.length;

    return (
        <div className="flex justify-center items-center h-[1.2em]">
            <span>
                <span className={isSpecial && isReady ? "text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 drop-shadow-lg transition-all" : "text-shine"}>
                    {typedMain}
                </span>
                <span className={isSpecial && isReady ? "text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-violet-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.4)] transition-all" : "text-accent-shine"}>
                    {typedAccent}
                </span>
            </span>
            {/* Am mutat bg-accent în afara condiției și am adăugat delay-500 și duration-1000 */}
            <span className={`w-[4px] h-[0.8em] ml-1.5 bg-accent transition-opacity duration-1000 ease-in-out ${isDoneTyping ? 'opacity-0 delay-500' : 'opacity-100'} ${!isReady ? 'animate-pulse' : ''}`} />
        </div>
    );
}

export default function Home({ onSearch, onNavigate, summoner }) {
    const [region, setRegion] = useState(summoner?.region || 'EUW');

    // 1. Decidem ce afișăm DIRECT CÂND SE ÎNCARCĂ PAGINA (synchronous state), nu în useEffect
    const [choice] = useState(() => {
        let visits = parseInt(localStorage.getItem('homeVisitCount') || '0', 10);
        visits += 1;
        localStorage.setItem('homeVisitCount', visits.toString());

        if (visits % 10 === -1) return { type: 'keria' };

        // PENTRU TESTARE AUTOFILL GOD DECOMENTEAZĂ LINIA URMĂTOARE:
        //return { type: 'diff' };

        const i = Math.floor(Math.random() * (CYCLE_PHRASES.length + 1));
        return i === CYCLE_PHRASES.length ? { type: 'diff' } : { type: 'phrase', idx: i };
    });

    const isKeria = choice.type === 'keria';
    const isShowingDiff = choice.type === 'diff';
    const phraseIdx = choice.idx || 0;

    const p = useAsync(
        () => summoner ? getSummoner(summoner.name, summoner.region).catch(() => null) : Promise.resolve(null),
        [summoner]
    );

    const matches = useAsync(
        () => p?.puuid ? getMatchHistory(p.puuid).catch(() => []) : Promise.resolve([]),
        [p?.puuid]
    );

    const [roleDiff, setRoleDiff] = useState('');
    const [isSpecialPlayer, setIsSpecialPlayer] = useState(false);

    // 2. Calculăm rolul STRICT dacă zarul a picat pe opțiunea Diff
    useEffect(() => {
        if (!isShowingDiff) return;

        setIsSpecialPlayer(false);
        if (matches && matches.length > 0) {
            const roleCounts = { Top: 0, Jungle: 0, Mid: 0, ADC: 0, Support: 0 };

            matches.forEach(m => {
                let raw = null;
                if (m.participants) {
                    const pStats = m.participants.find(part => part.puuid === p.puuid);
                    if (pStats) raw = pStats.teamPosition || pStats.role || pStats.lane;
                }
                if (!raw) raw = m.role || m.teamPosition || m.lane;

                if (!raw) {
                    const hasSmite = m.spells?.some(s => s?.name?.toLowerCase().includes('smite'));
                    if (hasSmite) {
                        raw = 'Jungle';
                    } else if (m.vision > 45 || ['Rakan', 'Thresh', 'Nami', 'Lulu', 'Janna', 'Leona', 'Nautilus', 'Pyke', 'Soraka', 'Yuumi', 'Milio', 'Renata Glasc', 'Braum', 'Alistar', 'Bard', 'Rell'].includes(m.champ)) {
                        raw = 'Support';
                    }
                }

                const mappedRole = mapRiotRole(raw);
                if (mappedRole && roleCounts[mappedRole] !== undefined) {
                    roleCounts[mappedRole] += 1;
                }
            });

            // PENTRU TESTARE AUTOFILL GOD DECOMENTEAZĂ LINIA DE JOS ȘI COMENTEAZ-O PE CEA NORMALĂ:
            //const isAutofillGod = true;
            const isAutofillGod = ROLES.every(r => roleCounts[r] >= 3);

            if (isAutofillGod) {
                setRoleDiff('Player Diff.');
                setIsSpecialPlayer(true);
            } else {
                const activeRoles = Object.keys(roleCounts).filter(r => roleCounts[r] > 0);
                if (activeRoles.length > 0) {
                    const mainRole = activeRoles.reduce((a, b) => roleCounts[a] > roleCounts[b] ? a : b);
                    setRoleDiff(`${mainRole} Diff.`);
                } else {
                    setRoleDiff('Player Diff.');
                }
            }
        } else if (summoner === null) {
            setRoleDiff(`${ROLES[Math.floor(Math.random() * ROLES.length)]} Diff.`);
        }
    }, [matches, p, summoner, isShowingDiff]);

    let titleMain = '';
    let titleAccent = '';

    if (isKeria) {
        titleMain = "Carry'em like ";
        titleAccent = "Keria.";
    } else if (!isShowingDiff) {
        titleMain = CYCLE_PHRASES[phraseIdx].main;
        titleAccent = CYCLE_PHRASES[phraseIdx].accent;
    } else {
        const diffText = roleDiff || 'Player Diff.';
        const parts = diffText.split(' ');
        titleMain = parts[0] + ' ';
        titleAccent = parts.slice(1).join(' '); // "Diff."
    }

    // 3. Cheia magică: "isReady" e True instant dacă afișăm un text normal.
    // Dacă afișăm Diff, e True DOAR DUPĂ CE s-a calculat roleDiff-ul final.
    const isReady = !isShowingDiff || roleDiff !== '';

    return (
        <>
            <Stage blobs fade snap className="flex min-h-[calc(100svh-4.1rem)] flex-col justify-center px-4 pb-10">
                <h1 className="animate-rise mb-10 text-center font-display text-6xl font-bold tracking-tighter sm:text-7xl">
                    <TypewriterTitle
                        main={titleMain}
                        accent={titleAccent}
                        isSpecial={isSpecialPlayer}
                        isReady={isReady}
                    />
                </h1>
                <div className="animate-rise relative z-20" style={{ animationDelay: '120ms' }}>
                    <SearchHero onSearch={onSearch} region={region} setRegion={setRegion} />
                </div>
                <MetaSnapshot />
            </Stage>

            <Stage edge snap className={BAND}>
                <Reveal className="mx-auto max-w-5xl px-4 pt-16">
                    <div className="grid gap-4 md:grid-cols-3">
                        <TierPanel onNavigate={onNavigate} />
                        <LivePanel onNavigate={onNavigate} />
                        <PlayersPanel region={region} onSearch={onSearch} onNavigate={onNavigate} />
                    </div>
                </Reveal>
                <Reveal className="mx-auto max-w-5xl px-4 pb-16 pt-20">
                    <DownloadCta />
                </Reveal>
            </Stage>
        </>
    );
}