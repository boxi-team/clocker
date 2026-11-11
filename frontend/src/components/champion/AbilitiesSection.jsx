import { useState } from 'react';
import { Glass, Tile } from '../ui';

export default function AbilitiesSection({ abilities, lore }) {
    const items = [{ key: 'P', ...abilities.passive }, ...abilities.spells.map((s, i) => ({ ...s, key: s.key ?? 'QWER'[i] }))];
    const [i, setI] = useState(0);
    const a = items[i];
    return (
        <Glass className="p-5">
            <div className="flex gap-2" role="tablist">
                {items.map((x, k) => (
                    <button key={x.key} role="tab" aria-selected={k === i} onClick={() => setI(k)} title={x.name}
                            className={`relative rounded-xl p-0.5 outline-none transition focus-visible:ring-2 focus-visible:ring-accent/60 ${k === i ? 'bg-gradient-to-br from-accent to-violet' : 'opacity-60 hover:opacity-100'}`}>
                        <Tile label={x.name} src={x.iconUrl} className="h-14 w-14 !rounded-[10px]" />
                        <span className="absolute -bottom-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-md bg-ink text-[10px] font-bold ring-1 ring-white/20">{x.key}</span>
                    </button>
                ))}
            </div>
            <div className="mt-5">
                <div className="flex flex-wrap items-baseline gap-x-4">
                    <h3 className="font-display text-xl font-semibold">{a.name}</h3>
                    {a.cooldown && <span className="text-sm text-white/45 tabular-nums">Cooldown: {a.cooldown.replaceAll('/', ' / ')}s</span>}
                </div>
                <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-white/70">{a.description}</p>
            </div>
            {lore && <p className="mt-6 max-w-3xl border-t border-white/[0.07] pt-4 text-sm italic leading-relaxed text-white/45">{lore}</p>}
        </Glass>
    );
}
