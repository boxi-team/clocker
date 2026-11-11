import { useMemo } from 'react';
import { LayoutGrid, ListOrdered, Search, ArrowDown } from 'lucide-react';
import { Glass, Tile } from '../components/ui';
import Link from '../components/Link';
import { EmptyState, ErrorState, Select, pct, num, wrColor } from '../components/champion/common';
import { useRequest } from '../hooks/useRequest';
import { useSearchParams } from '../hooks/useUrl';
import { getChampions, getTierList, getPatches } from '../services/riotService';
import { TIERS, ROLES, QUEUES, TAGS, DEFAULTS, ROLE_LABEL, QUEUE_LABEL, tierLabel } from '../lib/constants';

const Chip = ({ active, onClick, children }) => (
    <button onClick={onClick} aria-pressed={active}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? 'border-accent/50 bg-accent/15 text-accent' : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white'}`}>
        {children}
    </button>
);

function Grid({ params, set }) {
    const { data, error, loading, retry } = useRequest(() => getChampions(), []);
    const q = params.get('q') ?? '';
    const tag = params.get('tag') ?? '';
    const list = useMemo(() => (data?.data ?? []).filter((c) =>
        (!tag || c.tags.includes(tag)) && (!q || c.name.toLowerCase().includes(q.toLowerCase()))), [data, q, tag]);

    return (
        <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 transition focus-within:border-accent/50">
                    <Search size={14} className="text-white/40" aria-hidden />
                    <span className="sr-only">Search champion</span>
                    <input value={q} onChange={(e) => set({ q: e.target.value })} placeholder="Search champion"
                           className="w-48 bg-transparent text-sm outline-none placeholder:text-white/35" />
                </label>
                <div className="flex flex-wrap gap-1.5">
                    <Chip active={!tag} onClick={() => set({ tag: null })}>All</Chip>
                    {TAGS.map((t) => <Chip key={t} active={tag === t} onClick={() => set({ tag: tag === t ? null : t })}>{t}</Chip>)}
                </div>
                {data && <span className="ml-auto text-sm text-white/40 tabular-nums">{list.length} champions</span>}
            </div>
            {error ? <ErrorState error={error} onRetry={retry} />
                : loading && !data ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        {Array.from({ length: 18 }, (_, i) => <div key={i} className="skeleton h-40" />)}
                    </div>
                ) : list.length === 0 ? <EmptyState>No champion matches your search.</EmptyState> : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        {list.map((c) => (
                            <Link key={c.id} href={`/champions/${c.id}`} className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
                                <Glass className="flex h-full flex-col items-center gap-2 p-4 text-center group-hover:-translate-y-0.5">
                                    <Tile label={c.name} src={c.iconUrl} className="h-16 w-16 !rounded-xl" />
                                    <p className="font-display font-semibold leading-tight">{c.name}</p>
                                    <p className="text-xs text-white/40">{c.title}</p>
                                    <p className="mt-auto text-[10px] uppercase tracking-wider text-accent/70">{c.tags.join(' · ')}</p>
                                </Glass>
                            </Link>
                        ))}
                    </div>
                )}
        </>
    );
}

// S/A/B/C/D computed on the client from the score (Wilson lower bound) percentile, whatever the table is sorted by.
const TIER_STYLE = { S: '#5ee1ff', A: '#8b7bff', B: '#5aa9ff', C: '#a9b4c0', D: '#ff5d73' };
function tierOf(pos, n) {
    const p = pos / n;
    return p < 0.1 ? 'S' : p < 0.3 ? 'A' : p < 0.6 ? 'B' : p < 0.85 ? 'C' : 'D';
}

const COLS = [
    ['winRate', 'Win rate'], ['pickRate', 'Pick rate'], ['banRate', 'Ban rate'], ['games', 'Games'],
];

