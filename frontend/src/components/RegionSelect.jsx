import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export default function RegionSelect({ value, onChange, options, label = 'Region' }) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(Math.max(0, options.indexOf(value)));
    const root = useRef(null);
    const btn = useRef(null);
    const list = useRef(null);
    const id = useId();
    const peekTimeout = useRef(null); // Ref pentru a ține minte timer-ul de închidere automată

    useEffect(() => {
        if (!open) return;
        const close = (e) => {
            if (!root.current.contains(e.target)) {
                setOpen(false);
                if (peekTimeout.current) clearTimeout(peekTimeout.current);
            }
        };
        document.addEventListener('pointerdown', close);
        list.current?.focus();
        return () => document.removeEventListener('pointerdown', close);
    }, [open]);

    // Listener nativ pentru scroll
    useEffect(() => {
        const el = root.current;
        if (!el) return;

        const handleWheel = (e) => {
            e.preventDefault(); // Blocăm scroll-ul ecranului

            setOpen(true); // Deschidem imediat lista ca să vedem animația

            const curr = options.indexOf(value);
            let next = curr;
            if (e.deltaY > 0 && curr < options.length - 1) {
                next = curr + 1;
            } else if (e.deltaY < 0 && curr > 0) {
                next = curr - 1;
            }

            if (next !== curr) {
                onChange(options[next]);
                setActive(next);

                // Așteptăm 10ms ca lista să se randeze (în caz că era închisă), apoi dăm scroll lin către element
                setTimeout(() => {
                    const listItem = document.getElementById(`${id}-${next}`);
                    listItem?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }, 10);
            }

            // Resetăm timerul: dacă trec 1000ms (1 secundă) fără să mai dai scroll, lista se ascunde la loc
            if (peekTimeout.current) clearTimeout(peekTimeout.current);
            peekTimeout.current = setTimeout(() => {
                setOpen(false);
            }, 1000);
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [value, options, onChange, id]);

    const openList = () => {
        setActive(Math.max(0, options.indexOf(value)));
        setOpen(true);
        if (peekTimeout.current) clearTimeout(peekTimeout.current); // Oprim auto-închiderea la click manual
    };

    const pick = (v) => {
        onChange(v);
        setOpen(false);
        btn.current.focus();
        if (peekTimeout.current) clearTimeout(peekTimeout.current);
    };

    const onListKey = (e) => {
        const last = options.length - 1;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(last, a + 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
        else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
        else if (e.key === 'End') { e.preventDefault(); setActive(last); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(options[active]); }
        else if (e.key === 'Escape' || e.key === 'Tab') {
            setOpen(false);
            if (e.key === 'Escape') btn.current.focus();
            if (peekTimeout.current) clearTimeout(peekTimeout.current);
        }
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
                    className="dropdown-in absolute right-0 top-1/2 z-50 w-full -translate-y-1/2 origin-center max-h-60 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] rounded-xl border border-white/[0.1] bg-[#0c0e15]/95 p-1.5 shadow-[0_0_40px_rgba(0,0,0,0.8)] outline-none backdrop-blur-(--glass-blur)">
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