import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

// Custom region dropdown (replaces the native <select>, which can't be styled when open).
// Same contract as before: value + onChange(newValue). Keyboard: arrows, Home/End, Enter/Space, Esc.
export default function RegionSelect({ value, onChange, options, label = 'Region' }) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(Math.max(0, options.indexOf(value)));
    const root = useRef(null);
    const btn = useRef(null);
    const list = useRef(null);
    const id = useId();

    useEffect(() => {
        if (!open) return;
        const close = (e) => { if (!root.current.contains(e.target)) setOpen(false); };
        document.addEventListener('pointerdown', close);
        list.current?.focus();
        return () => document.removeEventListener('pointerdown', close);
    }, [open]);

    const openList = () => { setActive(Math.max(0, options.indexOf(value))); setOpen(true); };
    const pick = (v) => { onChange(v); setOpen(false); btn.current.focus(); };

    const onListKey = (e) => {
        const last = options.length - 1;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(last, a + 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
        else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
        else if (e.key === 'End') { e.preventDefault(); setActive(last); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(options[active]); }
        else if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false); if (e.key === 'Escape') btn.current.focus(); }
    };

    return (
        <div ref={root} className="relative">
            <button ref={btn} type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${value}`}
                    onClick={() => (open ? setOpen(false) : openList())}
                    onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openList(); } }}
                    className={`flex min-w-[92px] items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition focus-visible:border-accent/60 ${open ? 'border-accent/40 bg-white/[0.1]' : 'border-white/[0.08] bg-white/[0.06] hover:bg-white/[0.1]'}`}>
                {value}
                <ChevronDown size={14} aria-hidden className={`text-white/50 transition-transform duration-200 ${open ? 'rotate-180 text-accent' : ''}`} />
            </button>

            {open && (
                <ul ref={list} role="listbox" tabIndex={-1} aria-label={label} aria-activedescendant={`${id}-${active}`}
                    onKeyDown={onListKey}
                    className="dropdown-in absolute right-0 top-[calc(100%+8px)] z-50 w-44 origin-top-right overflow-hidden rounded-xl border border-white/[0.1] bg-[#0c0e15]/85 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_24px_60px_-12px_rgba(0,0,0,.85)] outline-none backdrop-blur-(--glass-blur)">
                    {options.map((r, i) => {
                        const selected = r === value;
                        return (
                            <li key={r} id={`${id}-${i}`} role="option" aria-selected={selected}
                                onPointerEnter={() => setActive(i)} onClick={() => pick(r)}
                                className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${i === active ? 'bg-white/[0.08] text-white' : 'text-white/65'} ${selected ? 'font-semibold text-accent' : 'font-medium'}`}>
                                {r}
                                {selected && <Check size={14} aria-hidden className="text-accent" />}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
