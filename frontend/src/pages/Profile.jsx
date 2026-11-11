import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Glass, Tile, RankBadge, WinDonut } from '../components/ui';
import RoleIcon from '../components/RoleIcon';
import MatchCard from '../components/MatchCard';
import { Label, pct, num, wrColor } from '../components/champion/common';
import { useRequest } from '../hooks/useRequest';
import { getSummoner, getMatchHistory, getMatchesStatus, refreshPlayer } from '../services/riotService';
import { ROLE_LABEL } from '../lib/constants';

function RankBlock({ title, r }) {
    return (
        <div className="py-5">
            <Label>{title}</Label>
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
        <Glass className="flex flex-col overflow-hidden !backdrop-blur-none lg:h-full">
            {/* Un singur container scrollabil: rotița merge oriunde pe sidebar */}
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {/* Header sticky: rămâne sus, conținutul trece pe sub el */}
                <div className="sticky top-0 z-10 flex flex-col items-center gap-3 border-b border-white/[0.08] bg-white/[0.04] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_8px_32px_-12px_rgba(0,0,0,.5)] backdrop-blur-(--nav-blur) backdrop-saturate-150">
                    <div className="relative">
                        <div className="rounded-full bg-gradient-to-br from-accent to-violet p-[2px]">
                            <Tile label={p.name} src={p.profileIcon} className="h-20 w-20 !rounded-full text-lg ring-4 ring-ink" />
                        </div>
                        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-ink px-2 py-0.5 text-[11px] font-semibold tabular-nums">{p.level}</span>
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">{p.name}<span className="font-medium text-white/35">#{p.tag}</span></h2>
                    <RankBadge tier={p.ranks.solo.tier} div={p.ranks.solo.div} />
                </div>

                <div className="divide-y divide-white/[0.07] px-6">
                    <RankBlock title="Ranked Solo/Duo" r={p.ranks.solo} />
                    <RankBlock title="Ranked Flex" r={p.ranks.flex} />
                    <div className="py-5">
                        <Label>Top champions</Label>
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
                </div>
            </div>
        </Glass>
    );
}

// Sums a list of matches into totals (kda = (k + a) / max(1, d), cs/min = total cs / total minutes).
function aggregate(list) {
    const t = list.reduce((a, m) => ({
        games: a.games + 1, wins: a.wins + (m.win ? 1 : 0),
        k: a.k + m.k, d: a.d + m.d, a: a.a + m.a, cs: a.cs + m.cs, mins: a.mins + m.mins,
    }), { games: 0, wins: 0, k: 0, d: 0, a: 0, cs: 0, mins: 0 });
    return { ...t, winRate: t.games ? t.wins / t.games : 0, kda: (t.k + t.a) / Math.max(1, t.d), csPerMin: t.mins ? t.cs / t.mins : 0 };
}

