import { useState } from 'react';
import { Eye, ChevronDown } from 'lucide-react';
import { Glass, Tile } from './ui.jsx';
import RoleIcon from './RoleIcon';
import { useAsync } from '../hooks/useAsync';
import { getMatchDetail } from '../services/riotService';

const kdaRatio = (k, d, a) => (d === 0 ? 'Perfect' : ((k + a) / d).toFixed(2));
const csPerMin = (cs, mins) => (cs / mins).toFixed(1);
const ico = (x) => (typeof x === 'string' ? { name: x } : x); // string (mock) sau { name, img }

// Fixed column widths: header labels and rows share them, so the table never changes size.
const COL = {
    role: 'w-5', champ: 'w-[104px]', player: 'w-40', kda: 'w-20', dmg: 'w-20',
    gold: 'w-12', cs: 'w-9', vis: 'w-9',
};

// ---------- tabelul cu toți jucătorii (se încarcă doar când cardul e deschis) ----------
function TeamTable({ team, maxDmg, puuid }) {
    const blue = team.teamId === 100;
    return (
        <div className="min-w-[870px]">
            <div className="flex items-center gap-2 px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-[0.14em]">
                <span className={team.win ? 'text-win' : 'text-loss'}>{team.win ? 'Victory' : 'Defeat'}</span>
                <span className="font-medium normal-case tracking-normal text-white/40">({blue ? 'Blue' : 'Red'} team)</span>
            </div>
            {team.participants.map((p) => {
                const spells = p.spells.map(ico);
                const rune = ico(p.rune);
                const me = p.puuid === puuid;
                return (
                    <div key={p.puuid}
                         className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${me ? 'bg-white/[0.08] ring-1 ring-inset ring-white/15' : 'hover:bg-white/[0.04]'}`}>
                        <span className={`${COL.role} grid shrink-0 place-items-center`}>
                            <RoleIcon role={p.role} className="h-4 w-4" />
                        </span>
                        <div className={`${COL.champ} flex shrink-0 items-center gap-1.5`}>
                            <div className="relative">
                                <Tile label={p.champ} src={p.champImg} className="h-10 w-10 !rounded-lg" />
                                <span className="absolute -bottom-1 -left-1 rounded bg-ink px-1 text-[10px] font-semibold tabular-nums">{p.level}</span>
                            </div>
                            <div className="grid gap-0.5">
                                <Tile label={spells[0]?.name} src={spells[0]?.img} className="h-[19px] w-[19px] text-[8px] !rounded" />
                                <Tile label={spells[1]?.name} src={spells[1]?.img} className="h-[19px] w-[19px] text-[8px] !rounded" />
                            </div>
                            <Tile label={rune.name} src={rune.img} className="h-6 w-6 !rounded-full text-[8px]" />
                        </div>
                        <div className={`${COL.player} shrink-0 truncate`}>
                            <span className={me ? 'font-semibold text-white' : 'text-white/85'}>{p.name}</span>
                            <span className="text-white/35">#{p.tag}</span>
                        </div>
                        <div className={`${COL.kda} shrink-0 text-center tabular-nums`}>
                            <p className="font-medium">{p.k} <span className="text-white/30">/</span> <span className="text-loss">{p.d}</span> <span className="text-white/30">/</span> {p.a}</p>
                            <p className="text-xs text-white/45">{kdaRatio(p.k, p.d, p.a)} KDA</p>
                        </div>
                        <div className={`${COL.dmg} shrink-0`}>
                            <p className="text-center text-xs tabular-nums text-white/70">{p.dmg.toLocaleString('en-US')}</p>
                            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                                <div className={`h-full rounded-full ${blue ? 'bg-win' : 'bg-loss'}`} style={{ width: `${(p.dmg / maxDmg) * 100}%` }} />
                            </div>
                        </div>
                        <span className={`${COL.gold} shrink-0 text-center tabular-nums text-white/70`}>{(p.gold / 1000).toFixed(1)}k</span>
                        <span className={`${COL.cs} shrink-0 text-center tabular-nums text-white/70`}>{p.cs}</span>
                        <span className={`${COL.vis} shrink-0 text-center tabular-nums text-white/70`}>{p.vision}</span>
                        <div className="flex shrink-0 gap-0.5">
                            {[...p.items, p.trinket].map((it, n) => it
                                ? <Tile key={n} label={it.name} src={it.img} className={`h-7 w-7 text-[9px] !rounded ${n === 6 ? '!rounded-full' : ''}`} />
                                : <div key={n} className={`h-7 w-7 shrink-0 border border-white/[0.06] bg-white/[0.03] ${n === 6 ? 'rounded-full' : 'rounded'}`} />)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function MatchDetail({ matchId, puuid }) {
    const detail = useAsync(() => getMatchDetail(matchId), [matchId]);
    return (
        <div className="overflow-x-auto border-t border-white/[0.07] bg-black/20 px-2 pb-3">
            {detail === null && <div className="skeleton m-3 h-52" />}
            {detail?.error && <p className="p-4 text-sm text-white/55">Couldn&apos;t load match details: {detail.error}</p>}
            {detail?.teams && (
                <>
                    <div className="flex min-w-[870px] items-center gap-2 px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                        <span className={`${COL.role} shrink-0`} />
                        <span className={`${COL.champ} shrink-0`}>Champion</span>
                        <span className={`${COL.player} shrink-0`}>Player</span>
                        <span className={`${COL.kda} shrink-0 text-center`}>KDA</span>
                        <span className={`${COL.dmg} shrink-0 text-center`}>Damage</span>
                        <span className={`${COL.gold} shrink-0 text-center`}>Gold</span>
                        <span className={`${COL.cs} shrink-0 text-center`}>CS</span>
                        <span className={`${COL.vis} shrink-0 text-center`}>Vis.</span>
                        <span>Items</span>
                    </div>
                    {detail.teams.map((t) => <TeamTable key={t.teamId} team={t} maxDmg={detail.maxDmg} puuid={puuid} />)}
                </>
            )}
        </div>
    );
}

// i = position in the list, used to stagger the entrance (capped so long lists don't wait)
export default function MatchCard({ m, i = 0, puuid }) {
    const [open, setOpen] = useState(false);
    const slots = [...Array.from({ length: 6 }, (_, n) => m.items[n] || null), m.trinket];
    const s1 = ico(m.spells[0]);
    const s2 = ico(m.spells[1]);
    const rune = ico(m.rune);
    return (
        <Glass style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
               className={`animate-rise relative overflow-hidden ${m.win ? 'bg-gradient-to-r from-win/[0.1] to-transparent' : 'bg-gradient-to-r from-loss/[0.1] to-transparent'}`}>
            <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${m.win ? 'bg-win' : 'bg-loss'}`} />
            {/* xl: one fixed-height row (never wraps, never changes size). Smaller screens wrap. */}
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
                    className="flex w-full flex-wrap items-center gap-4 p-4 pl-5 text-left outline-none focus-visible:bg-white/[0.04] xl:h-[104px] xl:flex-nowrap">
                <div className="w-28 shrink-0">
                    <p className={`text-xs font-bold uppercase tracking-[0.14em] ${m.win ? 'text-win' : 'text-loss'}`}>{m.win ? 'Victory' : 'Defeat'}</p>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium text-white/85">
                        <RoleIcon role={m.role} />{m.mode}
                    </p>
                    <p className="text-xs text-white/40">{m.ago} · {m.mins}m</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    <Tile label={m.champ} src={m.champImg} className="h-14 w-14 !rounded-xl" />
                    <div className="grid gap-1">
                        <Tile label={s1.name} src={s1.img} className="h-[26px] w-[26px] text-[9px] !rounded-md" />
                        <Tile label={s2.name} src={s2.img} className="h-[26px] w-[26px] text-[9px] !rounded-md" />
                    </div>
                    <Tile label={rune.name} src={rune.img} className="h-8 w-8 !rounded-full text-[9px]" />
                </div>
                <div className="w-24 shrink-0 text-center">
                    <p className="font-display text-lg font-semibold tabular-nums">
                        {m.k} <span className="text-white/30">/</span> <span className="text-loss">{m.d}</span> <span className="text-white/30">/</span> {m.a}
                    </p>
                    <p className="text-xs font-medium text-white/50">{kdaRatio(m.k, m.d, m.a)} KDA</p>
                </div>
                <div className="flex shrink-0 gap-1 rounded-xl bg-black/20 p-1">
                    {slots.map((it, n) => {
                        const x = it && ico(it);
                        return x
                            ? <Tile key={n} label={x.name} src={x.img} className={`h-8 w-8 text-[10px] !rounded-md ${n === 6 ? '!rounded-full' : ''}`} />
                            : <div key={n} className={`h-8 w-8 shrink-0 border border-white/[0.06] bg-white/[0.03] ${n === 6 ? 'rounded-full' : 'rounded-md'}`} />;
                    })}
                </div>
                <div className="ml-auto w-40 shrink-0 text-right text-sm text-white/60 tabular-nums">
                    <p><span className="font-medium text-white/85">{m.cs} CS</span> ({csPerMin(m.cs, m.mins)}/min)</p>
                    <p className="mt-0.5 flex items-center justify-end gap-1 text-xs"><Eye size={13} aria-hidden />{m.vision} vision</p>
                </div>
                <ChevronDown size={18} aria-hidden className={`shrink-0 text-white/40 transition-transform duration-200 ${open ? 'rotate-180 text-accent' : ''}`} />
            </button>
            {open && <MatchDetail matchId={m.id} puuid={puuid} />}
        </Glass>
    );
}