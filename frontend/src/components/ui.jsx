import { useState } from 'react';
import { Swords, Trees, Wand2, Crosshair, HeartHandshake, Shield } from 'lucide-react';

export const ROLE_ICONS = { Top: Swords, Jungle: Trees, Mid: Wand2, ADC: Crosshair, Support: HeartHandshake };

export const TIER_COLOR = {
    Iron: '#8b7d78', Bronze: '#b4713f', Silver: '#a9b4c0', Gold: '#e6b84c', Platinum: '#3fb8af',
    Emerald: '#2fbf71', Diamond: '#6aa9ff', Master: '#c26bff', Grandmaster: '#ff5d6c', Challenger: '#4fd8ff',
};

export const Glass = ({ className = '', children, ...p }) => (
    <div {...p} className={`rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_12px_40px_-12px_rgba(0,0,0,.6)] backdrop-blur-(--glass-blur) transition-colors duration-300 hover:border-white/[0.16] ${className}`}>
        {children}
    </div>
);

// Imagine reală dacă există `src`; altfel (sau dacă nu se încarcă) placeholder cu inițiale.
export function Tile({ label = '?', src, className = 'w-11 h-11' }) {
    const [broken, setBroken] = useState(false);
    if (src && !broken) {
        return <img src={src} alt={label} title={label} loading="lazy" onError={() => setBroken(true)}
                    className={`${className} shrink-0 rounded-lg border border-white/15 object-cover`} />;
    }
    const hue = [...label].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    return (
        <div title={label} className={`${className} shrink-0 grid place-items-center rounded-lg text-xs font-semibold text-white/90 ring-1 ring-inset ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,.15)]`}
             style={{ background: `linear-gradient(140deg,hsl(${hue} 55% 38%),hsl(${(hue + 40) % 360} 60% 16%))` }}>
            {label.slice(0, 2)}
        </div>
    );
}

export function RankBadge({ tier, div }) {
    const c = TIER_COLOR[tier] || '#fff';
    return (
        <div className="flex flex-col items-center">
            <div className="relative grid h-28 w-28 place-items-center rounded-full"
                 style={{ boxShadow: `0 0 70px -10px ${c}80`, background: `radial-gradient(circle,${c}2e,transparent 68%)` }}>
                <Shield size={78} color={c} strokeWidth={1.25} />
                <span className="absolute font-display text-xl font-bold" style={{ color: c }}>{div}</span>
            </div>
            <p className="mt-1 font-display text-base font-semibold uppercase tracking-[0.18em]" style={{ color: c }}>{tier}</p>
        </div>
    );
}

// The blue arc draws itself on load (CSS animation "donut"). Also safe for 0 games (no NaN).
export function WinDonut({ wins, losses, size = 64 }) {
    const r = 26, c = 2 * Math.PI * r;
    const total = wins + losses;
    const p = total ? wins / total : 0;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox="0 0 64 64" className="-rotate-90">
                <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,93,115,.45)" strokeWidth="6" />
                <circle cx="32" cy="32" r={r} fill="none" stroke="#5aa9ff" strokeWidth="6"
                        className="animate-donut" style={{ '--c': c }}
                        strokeDasharray={`${c * p} ${c}`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums">{Math.round(p * 100)}%</span>
        </div>
    );
}