function Table({ params, set }) {
    const f = {
        tier: params.get('tier') || DEFAULTS.tier, queue: params.get('queue') || DEFAULTS.queue,
        patch: params.get('patch') || DEFAULTS.patch, role: params.get('role') || undefined,
        sort: params.get('sort') || 'score', minGames: params.get('minGames') || 1, limit: 500,
    };
    const patches = useRequest(() => getPatches().catch(() => ({ data: [] })), []);
    const { data, error, loading, retry } = useRequest(() => getTierList(f), [JSON.stringify(f)]);

    const minors = [...new Set((patches.data?.data ?? []).map((p) => p.version.split('.').slice(0, 2).join('.')))];
    const rows = data?.data ?? [];
    const tiers = useMemo(() => {
        const m = new Map();
        [...rows].sort((a, b) => b.score - a.score).forEach((r, i, arr) => m.set(`${r.championKey}-${r.role}`, tierOf(i, arr.length)));
        return m;
    }, [rows]);
    const keep = new URLSearchParams({ tier: f.tier, queue: f.queue, patch: f.patch, ...(f.role ? { role: f.role } : {}) });

    const Th = ({ id, children }) => (
        <th className="px-3 py-2 text-right font-semibold">
            <button onClick={() => set({ sort: id === 'score' ? null : id })} aria-label={`Sort by ${children}`}
                    className={`inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-white ${f.sort === id ? 'text-accent' : ''}`}>
                {children} {f.sort === id && <ArrowDown size={12} />}
            </button>
        </th>
    );

    return (
        <>
            <div className="mb-5 flex flex-wrap items-end gap-3">
                <Select label="Rank" value={f.tier} onChange={(v) => set({ tier: v === DEFAULTS.tier ? null : v })} options={TIERS.map((t) => [t, tierLabel(t)])} />
                <Select label="Role" value={f.role ?? ''} onChange={(v) => set({ role: v })} options={[['', 'All roles'], ...ROLES.map((r) => [r, ROLE_LABEL[r]])]} />
                <Select label="Queue" value={f.queue} onChange={(v) => set({ queue: v === DEFAULTS.queue ? null : v })} options={QUEUES.map((x) => [x, QUEUE_LABEL[x]])} />
                <Select label="Patch" value={f.patch} onChange={(v) => set({ patch: v === 'latest' ? null : v })} options={[['latest', 'Latest'], ...minors.map((m) => [m, m])]} />
                <Select label="Min games" value={String(f.minGames)} onChange={(v) => set({ minGames: v === '1' ? null : v })} options={['1', '50', '100', '200'].map((x) => [x, x])} />
                {data?.meta && <span className="ml-auto pb-2 text-sm text-white/40 tabular-nums">Patch {data.meta.patch ?? '–'} · {num(data.meta.totalMatches)} matches</span>}
            </div>
            {error ? <ErrorState error={error} onRetry={retry} />
                : loading && !data ? <div className="skeleton h-96" />
                    : rows.length === 0 ? <EmptyState>No ranked matches for these filters yet. Try “All ranks” or a lower minimum.</EmptyState> : (
                        <Glass className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
                            <table className="w-full min-w-[720px] text-sm tabular-nums">
                                <thead className="border-b border-white/[0.07] text-[11px] text-white/40">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">#</th>
                                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Champion</th>
                                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Role</th>
                                    <th className="px-3 py-2 text-center font-semibold uppercase tracking-wider">
                                        <button onClick={() => set({ sort: null })} className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-white ${f.sort === 'score' ? 'text-accent' : ''}`}>
                                            Tier {f.sort === 'score' && <ArrowDown size={12} />}
                                        </button>
                                    </th>
                                    {COLS.map(([id, l]) => <Th key={id} id={id}>{l}</Th>)}
                                </tr>
                                </thead>
                                <tbody>
                                {rows.map((r) => {
                                    const t = tiers.get(`${r.championKey}-${r.role}`);
                                    return (
                                        <tr key={`${r.championKey}-${r.role}`} className="border-b border-white/[0.04] transition hover:bg-white/[0.04]">
                                            <td className="px-3 py-2 text-white/40">{r.rank}</td>
                                            <td className="px-3 py-2">
                                                <Link href={`/champions/${r.championId}?${new URLSearchParams([...keep, ['role', r.role]])}`} className="flex items-center gap-3 font-medium hover:text-accent">
                                                    <Tile label={r.name} src={r.iconUrl} className="h-8 w-8" /> {r.name}
                                                </Link>
                                            </td>
                                            <td className="px-3 py-2 text-white/60">{ROLE_LABEL[r.role]}</td>
                                            <td className="px-3 py-2 text-center">
                                                <span className="inline-grid h-6 w-6 place-items-center rounded-md text-xs font-bold" style={{ color: TIER_STYLE[t], background: `${TIER_STYLE[t]}22` }}>{t}</span>
                                            </td>
                                            <td className={`px-3 py-2 text-right font-medium ${wrColor(r.winRate)}`}>{pct(r.winRate)}</td>
                                            <td className="px-3 py-2 text-right">{pct(r.pickRate)}</td>
                                            <td className="px-3 py-2 text-right">{pct(r.banRate)}</td>
                                            <td className="px-3 py-2 text-right text-white/60">{num(r.games)}</td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </Glass>
                    )}
        </>
    );
}

export default function Champions() {
    const [params, set] = useSearchParams();
    const view = params.get('view') === 'tier-list' ? 'tier-list' : 'grid';
    // Filters of one view don't leak into the other one
    const switchView = (v) => set(v === 'grid' ? { view: null, tier: null, role: null, queue: null, patch: null, sort: null, minGames: null } : { view: v, q: null, tag: null }, { replace: false });

    return (
        <div className="mx-auto max-w-7xl px-4 py-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-display text-5xl font-bold tracking-tighter drop-shadow-[0_6px_28px_rgba(94,225,255,.3)] sm:text-6xl">
                    <span className="text-shine">Champ</span><span className="text-accent-shine">ions.</span>
                </h1>
                <div role="tablist" className="flex gap-0.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
                    {[['grid', 'Champions', LayoutGrid], ['tier-list', 'Tier list', ListOrdered]].map(([id, l, Icon]) => (
                        <button key={id} role="tab" aria-selected={view === id} onClick={() => switchView(id)}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${view === id ? 'bg-white/[0.1] text-white' : 'text-white/55 hover:text-white'}`}>
                            <Icon size={15} className={view === id ? 'text-accent' : ''} aria-hidden /> {l}
                        </button>
                    ))}
                </div>
            </div>
            {view === 'grid' ? <Grid params={params} set={set} /> : <Table params={params} set={set} />}
        </div>
    );
}