import { useMemo, useState } from 'react';
import { LayoutGrid, ListOrdered, Search, ArrowDown, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { Glass, Tile } from '../components/ui';
import Link from '../components/Link';
import RoleIcon from '../components/RoleIcon';
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

// ── Lane selector (shared between TierCards and other views) ──
const LANE_OPTIONS = [
    { key: '', label: 'All Roles' },
    ...ROLES.map((r) => ({ key: r, label: ROLE_LABEL[r] })),
];

function LaneSelector({ value, onChange }) {
    return (
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
            {LANE_OPTIONS.map(({ key, label }) => {
                const active = value === key;
                return (
                    <button key={key} onClick={() => onChange(key)}
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${active ? 'bg-white/[0.12] text-white shadow-sm' : 'text-white/55 hover:text-white'}`}>
                        {key ? <RoleIcon role={key} className={`h-3.5 w-3.5 ${active ? '' : 'opacity-50'}`} /> : null}
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

// ── Tier Cards view: ONLY S+, S, A (compact & scroll-free) ──
const CARD_TIERS = [
    { key: 'S+', label: 'S+', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)' },
    { key: 'S',  label: 'S',  color: '#5ee1ff', bg: 'rgba(94,225,255,0.10)', border: 'rgba(94,225,255,0.3)' },
    { key: 'A',  label: 'A',  color: '#8b7bff', bg: 'rgba(139,123,255,0.10)', border: 'rgba(139,123,255,0.3)' },
];

function TierCards({ params, set }) {
    const role = params.get('role') || '';
    const minGamesParam = parseInt(params.get('minGames') || '10', 10);
    const f = {
        tier: params.get('tier') || DEFAULTS.tier,
        queue: params.get('queue') || DEFAULTS.queue,
        patch: params.get('patch') || DEFAULTS.patch,
        role: role || undefined,
        sort: 'score',
        minGames: Math.max(10, minGamesParam), // enforce at least 10 games
        limit: 500,
    };
    const patches = useRequest(() => getPatches().catch(() => ({ data: [] })), []);
    const { data, error, loading, retry } = useRequest(() => getTierList(f), [JSON.stringify(f)]);

    const minors = [...new Set((patches.data?.data ?? []).map((p) => p.version.split('.').slice(0, 2).join('.')))];
    const rawRows = data?.data ?? [];

    // Filter out champions with under 10 games or under 43% win rate
    const rows = useMemo(() => rawRows.filter((r) => r.games >= 10 && r.winRate >= 0.43), [rawRows]);

    // Group top champions into ONLY S+, S, A (max 12 champions per tier: 4 rows x 3 columns)
    const grouped = useMemo(() => {
        const sorted = [...rows].sort((a, b) => b.score - a.score);
        const groups = CARD_TIERS.map((t) => ({ ...t, items: [] }));
        if (sorted.length === 0) return groups;

        // Distribute top champions into S+, S, A (up to 12 champions per tier)
        const perTier = Math.min(12, Math.max(3, Math.ceil(sorted.length / 3)));
        sorted.slice(0, perTier * 3).forEach((r, i) => {
            const tierIdx = Math.floor(i / perTier);
            if (tierIdx < 3) {
                groups[tierIdx].items.push(r);
            }
        });
        return groups;
    }, [rows]);

    return (
        <div className="space-y-3">
            {/* Header matching original tierlist banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
                <div className="flex items-center gap-2 text-sm">
                    <span className="h-4 w-1 rounded-full bg-accent" />
                    <span className="font-display font-bold text-white">Tier List</span>
                    <span className="text-white/40">
                        The best champions for <span className="font-semibold text-accent">{role ? ROLE_LABEL[role] : 'All Roles'}</span> in patch {data?.meta?.patch ?? 'latest'}
                    </span>
                </div>
                {data?.meta && (
                    <span className="text-xs text-white/35 tabular-nums">
                        {num(data.meta.totalMatches)} matches
                    </span>
                )}
            </div>

            {/* Controls bar: Lane Selector + compact filters */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
                <LaneSelector value={role} onChange={(v) => set({ role: v || null })} />
                <div className="flex flex-wrap items-center gap-2">
                    <Select label="Rank" value={f.tier} onChange={(v) => set({ tier: v === DEFAULTS.tier ? null : v })} options={TIERS.map((t) => [t, tierLabel(t)])} className="!text-[10px]" />
                    <Select label="Queue" value={f.queue} onChange={(v) => set({ queue: v === DEFAULTS.queue ? null : v })} options={QUEUES.map((x) => [x, QUEUE_LABEL[x]])} className="!text-[10px]" />
                    <Select label="Patch" value={f.patch} onChange={(v) => set({ patch: v === 'latest' ? null : v })} options={[['latest', 'Latest'], ...minors.map((m) => [m, m])]} className="!text-[10px]" />
                    <Select label="Min games" value={String(f.minGames)} onChange={(v) => set({ minGames: v === '10' ? null : v })} options={['10', '25', '50', '100', '200'].map((x) => [x, `${x}+`])} className="!text-[10px]" />
                </div>
            </div>

            {/* Visual Tier Cards (S+, S, A only) */}
            {error ? <ErrorState error={error} onRetry={retry} />
                : loading && !data ? <div className="skeleton h-80" />
                    : rows.length === 0 ? <EmptyState>No champions with 10+ games found for these filters.</EmptyState>
                        : (
                            <div className={`grid gap-3 md:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
                                {grouped.map((group) => (
                                    <div key={group.key} className="flex flex-col rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5 backdrop-blur-sm">
                                        {/* Tier badge header */}
                                        <div className="mb-2 flex items-center justify-center">
                                            <span className="rounded-md border px-3 py-0.5 text-xs font-bold tracking-wider"
                                                  style={{ color: group.color, borderColor: group.border, background: group.bg }}>
                                                {group.label}
                                            </span>
                                        </div>

                                        {/* Champions 3x4 grid */}
                                        {group.items.length === 0 ? (
                                            <p className="py-6 text-center text-xs text-white/30">No champions in this tier</p>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-1.5">
                                                {group.items.map((r) => (
                                                    <Link key={`${r.championKey}-${r.role}`}
                                                          href={`/champions/${r.championId}?tier=${f.tier}&role=${r.role}`}
                                                          className="group rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
                                                        <div className="flex flex-col items-center gap-1 rounded-lg border border-white/[0.05] bg-white/[0.02] p-1.5 text-center transition hover:border-white/[0.15] hover:bg-white/[0.06] group-hover:-translate-y-0.5">
                                                            <div className="relative">
                                                                <Tile label={r.name} src={r.iconUrl} className="h-10 w-10 !rounded-lg" />
                                                                <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded border border-white/10 bg-ink/90">
                                                                    <RoleIcon role={r.role} className="h-2.5 w-2.5" />
                                                                </span>
                                                            </div>
                                                            <p className="w-full truncate text-[11px] font-semibold leading-tight">{r.name}</p>
                                                            <p className={`text-[10px] font-bold tabular-nums ${wrColor(r.winRate)}`}>{pct(r.winRate)} WR</p>
                                                            <p className="text-[9px] text-white/35 tabular-nums">{num(r.games)} games</p>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
        </div>
    );
}

const COLS = [
    ['winRate', 'Win rate'], ['pickRate', 'Pick rate'], ['banRate', 'Ban rate'], ['games', 'Games'],
];

function Table({ params, set }) {
    const f = {
        tier: params.get('tier') || DEFAULTS.tier, queue: params.get('queue') || DEFAULTS.queue,
        patch: params.get('patch') || DEFAULTS.patch, role: params.get('role') || undefined,
        sort: params.get('sort') || 'score', minGames: params.get('minGames') || 10, limit: 500,
    };
    const patches = useRequest(() => getPatches().catch(() => ({ data: [] })), []);
    const { data, error, loading, retry } = useRequest(() => getTierList(f), [JSON.stringify(f)]);

    const minors = [...new Set((patches.data?.data ?? []).map((p) => p.version.split('.').slice(0, 2).join('.')))];
    const rawRows = data?.data ?? [];
    const rows = useMemo(() => rawRows.filter((r) => r.games >= 10 && r.winRate >= 0.43), [rawRows]);
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
                <Select label="Min games" value={String(f.minGames)} onChange={(v) => set({ minGames: v === '10' ? null : v })} options={['10', '25', '50', '100', '200'].map((x) => [x, x])} />
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
    const viewParam = params.get('view');
    const view = viewParam === 'tier-list' ? 'tier-list' : viewParam === 'tier-cards' ? 'tier-cards' : 'grid';
    // Filters of one view don't leak into the other one
    const switchView = (v) => set(v === 'grid' ? { view: null, tier: null, role: null, queue: null, patch: null, sort: null, minGames: null } : { view: v, q: null, tag: null }, { replace: false });

    return (
        <div className="mx-auto max-w-7xl px-4 py-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-display text-5xl font-bold tracking-tighter drop-shadow-[0_6px_28px_rgba(94,225,255,.3)] sm:text-6xl">
                    <span className="text-shine">Champ</span><span className="text-accent-shine">ions.</span>
                </h1>
                <div role="tablist" className="flex gap-0.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
                    {[['grid', 'Champions', LayoutGrid], ['tier-cards', 'Tier List', Layers], ['tier-list', 'Table', ListOrdered]].map(([id, l, Icon]) => (
                        <button key={id} role="tab" aria-selected={view === id} onClick={() => switchView(id)}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${view === id ? 'bg-white/[0.1] text-white' : 'text-white/55 hover:text-white'}`}>
                            <Icon size={15} className={view === id ? 'text-accent' : ''} aria-hidden /> {l}
                        </button>
                    ))}
                </div>
            </div>
            {view === 'grid' ? <Grid params={params} set={set} /> : view === 'tier-cards' ? <TierCards params={params} set={set} /> : <Table params={params} set={set} />}
        </div>
    );
}