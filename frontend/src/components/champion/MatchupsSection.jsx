import { useState } from 'react';
import { Glass, Tile } from '../ui';
import { EmptyState, Label, champImg, pct, num, wrColor } from './common';

function Row({ m, version, active, onPick }) {
    return (
        <button onClick={() => onPick(active ? null : m.opponentId)} aria-pressed={active}
                className={`-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/[0.05] ${active ? 'bg-accent/10 ring-1 ring-accent/40' : ''}`}>
            <Tile label={m.opponentId} src={champImg(version, m.opponentId)} className="h-9 w-9" />
            <span className="flex-1 font-medium">{m.opponentId}<span className="block text-xs font-normal text-white/40">{num(m.games)} games</span></span>
            <span className={`font-semibold tabular-nums ${wrColor(m.winRate)}`}>{pct(m.winRate)}</span>
        </button>
    );
}

export default function MatchupsSection({ data, version, vs, onPick, name }) {
    const [all, setAll] = useState(false);
    const rows = data?.matchups ?? [];
    if (!rows.length) return <EmptyState className="py-8">No lane matchup reaches the minimum number of games for these filters.</EmptyState>;
    const asc = [...rows].sort((a, b) => a.winRate - b.winRate);
    const counters = asc.slice(0, 6);
    const strong = [...asc].reverse().slice(0, 6);
    const lists = [
        [`Counters: lowest win rate for ${name}`, counters],
        [`${name} is strong against`, strong],
    ];
    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
                {lists.map(([title, list]) => (
                    <Glass key={title} className="p-5">
                        <Label>{title}</Label>
                        <div className="space-y-0.5">{list.map((m) => <Row key={m.opponentKey} m={m} version={version} active={vs?.toLowerCase() === m.opponentId.toLowerCase()} onPick={onPick} />)}</div>
                    </Glass>
                ))}
            </div>
            {rows.length > 6 && (
                <Glass className="p-5">
                    <div className="flex items-center justify-between">
                        <Label>All matchups ({rows.length}, most played first)</Label>
                        <button onClick={() => setAll((v) => !v)} className="mb-3 text-xs text-accent hover:underline">{all ? 'Hide' : 'Show'}</button>
                    </div>
                    {all && <div className="grid gap-x-8 gap-y-0.5 md:grid-cols-2">{rows.map((m) => <Row key={m.opponentKey} m={m} version={version} active={vs?.toLowerCase() === m.opponentId.toLowerCase()} onPick={onPick} />)}</div>}
                </Glass>
            )}
            <p className="text-xs text-white/35">Click an opponent to see the build against them.</p>
        </div>
    );
}
