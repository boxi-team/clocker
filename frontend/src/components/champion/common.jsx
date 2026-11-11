import { RefreshCw } from 'lucide-react';
import { Glass, Tile } from '../ui';

export const DD = 'https://ddragon.leagueoflegends.com/cdn';
export const itemImg = (v, id) => `${DD}/${v}/img/item/${id}.png`;
export const champImg = (v, id) => `${DD}/${v}/img/champion/${id}.png`;

// Rates arrive as fractions 0-1 -> show x100
export const pct = (x, d = 1) => (x == null || Number.isNaN(x) ? '–' : `${(x * 100).toFixed(d)}%`);
export const num = (x, d = 0) => (x == null ? '–' : Number(x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));
export const wrColor = (x) => (x >= 0.5 ? 'text-win' : 'text-loss');

export const SectionTitle = ({ id, children, aside }) => (
    <div id={id} className="mb-4 flex scroll-mt-24 flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-bold tracking-tight">{children}</h2>
        {aside}
    </div>
);

export const Label = ({ children }) => (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">{children}</p>
);

export const EmptyState = ({ children = 'No data for these filters yet.', className = '' }) => (
    <div className={`rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/45 ${className}`}>{children}</div>
);

export const LowSample = () => (
    <span title="Fewer games than the low-sample threshold: treat these numbers with care"
          className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
        Low sample
    </span>
);

export function ErrorState({ error, onRetry }) {
    return (
        <Glass className="mx-auto max-w-md p-8 text-center">
            <p className="font-display text-lg font-semibold">{error?.offline ? 'Backend unreachable' : 'Something went wrong'}</p>
            <p className="mt-1 text-sm text-white/55">{error?.message}</p>
            {onRetry && (
                <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm transition hover:bg-white/[0.1]">
                    <RefreshCw size={14} /> Retry
                </button>
            )}
        </Glass>
    );
}

export function Select({ label, value, onChange, options, className = '' }) {
    return (
        <label className={`flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40 ${className}`}>
            {label}
            <select value={value} onChange={(e) => onChange(e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-medium normal-case tracking-normal text-white outline-none transition focus:border-accent/50 [&>option]:bg-ink">
                {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
        </label>
    );
}

// Item icon from DDragon (id -> image); name from the assets map when it loaded.
export const ItemIcon = ({ id, version, assets, className = 'h-9 w-9' }) => {
    const name = assets?.itemMap?.[id]?.name ?? `Item ${id}`;
    return <Tile label={name} src={version ? itemImg(version, id) : assets?.itemMap?.[id]?.img} className={className} />;
};
