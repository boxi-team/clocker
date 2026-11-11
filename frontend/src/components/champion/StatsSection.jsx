import { useState } from 'react';
import { Glass } from '../ui';
import { EmptyState, Label, LowSample, pct, num, wrColor } from './common';

// Riot's per-level growth: base + perLevel * (n-1) * (0.7025 + 0.0175 * (n-1))
const growth = (lvl) => (lvl - 1) * (0.7025 + 0.0175 * (lvl - 1));
const at = (b, p, lvl) => b + (p ?? 0) * growth(lvl);

function Base({ s }) {
    const [lvl, setLvl] = useState(1);
    const rows = [
        ['Health', at(s.hp, s.hpperlevel, lvl), 0], ['Health regen', at(s.hpregen, s.hpregenperlevel, lvl), 1],
        ['Mana', at(s.mp, s.mpperlevel, lvl), 0], ['Mana regen', at(s.mpregen, s.mpregenperlevel, lvl), 1],
        ['Attack damage', at(s.attackdamage, s.attackdamageperlevel, lvl), 0],
        ['Attack speed', s.attackspeed * (1 + ((s.attackspeedperlevel ?? 0) / 100) * growth(lvl)), 3],
        ['Armor', at(s.armor, s.armorperlevel, lvl), 1], ['Magic resist', at(s.spellblock, s.spellblockperlevel, lvl), 1],
        ['Move speed', s.movespeed, 0], ['Attack range', s.attackrange, 0],
    ];
    return (
        <Glass className="p-5">
            <div className="mb-4 flex items-center justify-between">
                <Label>Base stats</Label>
                <span className="mb-3 font-display text-lg font-bold tabular-nums">Level {lvl}</span>
            </div>
            <input type="range" min={1} max={18} value={lvl} onChange={(e) => setLvl(+e.target.value)} aria-label="Champion level"
                   className="mb-5 w-full accent-[var(--color-accent)]" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                {rows.map(([k, v, d]) => (
                    <div key={k} className="flex justify-between border-b border-white/[0.05] pb-1.5 text-sm">
                        <dt className="text-white/50">{k}</dt><dd className="font-semibold tabular-nums">{num(v, d)}</dd>
                    </div>
                ))}
            </dl>
        </Glass>
    );
}

function Performance({ st }) {
    if (!st || st.games === 0) return <Glass className="p-5"><Label>Performance</Label><EmptyState>No ranked games for these filters yet.</EmptyState></Glass>;
    const rows = [
        ['Win rate', pct(st.winRate), wrColor(st.winRate)], ['Pick rate', pct(st.pickRate)], ['Ban rate', pct(st.banRate)],
        ['Games', num(st.games)], ['KDA', num(st.kda, 2)],
        ['K / D / A', `${num(st.avgKills, 1)} / ${num(st.avgDeaths, 1)} / ${num(st.avgAssists, 1)}`],
        ['CS / min', num(st.csPerMin, 1)], ['Gold', num(st.avgGold)], ['Damage to champions', num(st.avgDamageToChampions)], ['Vision score', num(st.avgVisionScore, 1)],
    ];
    return (
        <Glass className="p-5">
            <div className="mb-4 flex items-center justify-between"><Label>Performance</Label>{st.lowSample && <span className="mb-3"><LowSample /></span>}</div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                {rows.map(([k, v, c]) => (
                    <div key={k} className="flex justify-between border-b border-white/[0.05] pb-1.5 text-sm">
                        <dt className="text-white/50">{k}</dt><dd className={`font-semibold tabular-nums ${c ?? ''}`}>{v}</dd>
                    </div>
                ))}
            </dl>
        </Glass>
    );
}

export default function StatsSection({ stats, base }) {
    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <Performance st={stats} />
            {base ? <Base s={base} /> : <Glass className="p-5"><Label>Base stats</Label><EmptyState>Base stats unavailable.</EmptyState></Glass>}
        </div>
    );
}
