import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Glass, Tile } from '../ui';
import { EmptyState, ItemIcon, Label, LowSample, pct, num, wrColor } from './common';
import { SHARD_NAME } from '../../lib/constants';

// Completed / upgraded boots in League of Legends
const UPGRADED_BOOTS = new Set([
    3006, // Berserker's Greaves
    3009, // Boots of Swiftness
    3020, // Sorcerer's Shoes
    3047, // Plated Steelcaps
    3111, // Mercury's Treads
    3117, // Mobility Boots
    3158, // Ionian Boots of Lucidity
    3174, // Symbiotic Soles
    3175, // Synchronized Souls
]);

const BASIC_BOOTS = new Set([
    1001, // Boots of Speed
    2422, // Slightly Magical Footwear
]);

/**
 * Resolves boots display so that:
 * 1. The last bought / upgraded boots are always prioritized over un-upgraded boots (e.g. Magical Footwear 2422).
 * 2. On champions (like ADCs) where boots were sold in late game, if upgraded boots exist anywhere in
 *    timeline purchases/popular items/item slots, they are displayed instead of "no boots".
 */
function resolveBoots(bootsGroup, itemsList, itemSlots) {
    const candidates = [];
    if (bootsGroup?.recommended) candidates.push(bootsGroup.recommended);
    if (bootsGroup?.alternatives?.length) candidates.push(...bootsGroup.alternatives);

    const seenIds = new Set(candidates.map((b) => b.itemId));

    // Check popular items for completed boots
    if (itemsList?.length) {
        for (const it of itemsList) {
            if (UPGRADED_BOOTS.has(it.itemId) && !seenIds.has(it.itemId)) {
                candidates.push({
                    itemId: it.itemId,
                    games: it.games,
                    winRate: it.winRate,
                    pickRate: it.pickRate ?? (it.games && bootsGroup?.sample ? it.games / bootsGroup.sample : 0),
                });
                seenIds.add(it.itemId);
            }
        }
    }

    // Check item order slots for completed boots
    if (itemSlots?.length) {
        for (const slot of itemSlots) {
            const opts = slot.recommended ? [slot.recommended, ...(slot.alternatives ?? [])] : [];
            for (const opt of opts) {
                for (const id of (opt.itemIds ?? [])) {
                    if (UPGRADED_BOOTS.has(id) && !seenIds.has(id)) {
                        candidates.push({
                            itemId: id,
                            games: opt.games,
                            winRate: opt.winRate,
                            pickRate: opt.pickRate,
                        });
                        seenIds.add(id);
                    }
                }
            }
        }
    }

    if (!candidates.length) return bootsGroup;

    // Filter upgraded vs basic
    const upgraded = candidates.filter((b) => UPGRADED_BOOTS.has(b.itemId));
    const basic = candidates.filter((b) => BASIC_BOOTS.has(b.itemId));
    const other = candidates.filter((b) => !UPGRADED_BOOTS.has(b.itemId) && !BASIC_BOOTS.has(b.itemId));

    upgraded.sort((a, b) => (b.games ?? 0) - (a.games ?? 0));

    if (upgraded.length > 0) {
        const recommended = upgraded[0];
        const alternatives = [
            ...upgraded.slice(1),
            ...other,
            ...(upgraded.length === 1 ? basic : []),
        ].slice(0, 3);
        return { recommended, alternatives };
    }

    // Fallback: candidates sorted by games
    candidates.sort((a, b) => (b.games ?? 0) - (a.games ?? 0));
    return {
        recommended: candidates[0],
        alternatives: candidates.slice(1, 3),
    };
}

const RateLine = ({ o }) => (
    <p className="mt-3 text-xs tabular-nums text-white/45">
        <span className={`font-semibold ${wrColor(o.winRate)}`}>{pct(o.winRate)} WR</span> · {pct(o.pickRate)} pick · {num(o.games)} games
    </p>
);

