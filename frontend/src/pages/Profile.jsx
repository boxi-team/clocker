import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Link2, LogOut, Shield, Sparkles, Filter, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Glass, Tile, RankBadge, WinDonut } from '../components/ui';
import RoleIcon from '../components/RoleIcon';
import MatchCard from '../components/MatchCard';
import RegionSelect from '../components/RegionSelect';
import { Label, pct, num, wrColor } from '../components/champion/common';
import { useRequest } from '../hooks/useRequest';
import { useAuth } from '../hooks/useAuth';
import { getSummoner, getMatchHistory, getMatchesStatus, refreshPlayer } from '../services/riotService';
import { ROLE_LABEL, SEARCH_REGIONS } from '../lib/constants';

const REGION_LIST = Object.keys(SEARCH_REGIONS);

function RankBlock({ title, r }) {
    const total = r.wins + r.losses;
    const wr = total > 0 ? (r.wins / total) * 100 : 0;
    return (
        <div className="py-4">
            <div className="flex items-center justify-between mb-2">
                <Label>{title}</Label>
                {total > 0 && (
                    <span className={`text-xs font-semibold tabular-nums ${wrColor(wr / 100)}`}>
                        {wr.toFixed(0)}% WR
                    </span>
                )}
            </div>
            <div className="flex items-center gap-4">
                <WinDonut wins={r.wins} losses={r.losses} size={58} />
                <div className="text-sm">
                    <p className="font-display text-base font-semibold text-white">
                        {r.tier} {r.div}
                    </p>
                    <p className="font-medium text-accent tabular-nums">{r.lp} LP</p>
                    <p className="text-xs text-white/50 tabular-nums">
                        <span className="text-win">{r.wins}W</span> · <span className="text-loss">{r.losses}L</span>
                        <span className="text-white/30 ml-1.5">({total} games)</span>
                    </p>
                </div>
            </div>
        </div>
    );
}

