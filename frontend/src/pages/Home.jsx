import { useEffect, useRef, useState } from 'react';
import { Search, ListOrdered, Radio, Trophy, ArrowRight } from 'lucide-react';
import RegionSelect from '../components/RegionSelect';
import { Glass, Tile, ROLE_ICONS } from '../components/ui';
import { REGIONS } from '../data/mock';
import { getMetaSnapshot, getTopPlayers, getLiveGames } from '../services/riotService';
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
                        const Icon = ROLE_ICONS[m.role];
                        return (
                            <Glass key={m.champ} className="animate-rise group flex items-center gap-3 p-3"
                                   style={{ animationDelay: `${i * 60}ms` }}>
                                <Tile label={m.champ} className="h-12 w-12 !rounded-xl" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{m.champ}</p>
                                    <p className="flex items-center gap-1 text-xs text-white/50"><Icon size={12} aria-hidden />{m.role}</p>
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                                            <div className="h-full rounded-full bg-gradient-to-r from-accent to-violet"
                                                 style={{ width: `${Math.min(100, Math.max(0, (m.wr - 45) * 10))}%` }} />
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

// Shows its content (with the rise animation) only when it scrolls into view.
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

// ---------- the 3 panels in one row ----------

// Win rate -> letter. Simple thresholds, tune them as you like.
const grade = (wr) => (wr >= 52 ? 'S' : wr >= 51 ? 'A' : wr >= 50 ? 'B' : 'C');
const GRADE_STYLE = {
    S: 'bg-amber-300/15 text-amber-300 ring-amber-300/30',
    A: 'bg-accent/15 text-accent ring-accent/30',
    B: 'bg-white/[0.06] text-white/70 ring-white/15',
    C: 'bg-white/[0.03] text-white/40 ring-white/10',
};

const RowSkeletons = ({ n }) => Array.from({ length: n }, (_, i) => <div key={i} className="skeleton h-8 !rounded-lg" />);

// Shared card: title, content, and a link to the full page pinned to the bottom.
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
                        <Tile label={m.champ} className="h-7 w-7 text-[10px] !rounded-md" />
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
                    <Tile label={g.champ} className="h-7 w-7 text-[10px] !rounded-md" />
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
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="font-medium tabular-nums text-accent">{p.lp} LP</span>
                    <span className="w-12 text-right tabular-nums text-white/55">{p.wr}%</span>
                </button>
            ))}
        </Panel>
    );
}

// ---------- desktop app promo (in a card) ----------
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
            {/* Not available yet: Download turns into "Coming soon" on hover and keyboard focus */}
            <button type="button" aria-disabled="true" onClick={(e) => e.preventDefault()}
                    className="group relative mt-9 grid w-44 cursor-not-allowed place-items-center rounded-xl bg-blue-600 py-3 font-semibold text-white shadow-[0_10px_30px_-10px_rgba(37,99,235,.8)] transition-colors duration-200 hover:bg-gray-300 hover:text-[#2f3438] focus-visible:bg-gray-300 focus-visible:text-[#2f3438]">
                <span className="[grid-area:1/1] transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0">Download</span>
                <span className="[grid-area:1/1] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">Coming soon</span>
            </button>
        </Glass>
    );
}

// Full-width section: glowing top line + darker tint, so it reads as its own section.
const BAND = 'bg-black/40';

export default function Home({ onSearch, onNavigate }) {
    const [region, setRegion] = useState('EUW');
    return (
        <>
            {/* First screen = exactly the viewport (minus the navbar). It has the moving lights. */}
            <Stage blobs fade snap className="flex min-h-[calc(100svh-4.1rem)] flex-col justify-center px-4 pb-10">
                <h1 className="animate-rise mb-10 text-center font-display text-6xl font-bold tracking-tighter sm:text-7xl">
                    <span className="text-shine">Know your </span><span className="text-accent-shine">Rift.</span>
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
