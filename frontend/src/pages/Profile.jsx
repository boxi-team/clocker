import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Glass, Tile, RankBadge, WinDonut } from '../components/ui';
import MatchCard from '../components/MatchCard';
import { useAsync } from '../hooks/useAsync';
import { getSummoner, getMatchHistory, getMatchesStatus, refreshPlayer } from '../services/riotService';

const SectionLabel = ({ children }) => (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">{children}</p>
);

function RankBlock({ title, r }) {
    return (
        <div className="mt-5 border-t border-white/[0.07] pt-5">
            <SectionLabel>{title}</SectionLabel>
            <div className="flex items-center gap-4">
                <WinDonut wins={r.wins} losses={r.losses} />
                <div className="text-sm">
                    <p className="font-display text-base font-semibold">{r.tier} {r.div}</p>
                    <p className="font-medium text-accent tabular-nums">{r.lp} LP</p>
                    <p className="text-xs text-white/50 tabular-nums"><span className="text-win">{r.wins}W</span> · <span className="text-loss">{r.losses}L</span></p>
                </div>
            </div>
        </div>
    );
}

function Sidebar({ p }) {
    return (
        <Glass className="h-fit p-6 lg:sticky lg:top-24">
            <div className="flex flex-col items-center gap-3">
                <div className="relative">
                    <div className="rounded-full bg-gradient-to-br from-accent to-violet p-[2px]">
                        <Tile label={p.name} src={p.profileIcon} className="h-20 w-20 !rounded-full text-lg ring-4 ring-ink" />
                    </div>
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-ink px-2 py-0.5 text-[11px] font-semibold tabular-nums">{p.level}</span>
                </div>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">{p.name}<span className="font-medium text-white/35">#{p.tag}</span></h2>
                <RankBadge tier={p.ranks.solo.tier} div={p.ranks.solo.div} />
            </div>
            <RankBlock title="Ranked Solo/Duo" r={p.ranks.solo} />
            <RankBlock title="Ranked Flex" r={p.ranks.flex} />
            <div className="mt-5 border-t border-white/[0.07] pt-5">
                <SectionLabel>Top champions</SectionLabel>
                <div className="space-y-1">
                    {p.topChamps.map((c) => (
                        <div key={c.champ} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-white/[0.04]">
                            <Tile label={c.champ} src={c.img} className="h-9 w-9" />
                            <span className="flex-1 font-medium">{c.champ}<span className="block text-xs font-normal text-white/40">{c.games} games</span></span>
                            <span className="text-right font-medium tabular-nums">{c.kda} KDA<span className="block text-xs font-normal text-white/40">{c.csMin} CS/min</span></span>
                        </div>
                    ))}
                </div>
            </div>
        </Glass>
    );
}

const SkeletonRows = ({ n }) => Array.from({ length: n }, (_, i) => <div key={i} className="skeleton h-[104px]" />);

export default function Profile({ summoner }) {
    const p = useAsync(
        () => getSummoner(summoner.name, summoner.region).catch((e) => ({ error: e.message })),
        [summoner.name, summoner.region],
    );

    const [status, setStatus] = useState(null);   // 'pending' | 'ready' | 'empty'
    const [version, setVersion] = useState(0);    // crește când trebuie reîncărcate meciurile
    const [note, setNote] = useState('');
    const [polling, setPolling] = useState(0);    // crește când pornim un refresh, ca să repornească polling-ul

    // Verifică statusul importului; cât e 'pending', reîntreabă la 3s. Când se termină, reîncarcă meciurile.
    useEffect(() => {
        if (!p?.puuid) return;
        let alive = true, timer, wasPending = false;
        const check = async () => {
            let s;
            try { s = await getMatchesStatus(p.puuid); } catch { return; }
            if (!alive) return;
            setStatus(s);
            if (s === 'pending') {
                wasPending = true;
                timer = setTimeout(check, 3000);
            } else if (wasPending) {
                setVersion((v) => v + 1);
            }
        };
        check();
        return () => { alive = false; clearTimeout(timer); };
    }, [p?.puuid, polling]);

    const matches = useAsync(() => getMatchHistory(p?.puuid), [p?.puuid, version]);

    const onRefresh = async () => {
        setNote('');
        const r = await refreshPlayer(p.puuid);
        if (!r.ok) { setNote(r.message ?? 'Try again later'); return; }
        setStatus('pending');
        setPolling((n) => n + 1);
    };

    if (p?.error) {
        return (
            <Glass className="mx-auto mt-20 max-w-md p-8 text-center">
                <h2 className="font-display text-xl font-semibold">Couldn&apos;t load {summoner.name}</h2>
                <p className="mt-2 text-white/60">{p.error}</p>
            </Glass>
        );
    }

    if (!p) {
        return (
            <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[320px_1fr]">
                <div className="skeleton h-[640px]" />
                <div className="space-y-3"><SkeletonRows n={5} /></div>
            </div>
        );
    }

    return (
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[320px_1fr]">
            <Sidebar p={p} />
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Match history</h2>
                    <div className="flex items-center gap-3">
                        {note && <span className="text-xs text-loss">{note}</span>}
                        <button onClick={onRefresh} disabled={status === 'pending'}
                                className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-sm font-medium transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60">
                            <RefreshCw size={14} aria-hidden className={status === 'pending' ? 'animate-spin' : ''} />
                            {status === 'pending' ? 'Updating…' : 'Update'}
                        </button>
                    </div>
                </div>
                {matches === null && <SkeletonRows n={5} />}
                {matches?.length === 0 && (
                    <Glass className="p-8 text-center text-white/60">
                        No ranked games indexed yet. They show up here once the import finishes.
                    </Glass>
                )}
                {matches?.map((m, i) => <MatchCard key={m.id} m={m} i={i} puuid={p.puuid} />)}
            </div>
        </div>
    );
}