function Sidebar({ p, isOwnProfile, onOpenLinkModal, onLogout, user }) {
    return (
        <Glass className="flex flex-col overflow-hidden lg:h-full">
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {/* Header profil */}
                <div className="flex flex-col items-center gap-3 p-6 pb-4">
                    <div className="relative">
                        <div className="rounded-full bg-gradient-to-br from-accent to-violet p-[2.5px] shadow-[0_0_25px_rgba(94,225,255,0.25)]">
                            <Tile label={p.name} src={p.profileIcon} className="h-20 w-20 !rounded-full text-lg ring-4 ring-ink object-cover" />
                        </div>
                        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-ink px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-white shadow">
                            {p.level}
                        </span>
                    </div>

                    <div className="text-center mt-1">
                        <div className="flex items-center justify-center gap-2">
                            <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                                {p.name}
                                <span className="font-medium text-white/35">#{p.tag}</span>
                            </h2>
                            <span className="rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-white/70">
                                {p.region}
                            </span>
                        </div>

                        {/* Account Status Badge */}
                        {isOwnProfile && (
                            <div className="mt-2 flex flex-col items-center gap-1.5">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3 py-0.5 text-[11px] font-semibold text-accent shadow-[0_0_15px_rgba(94,225,255,0.2)]">
                                    <Sparkles size={11} />
                                    <span>Contul tău conectat</span>
                                </span>
                                {user?.email && (
                                    <span className="text-[10px] text-white/40">{user.email}</span>
                                )}
                            </div>
                        )}
                    </div>

                    <RankBadge tier={p.ranks.solo.tier} div={p.ranks.solo.div} />

                    {/* Own Profile Quick Actions */}
                    {isOwnProfile && (
                        <div className="mt-2 flex w-full gap-2 border-t border-white/[0.08] pt-3">
                            <button
                                onClick={onOpenLinkModal}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 text-xs font-semibold text-white/80 transition hover:border-accent/40 hover:bg-white/[0.08] hover:text-white"
                            >
                                <Link2 size={13} className="text-accent" />
                                <span>Schimbă Riot ID</span>
                            </button>
                            <button
                                onClick={onLogout}
                                className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
                                title="Deconectează contul"
                            >
                                <LogOut size={13} />
                                <span className="hidden sm:inline">Ieșire</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="divide-y divide-white/[0.07] px-6 pb-6">
                    <RankBlock title="Ranked Solo/Duo" r={p.ranks.solo} />
                    <RankBlock title="Ranked Flex" r={p.ranks.flex} />

                    <div className="py-5">
                        <Label>Top Campioni</Label>
                        <div className="space-y-1.5 mt-2">
                            {p.topChamps.map((c) => (
                                <div key={c.champ} className="-mx-2 flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition hover:bg-white/[0.04]">
                                    <Tile label={c.champ} src={c.img} className="h-10 w-10 !rounded-lg" />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-white leading-tight">{c.champ}</p>
                                        <p className="text-xs text-white/40">{c.games} jocuri</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold tabular-nums text-white leading-tight">{c.kda} KDA</p>
                                        <p className="text-xs text-white/40 tabular-nums">{c.csMin} CS/min</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </Glass>
    );
}

function aggregate(list) {
    const t = list.reduce((a, m) => ({
        games: a.games + 1, wins: a.wins + (m.win ? 1 : 0),
        k: a.k + m.k, d: a.d + m.d, a: a.a + m.a, cs: a.cs + m.cs, mins: a.mins + m.mins,
    }), { games: 0, wins: 0, k: 0, d: 0, a: 0, cs: 0, mins: 0 });
    return { ...t, winRate: t.games ? t.wins / t.games : 0, kda: (t.k + t.a) / Math.max(1, t.d), csPerMin: t.mins ? t.cs / t.mins : 0 };
}

function Performance({ matches }) {
    if (!matches?.length) return null;
    const all = aggregate(matches);
    const roles = Object.entries(Object.groupBy(matches.filter((m) => m.role), (m) => m.role))
        .map(([role, list]) => ({ role, ...aggregate(list) }))
        .sort((a, b) => b.games - a.games);
    return (
        <Glass className="grid gap-6 p-5 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8">
            <div>
                <Label>Ultimele {all.games} meciuri</Label>
                <div className="flex items-center gap-4 mt-2">
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
                <Label>Distribuție pe roluri</Label>
                {roles.length === 0 ? (
                    <p className="text-sm text-white/45 mt-2">Fără date despre roluri încă.</p>
                ) : (
                    <div className="space-y-2 mt-2">
                        {roles.map((r) => (
                            <div key={r.role} className="flex items-center gap-3 text-sm">
                                <RoleIcon role={r.role} className="h-5 w-5" />
                                <span className="w-16 shrink-0 font-medium">{ROLE_LABEL[r.role] ?? r.role}</span>
                                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                                    <div className="h-full rounded-full bg-gradient-to-r from-accent to-violet" style={{ width: `${(r.games / all.games) * 100}%` }} />
                                </div>
                                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-white/50">{r.games} {r.games === 1 ? 'meci' : 'meciuri'}</span>
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

const SkeletonRows = ({ n }) => Array.from({ length: n }, (_, i) => (
    <Glass key={i} className="h-[104px] p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
            <div className="skeleton h-14 w-14 !rounded-xl opacity-60" />
            <div className="space-y-2">
                <div className="skeleton h-4 w-28 !rounded-md opacity-60" />
                <div className="skeleton h-3 w-20 !rounded-md opacity-40" />
            </div>
        </div>
        <div className="hidden sm:flex items-center gap-3">
            <div className="skeleton h-8 w-24 !rounded-lg opacity-40" />
            <div className="skeleton h-8 w-32 !rounded-lg opacity-40" />
        </div>
    </Glass>
));

const GRID = 'mx-auto grid max-w-7xl items-start gap-6 px-4 lg:grid-cols-[320px_minmax(0,1fr)]';
const PAD = 'min-w-0 pt-6 pb-6 lg:h-[calc(100dvh-4.1rem)]';
const COL = `${PAD} lg:overflow-y-auto lg:overscroll-contain no-scrollbar`;
const COL_FIXED = PAD;

export default function Profile({ summoner, isOwnProfile = false, onBackToMyProfile }) {
    const { user, linkRiotAccount, logout } = useAuth();
    const [status, setStatus] = useState(null);
    const [version, setVersion] = useState(0);
    const [note, setNote] = useState('');
    const [polling, setPolling] = useState(0);
    const [partial, setPartial] = useState(0);

    // Filter queue state: 'all' | 'solo' | 'flex'
    const [queueFilter, setQueueFilter] = useState('all');

    // Link modal state
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [linkRiotId, setLinkRiotId] = useState('');
    const [linkRegion, setLinkRegion] = useState(summoner.region || 'EUW');
    const [linkError, setLinkError] = useState('');

    const profile = useRequest(() => getSummoner(summoner.name, summoner.region), [summoner.name, summoner.region, version]);
    const last = useRef(null);
    if (profile.data) last.current = profile.data;
    const p = profile.data ?? last.current;

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
                setPartial((n) => n + 1);
                timer = setTimeout(check, 2000);
            } else if (wasPending) {
                setVersion((v) => v + 1);
            }
        };
        check();
        return () => { alive = false; clearTimeout(timer); };
    }, [p?.puuid, polling]);

    const matches = useRequest(() => (p?.puuid ? getMatchHistory(p.puuid).catch(() => []) : []), [p?.puuid, version, partial]);

    const onRefresh = async () => {
        setNote('');
        const r = await refreshPlayer(p.puuid);
        if (!r.ok) { setNote(r.message ?? 'Încearcă din nou mai târziu'); return; }
        setStatus('pending');
        setPolling((n) => n + 1);
    };

    const handleLinkSubmit = (e) => {
        e.preventDefault();
        setLinkError('');
        if (!linkRiotId.trim()) {
            setLinkError('Introdu un Riot ID valid (Nume#TAG)');
            return;
        }
        try {
            linkRiotAccount({ riotId: linkRiotId.trim(), region: linkRegion });
            setLinkModalOpen(false);
            setLinkRiotId('');
            setVersion((v) => v + 1);
        } catch (err) {
            setLinkError(err.message || 'Eroare la asociere');
        }
    };

    if (!p) {
        return (
            <div className={GRID}>
                <div className={COL_FIXED}>
                    <Glass className="h-[640px] p-6 flex flex-col items-center gap-4">
                        <div className="skeleton h-20 w-20 !rounded-full mt-4 opacity-70" />
                        <div className="skeleton h-6 w-36 !rounded-lg opacity-60" />
                        <div className="skeleton h-24 w-24 !rounded-full my-3 opacity-50" />
                        <div className="w-full space-y-3 mt-4">
                            <div className="skeleton h-14 w-full !rounded-xl opacity-40" />
                            <div className="skeleton h-14 w-full !rounded-xl opacity-40" />
                            <div className="skeleton h-14 w-full !rounded-xl opacity-40" />
                        </div>
                    </Glass>
                </div>
                <div className={`${COL} space-y-3`}>
                    <SkeletonRows n={5} />
                </div>
            </div>
        );
    }

    const rawList = matches.data ?? [];
    const list = queueFilter === 'all'
        ? rawList
        : rawList.filter((m) => queueFilter === 'solo' ? m.mode.includes('Solo') : m.mode.includes('Flex'));

    const importing = status === 'pending';

    return (
        <div className={GRID}>
            {/* Sidebar cu profilul utilizatorului */}
            <div className={COL_FIXED}>
                <Sidebar
                    p={p}
                    isOwnProfile={isOwnProfile}
                    onOpenLinkModal={() => setLinkModalOpen(true)}
                    onLogout={logout}
                    user={user}
                />
            </div>

            {/* Partea dreaptă: stats + meciuri */}
            <div className={`${COL} space-y-4`}>
                {!isOwnProfile && onBackToMyProfile && (
                    <div className="flex items-center justify-between rounded-2xl border border-accent/25 bg-accent/5 p-3.5 text-xs text-white/80 shadow-[0_0_20px_rgba(94,225,255,0.1)]">
                        <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                            <span>Vizualizezi profilul căutat: <strong className="text-white font-semibold">{p.name}#{p.tag}</strong></span>
                        </span>
                        <button
                            onClick={onBackToMyProfile}
                            className="rounded-xl bg-accent px-3 py-1.5 font-bold text-ink hover:bg-white transition shadow-sm"
                        >
                            Înapoi la profilul meu
                        </button>
                    </div>
                )}

                <Performance matches={rawList} />

                {/* Match history header with Filters */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-white/50">Istoric meciuri</h2>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60 tabular-nums">
                            {list.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Queue Filters */}
                        <div className="flex rounded-xl border border-white/10 bg-white/[0.04] p-1 text-xs">
                            <button
                                onClick={() => setQueueFilter('all')}
                                className={`rounded-lg px-2.5 py-1 font-medium transition ${
                                    queueFilter === 'all' ? 'bg-accent text-ink font-bold shadow' : 'text-white/60 hover:text-white'
                                }`}
                            >
                                Toate
                            </button>
                            <button
                                onClick={() => setQueueFilter('solo')}
                                className={`rounded-lg px-2.5 py-1 font-medium transition ${
                                    queueFilter === 'solo' ? 'bg-accent text-ink font-bold shadow' : 'text-white/60 hover:text-white'
                                }`}
                            >
                                Solo/Duo
                            </button>
                            <button
                                onClick={() => setQueueFilter('flex')}
                                className={`rounded-lg px-2.5 py-1 font-medium transition ${
                                    queueFilter === 'flex' ? 'bg-accent text-ink font-bold shadow' : 'text-white/60 hover:text-white'
                                }`}
                            >
                                Flex
                            </button>
                        </div>

                        {note && <span className="text-xs text-loss">{note}</span>}
                        <button
                            onClick={onRefresh}
                            disabled={importing}
                            className="flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.1] disabled:opacity-50"
                        >
                            <RefreshCw size={13} className={importing ? 'animate-spin' : ''} />
                            <span>{importing ? 'Actualizare…' : 'Update'}</span>
                        </button>
                    </div>
                </div>

                {list.length === 0 && (matches.loading || importing) && <SkeletonRows n={5} />}
                {list.length === 0 && !matches.loading && !importing && (
                    <Glass className="p-8 text-center text-white/60">
                        Niciun meci ranked găsit pentru filtrul selectat.
                    </Glass>
                )}

                {list.map((m, i) => (
                    <MatchCard key={m.id} m={m} i={i} puuid={p.puuid} />
                ))}
            </div>

            {/* Modal Schimbă Riot ID */}
            {linkModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
                    <Glass className="w-full max-w-md p-6 animate-rise">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2 text-white">
                                <Link2 size={18} className="text-accent" />
                                <h3 className="font-display font-semibold">Schimbă contul Riot asociat</h3>
                            </div>
                            <button
                                onClick={() => setLinkModalOpen(false)}
                                className="rounded-lg p-1 text-white/40 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleLinkSubmit} className="mt-4 space-y-4">
                            {linkError && <p className="text-xs text-loss">{linkError}</p>}
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-white/70">
                                    Riot ID Nou (Game Name#TAG)
                                </label>
                                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-2 pl-3">
                                    <input
                                        type="text"
                                        value={linkRiotId}
                                        onChange={(e) => setLinkRiotId(e.target.value)}
                                        placeholder="ex: Caps#EUW sau Faker#KR1"
                                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                                        autoFocus
                                    />
                                    <RegionSelect value={linkRegion} onChange={setLinkRegion} options={REGION_LIST} />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setLinkModalOpen(false)}
                                    className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/5"
                                >
                                    Anulează
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-ink hover:bg-white shadow-[0_0_15px_rgba(94,225,255,0.4)]"
                                >
                                    Actualizează Profilul
                                </button>
                            </div>
                        </form>
                    </Glass>
                </div>
            )}
        </div>
    );
}
