import { useMemo, useState } from 'react';
import { Search, Info } from 'lucide-react';
import { Glass, Tile, TIER_COLOR } from '../components/ui';
import { EmptyState, ErrorState, num, wrColor } from '../components/champion/common';
import RegionSelect from '../components/RegionSelect';
import { useRequest } from '../hooks/useRequest';
import { useSearchParams } from '../hooks/useUrl';
import { getLeaderboard } from '../services/riotService';
import { LEADERBOARD_TIERS, LEADERBOARD_REGIONS, LEADERBOARD_DEFAULTS } from '../lib/constants';

const PODIUM = ['text-amber-300', 'text-slate-300', 'text-orange-400'];
const label = (t) => t[0].toUpperCase() + t.slice(1);

const TierChip = ({ tier, active, onClick }) => {
    const c = TIER_COLOR[label(tier)] ?? '#fff';
    return (
        <button onClick={onClick} aria-pressed={active}
                className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${active ? 'border-white/25 bg-white/[0.1] text-white' : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white'}`}>
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: c, boxShadow: active ? `0 0 10px ${c}` : 'none' }} />
            {label(tier)}
        </button>
    );
};

function Row({ r, tierLabel, onOpen }) {
    const c = TIER_COLOR[tierLabel] ?? TIER_COLOR[r.tier] ?? '#fff';
    const total = r.wins + r.losses;
    return (
        <tr className="border-b border-white/[0.04] transition hover:bg-white/[0.04]">
            <td className={`px-3 py-2 font-display font-bold tabular-nums ${PODIUM[r.rank - 1] ?? 'text-white/40'}`}>{r.rank}</td>
            <td className="px-3 py-2">
                <button onClick={() => onOpen(r)} className="flex items-center gap-3 text-left font-medium outline-none hover:text-accent focus-visible:text-accent">
                    <Tile label={r.name} src={r.icon} className="h-9 w-9 !rounded-full" />
                    <span className="truncate">{r.name}<span className="text-white/35">#{r.tag}</span></span>
                </button>
            </td>
            <td className="px-3 py-2 font-semibold" style={{ color: c }}>{tierLabel} {r.div}</td>
            <td className="px-3 py-2 text-right font-semibold tabular-nums text-accent">{num(r.lp)} LP</td>
            <td className="hidden px-3 py-2 text-right tabular-nums text-white/60 sm:table-cell">
                <span className="text-win">{r.wins}W</span> · <span className="text-loss">{r.losses}L</span>
            </td>
            <td className="w-40 px-3 py-2">
                <div className="flex items-center justify-end gap-2">
                    <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.08] md:block">
                        <div className="h-full rounded-full bg-gradient-to-r from-accent to-violet" style={{ width: `${total ? (r.wins / total) * 100 : 0}%` }} />
                    </div>
                    <span className={`w-12 text-right font-semibold tabular-nums ${wrColor(r.wr / 100)}`}>{r.wr}%</span>
                </div>
            </td>
        </tr>
    );
}

export default function Leaderboard({ onSearch }) {
    const [params, set] = useSearchParams();
    const [q, setQ] = useState('');

    const region = LEADERBOARD_REGIONS.includes(params.get('region')) ? params.get('region') : LEADERBOARD_DEFAULTS.region;
    const tier = LEADERBOARD_TIERS.includes(params.get('tier')) ? params.get('tier') : LEADERBOARD_DEFAULTS.tier;

    const { data, error, loading, retry } = useRequest(
        () => getLeaderboard(region, tier, LEADERBOARD_DEFAULTS.limit),
        [region, tier],
    );

    const rows = data?.rows ?? [];
    const shown = useMemo(() => {
        let list = rows;
        const s = q.trim().toLowerCase();
        if (s) list = list.filter((r) => r.name.toLowerCase().includes(s));
        return [...list].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    }, [rows, q]);

    const open = (r) => onSearch(`${r.name}#${r.tag}`, region);

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <h1 className="font-display text-5xl font-bold tracking-tighter drop-shadow-[0_6px_28px_rgba(94,225,255,.3)] sm:text-6xl">
                    <span className="text-shine">Leader</span><span className="text-accent-shine">boards.</span>
                </h1>
                <RegionSelect
                    value={region}
                    onChange={(v) => set({ region: v === LEADERBOARD_DEFAULTS.region ? null : v })}
                    options={LEADERBOARD_REGIONS}
                />
            </div>

            <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Tier">
                {LEADERBOARD_TIERS.map((t) => (
                    <TierChip key={t} tier={t} active={t === tier} onClick={() => { setQ(''); set({ tier: t === LEADERBOARD_DEFAULTS.tier ? null : t }); }} />
                ))}
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 transition focus-within:border-accent/50">
                    <Search size={14} className="text-white/40" aria-hidden />
                    <span className="sr-only">Filter players</span>
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name"
                           className="w-48 bg-transparent text-sm outline-none placeholder:text-white/35" />
                </label>
                {data && (
                    <span className="ml-auto text-sm tabular-nums text-white/40">
                        {q ? `${shown.length} of ${rows.length}` : rows.length} players · Top 50 {label(tier)} · {region}
                    </span>
                )}
            </div>

            <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-white/55 backdrop-blur-sm">
                <Info size={15} className="shrink-0 text-accent/80" aria-hidden />
                <span>
                    {['challenger', 'grandmaster', 'master'].includes(tier)
                        ? 'Apex tiers (Master+) are fully synchronized with official Riot live ladder standings.'
                        : 'Leaderboard rankings for division tiers (Iron–Diamond) are sampled from active ladder pages and may not reflect exact live LP standings due to API sample limits.'}
                </span>
            </div>

            {error ? <ErrorState error={error} onRetry={retry} />
                : loading && !data ? <div className="skeleton h-[640px]" />
                    : rows.length === 0 ? <EmptyState className="py-10">No {label(tier)} players found in {region} yet.</EmptyState>
                        : shown.length === 0 ? <EmptyState>No player matches “{q}”.</EmptyState> : (
                            <Glass className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
                                <table className="w-full min-w-[560px] text-sm tabular-nums">
                                    <thead className="border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-white/40">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-semibold">#</th>
                                        <th className="px-3 py-2 text-left font-semibold">Player</th>
                                        <th className="px-3 py-2 text-left font-semibold">Rank</th>
                                        <th className="px-3 py-2 text-right font-semibold">LP</th>
                                        <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Record</th>
                                        <th className="px-3 py-2 text-right font-semibold">Win rate</th>
                                    </tr>
                                    </thead>
                                    <tbody key={`${region}-${tier}`}>
                                        {shown.map((r, i) => (
                                            <Row key={`${region}-${tier}-${r.puuid || i}-${r.rank}`} r={r} tierLabel={label(tier)} onOpen={open} />
                                        ))}
                                    </tbody>
                                </table>
                            </Glass>
                        )}
            <p className="mt-3 text-xs text-white/35">Click a player to open their profile.</p>
        </div>
    );
}