// Everything here is computed from the same (last 20) matches that the list below shows.
function Performance({ matches }) {
    if (!matches?.length) return null;
    const all = aggregate(matches);
    const roles = Object.entries(Object.groupBy(matches.filter((m) => m.role), (m) => m.role))
        .map(([role, list]) => ({ role, ...aggregate(list) }))
        .sort((a, b) => b.games - a.games);
    return (
        <Glass className="grid gap-6 p-5 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8">
            <div>
                <Label>Last {all.games} games</Label>
                <div className="flex items-center gap-4">
                    <WinDonut wins={all.wins} losses={all.games - all.wins} size={72} />
                    <div className="text-sm">
                        <p className="font-display text-lg font-semibold tabular-nums">
                            <span className="text-win">{all.wins}W</span> · <span className="text-loss">{all.games - all.wins}L</span>
                        </p>
                        <p className="text-xs tabular-nums text-white/45">{num(all.kda, 2)} KDA</p>
                        <p className="text-xs tabular-nums text-white/45">{num(all.csPerMin, 1)} CS/min</p>
                    </div>
                </div>
            </div>
            <div className="min-w-0">
                <Label>Roles</Label>
                {roles.length === 0 ? (
                    <p className="text-sm text-white/45">No role data yet.</p>
                ) : (
                    <div className="space-y-2">
                        {roles.map((r) => (
                            <div key={r.role} className="flex items-center gap-3 text-sm">
                                <RoleIcon role={r.role} className="h-5 w-5" />
                                <span className="w-16 shrink-0 font-medium">{ROLE_LABEL[r.role] ?? r.role}</span>
                                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                                    <div className="h-full rounded-full bg-gradient-to-r from-accent to-violet" style={{ width: `${(r.games / all.games) * 100}%` }} />
                                </div>
                                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-white/50">{r.games} {r.games === 1 ? 'game' : 'games'}</span>
                                <span className={`w-12 shrink-0 text-right font-semibold tabular-nums ${wrColor(r.winRate)}`}>{pct(r.winRate, 0)}</span>
                                <span className="hidden w-40 shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-white/50 sm:block">{num(r.kda, 2)} KDA · {num(r.csPerMin, 1)} CS/min</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Glass>
    );
}

const SkeletonRows = ({ n }) => Array.from({ length: n }, (_, i) => <div key={i} className="skeleton h-[104px]" />);


const GRID = 'mx-auto grid max-w-7xl items-start gap-6 px-4 lg:grid-cols-[320px_minmax(0,1fr)]';
const PAD = 'min-w-0 pt-[calc(4.1rem+1.5rem)] pb-6 lg:h-dvh';
const COL = `${PAD} lg:overflow-y-auto lg:overscroll-contain no-scrollbar`; // dreapta: scroll propriu
const COL_FIXED = PAD;                                                      // stânga: fără scroll, Sidebar-ul se ocupă

export default function Profile({ summoner }) {
    const [status, setStatus] = useState(null);   // 'pending' | 'ready' | 'empty'
    const [version, setVersion] = useState(0);    // crește când importul s-a terminat: reîncarcă profil și meciuri
    const [note, setNote] = useState('');
    const [polling, setPolling] = useState(0);    // crește când pornim un refresh, ca să repornească polling-ul

    // Profile (rank, LP, level...). Refetched after an update; the previous data stays on screen meanwhile.
    const profile = useRequest(() => getSummoner(summoner.name, summoner.region), [summoner.name, summoner.region, version]);
    const last = useRef(null);
    if (profile.data) last.current = profile.data;
    const p = profile.data ?? last.current;

    // Verifică statusul importului; cât e 'pending', reîntreabă la 3s. Când se termină, reîncarcă totul.
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

    const matches = useRequest(() => (p?.puuid ? getMatchHistory(p.puuid).catch(() => []) : []), [p?.puuid, version]);

    const onRefresh = async () => {
        setNote('');
        const r = await refreshPlayer(p.puuid);
        if (!r.ok) { setNote(r.message ?? 'Try again later'); return; }
        setStatus('pending');
        setPolling((n) => n + 1);
    };

    if (!p && profile.error) {
        return (
            <Glass className="mx-auto mt-20 max-w-md p-8 text-center">
                <h2 className="font-display text-xl font-semibold">Couldn&apos;t load {summoner.name}</h2>
                <p className="mt-2 text-white/60">{profile.error.message}</p>
                <button onClick={profile.retry} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm transition hover:bg-white/[0.1]">
                    <RefreshCw size={14} aria-hidden /> Retry
                </button>
            </Glass>
        );
    }

    if (!p) {
        return (
            <div className={GRID}>
                <div className={COL_FIXED}><div className="skeleton h-[640px]" /></div>
                <div className={`${COL} space-y-3`}><SkeletonRows n={5} /></div>
            </div>
        );
    }

    const list = matches.data ?? [];
    const importing = status === 'pending';

    return (
        <div className={GRID}>
            {/* Left: profile. Header fix, conținutul scrollează în interior. */}
            <div className={COL_FIXED}>
                <Sidebar p={p} />
            </div>

            {/* Right: stats + matches. Scrolls on its own. */}
            <div className={`${COL} space-y-3`}>
                <Performance matches={list} />
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Match history</h2>
                    <div className="flex items-center gap-3">
                        {note && <span className="text-xs text-loss">{note}</span>}
                        <button onClick={onRefresh} disabled={importing}
                                className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-sm font-medium transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60">
                            <RefreshCw size={14} aria-hidden className={importing ? 'animate-spin' : ''} />
                            {importing ? 'Updating…' : 'Update'}
                        </button>
                    </div>
                </div>
                {list.length === 0 && (matches.loading || importing) && <SkeletonRows n={5} />}
                {list.length === 0 && !matches.loading && !importing && (
                    <Glass className="p-8 text-center text-white/60">
                        No ranked games indexed yet. They show up here once the import finishes.
                    </Glass>
                )}
                {list.map((m, i) => <MatchCard key={m.id} m={m} i={i} puuid={p.puuid} />)}
            </div>
        </div>
    );
}