// recommended + up to 2 alternatives, one at a time
function OptionPicker({ group, render }) {
    const [i, setI] = useState(0);
    useEffect(() => setI(0), [group]);
    if (!group?.recommended) return <EmptyState>No data.</EmptyState>;
    const opts = [group.recommended, ...(group.alternatives ?? [])].slice(0, 3);
    const o = opts[Math.min(i, opts.length - 1)];
    return (
        <div>
            {opts.length > 1 && (
                <div className="mb-3 flex gap-1.5">
                    {opts.map((_, k) => (
                        <button key={k} onClick={() => setI(k)} aria-pressed={k === i}
                                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${k === i ? 'border-accent/50 bg-accent/15 text-accent' : 'border-white/10 text-white/50 hover:text-white'}`}>
                            {k === 0 ? 'Recommended' : `Alt ${k}`}
                        </button>
                    ))}
                </div>
            )}
            {render(o)}
            <RateLine o={o} />
        </div>
    );
}

const Items = ({ ids, version, assets, className }) => (
    <div className="flex flex-wrap items-center gap-1.5">
        {ids.map((id, i) => <ItemIcon key={`${id}-${i}`} id={id} version={version} assets={assets} className={className} />)}
    </div>
);

function Runes({ o, assets }) {
    const r = assets.runeMap;
    const t = (id, cls) => <Tile key={id} label={r[id]?.name ?? String(id)} src={r[id]?.img} className={cls} />;
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-4">
                {t(o.keystone, 'h-14 w-14 !rounded-full')}
                <div className="flex gap-1.5">{o.primaryPerks.slice(1).map((id) => t(id, 'h-9 w-9 !rounded-full'))}</div>
            </div>
            <div className="flex items-center gap-3 border-t border-white/[0.06] pt-3">
                {t(o.subStyle, 'h-7 w-7 !rounded-full')}
                <div className="flex gap-1.5">{o.secondaryPerks.map((id) => t(id, 'h-9 w-9 !rounded-full'))}</div>
            </div>
            <div className="flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-3">
                {o.statShards.map((id, i) => <span key={i} className="rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-white/70">{SHARD_NAME[id] ?? id}</span>)}
            </div>
        </div>
    );
}

const SLOT_LABEL = { starting: 'Starting', core: 'Core (first 3)', fourth: '4th item', fifth: '5th item', sixth: '6th item' };

function ItemSlots({ slots, version, assets }) {
    if (!slots.length) return <EmptyState>No item data.</EmptyState>;
    return (
        <div className="divide-y divide-white/[0.06]">
            {slots.map((s) => {
                const opts = s.recommended ? [s.recommended, ...s.alternatives] : [];
                return (
                    <div key={s.slot} className="py-3 first:pt-0 last:pb-0">
                        <div className="mb-2 flex items-baseline justify-between">
                            <span className="text-sm font-semibold">{SLOT_LABEL[s.slot] ?? s.slot}</span>
                            <span className="text-[11px] text-white/35" title="Games with timeline data that reached this slot">sample {num(s.sampleSize)}</span>
                        </div>
                        {opts.length === 0 ? <p className="text-xs text-white/40">No timeline data for this slot.</p> : (
                            <div className="flex flex-wrap gap-x-6 gap-y-3">
                                {opts.map((o, k) => (
                                    <div key={k} className={k ? 'opacity-75' : ''}>
                                        <Items ids={o.itemIds} version={version} assets={assets} className={k ? 'h-8 w-8' : 'h-10 w-10'} />
                                        <p className="mt-1 text-[11px] tabular-nums text-white/45"><span className={wrColor(o.winRate)}>{pct(o.winRate)}</span> · {pct(o.pickRate, 0)} pick · {num(o.games)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function SkillOrder({ so }) {
    if (!so?.orders?.length) return <EmptyState>No timeline data for skill order.</EmptyState>;
    const L = ['Q', 'W', 'E', 'R'];
    return (
        <div className="space-y-5">
            {so.orders.slice(0, 3).map((o) => (
                <div key={o.maxOrder}>
                    <div className="mb-2 flex items-baseline justify-between text-sm">
                        <span className="font-semibold">{o.maxOrder}</span>
                        <span className="text-xs tabular-nums text-white/45"><span className={wrColor(o.winRate)}>{pct(o.winRate)}</span> · {num(o.games)} games</span>
                    </div>
                    <div className="overflow-x-auto">
                        <div className="grid min-w-[420px] gap-1" style={{ gridTemplateColumns: `1.5rem repeat(${o.sequence.length}, minmax(0, 1fr))` }}>
                            {L.map((k) => (
                                <div key={k} className="contents">
                                    <span className="grid h-6 place-items-center text-xs font-semibold text-white/50">{k}</span>
                                    {[...o.sequence].map((c, i) => (
                                        <span key={i} className={`grid h-6 place-items-center rounded text-[10px] font-semibold ${c === k ? (k === 'R' ? 'bg-violet/80' : 'bg-accent/80 text-ink') : 'bg-white/[0.05] text-transparent'}`}>{c === k ? i + 1 : '.'}</span>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
            <p className="text-[11px] text-white/35">Sample {num(so.sampleSize)} games · first {o0(so)} skill-ups</p>
        </div>
    );
}
const o0 = (so) => so.orders[0]?.sequence.length ?? 15;

const Card = ({ title, children, className = '' }) => (
    <Glass className={`p-5 ${className}`}><Label>{title}</Label>{children}</Glass>
);

export default function BuildSection({ build, version, assets, vs, onClearVs, loading }) {
    const resolvedBoots = useMemo(
        () => resolveBoots(build?.boots, build?.items, build?.itemSlots),
        [build?.boots, build?.items, build?.itemSlots]
    );

    if (!build || build.role == null || build.games === 0) {
        return (
            <>
                {vs && <VsBanner vs={vs} onClear={onClearVs} />}
                <EmptyState className="py-10">{vs ? `No games found against ${vs} for these filters.` : 'No ranked games for this champion with these filters yet, so there is no build to show.'}</EmptyState>
            </>
        );
    }
    return (
        <div className={`space-y-4 transition ${loading ? 'opacity-60' : ''}`}>
            {vs && <VsBanner vs={vs} onClear={onClearVs} />}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/60">
                <span className="font-semibold capitalize text-white">{build.role}</span>
                <span className="tabular-nums"><span className={`font-semibold ${wrColor(build.winRate)}`}>{pct(build.winRate)}</span> win rate</span>
                <span className="tabular-nums">{num(build.games)} games</span>
                {build.games < 100 && <LowSample />}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
                <Card title="Runes"><OptionPicker group={build.runes} render={(o) => <Runes o={o} assets={assets} />} /></Card>
                <Card title="Summoner spells">
                    <OptionPicker group={build.summonerSpells} render={(o) => (
                        <div className="flex gap-2">{o.spellIds.map((id) => <Tile key={id} label={assets.spellMap[id]?.name ?? String(id)} src={assets.spellMap[id]?.img} className="h-12 w-12" />)}</div>
                    )} />
                    <div className="mt-5 border-t border-white/[0.06] pt-4">
                        <Label>Boots</Label>
                        <OptionPicker group={resolvedBoots} render={(o) => <ItemIcon id={o.itemId} version={version} assets={assets} className="h-11 w-11" />} />
                    </div>
                </Card>
                <Card title="Final core set">
                    <OptionPicker group={build.coreSets} render={(o) => <Items ids={o.itemIds} version={version} assets={assets} className="h-11 w-11" />} />
                    {build.items.length > 0 && (
                        <div className="mt-5 border-t border-white/[0.06] pt-4">
                            <Label>Popular items</Label>
                            <div className="flex flex-wrap gap-1.5">
                                {build.items.map((it) => (
                                    <div key={it.itemId} className="text-center" title={`${pct(it.winRate)} WR · ${num(it.games)} games`}>
                                        <ItemIcon id={it.itemId} version={version} assets={assets} className="h-8 w-8" />
                                        <span className={`text-[10px] tabular-nums ${wrColor(it.winRate)}`}>{pct(it.winRate, 0)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Item order (purchase order)"><ItemSlots slots={build.itemSlots} version={version} assets={assets} /></Card>
                <div className="space-y-4">
                    <Card title="Skill order"><SkillOrder so={build.skillOrder} /></Card>
                    <Card title="Starting items">
                        {build.startingItems?.sets?.length ? (
                            <div className="space-y-3">
                                {build.startingItems.sets.slice(0, 3).map((s, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3">
                                        <Items ids={s.itemIds} version={version} assets={assets} className="h-9 w-9" />
                                        <span className="text-xs tabular-nums text-white/45"><span className={wrColor(s.winRate)}>{pct(s.winRate)}</span> · {num(s.games)}</span>
                                    </div>
                                ))}
                                <p className="text-[11px] text-white/35">Sample {num(build.startingItems.sampleSize)} games</p>
                            </div>
                        ) : <EmptyState>No timeline data.</EmptyState>}
                    </Card>
                </div>
            </div>
        </div>
    );
}

function VsBanner({ vs, onClear }) {
    return (
        <div className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm">
            <span>Build when the lane opponent is <strong>{vs}</strong></span>
            <button onClick={onClear} className="inline-flex items-center gap-1 text-white/70 transition hover:text-white"><X size={14} /> Clear</button>
        </div>
    );
}
