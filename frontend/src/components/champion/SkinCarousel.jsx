import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { EmptyState } from './common';

// ---- Tweak here ----
const ANGLE = 38;      // deg: how much the side cards are turned
const SPREAD = 82;     // % of a card's width: distance between center and side cards
const SIDE_SCALE = 0.78;
const SIDE_OPACITY = 0.45;
const MS = 600;        // slide animation

// Circular offset of card k relative to the selected one: ..., -1, 0, 1, ...
const offset = (k, i, n) => {
    let d = k - i;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
};

export default function SkinCarousel({ skins, champName }) {
    const n = skins?.length ?? 0;
    const [i, setI] = useState(0);
    const [open, setOpen] = useState(false);
    const start = useRef(null);
    const swiped = useRef(false);
    const go = useCallback((d) => setI((k) => (k + d + n) % n), [n]);

    useEffect(() => { setI(0); }, [skins]);
    useEffect(() => {
        if (!open) return;
        const key = (e) => { if (e.key === 'Escape') setOpen(false); if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', key);
        return () => { window.removeEventListener('keydown', key); document.body.style.overflow = prev; };
    }, [open, go]);

    if (!n) return <EmptyState>No skins available.</EmptyState>;
    const cur = skins[i];
    const label = cur.num === 0 ? `Default ${champName}` : cur.name;

    // Swipe on the stage only. The arrows are outside it, so they can never trigger a swipe/zoom.
    const onDown = (e) => { start.current = e.clientX; swiped.current = false; };
    const onUp = (e) => {
        if (start.current == null) return;
        const dx = e.clientX - start.current;
        start.current = null;
        if (Math.abs(dx) > 50) { swiped.current = true; go(dx < 0 ? 1 : -1); }
    };
    const pick = (k, d) => {
        if (swiped.current) return;
        if (d === 0) setOpen(true);       // center card = zoom
        else if (Math.abs(d) === 1) go(d); // side card = bring to center
    };

    const Arrow = ({ d, className = '', modal = false }) => (
        <button onClick={() => go(d)} onPointerDown={(e) => e.stopPropagation()} aria-label={d < 0 ? 'Previous skin' : 'Next skin'}
                className={`${modal ? 'absolute' : 'absolute z-20'} top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-ink/60 text-white backdrop-blur transition hover:bg-ink/80 focus-visible:ring-2 focus-visible:ring-accent/60 ${className}`}>
            {d < 0 ? <ChevronLeft /> : <ChevronRight />}
        </button>
    );

    return (
        <div>
            {/* Fixed, small height so the whole section fits on one screen */}
            <div className="relative" onKeyDown={(e) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); }}>
                <div className="relative h-[clamp(200px,40vh,360px)] select-none overflow-hidden"
                     style={{ perspective: '1100px', touchAction: 'pan-y' }}
                     onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { start.current = null; }}>
                    {skins.map((s, k) => {
                        const d = offset(k, i, n);
                        const a = Math.abs(d);
                        const c = Math.max(-2, Math.min(2, d)); // far cards wait just outside, invisible
                        const hidden = a > 1;
                        return (
                            <button key={s.num} tabIndex={a > 1 ? -1 : 0} onClick={() => pick(k, d)} aria-label={s.name} aria-current={d === 0}
                                    className={`absolute left-1/2 top-1/2 aspect-[1215/717] h-[88%] overflow-hidden rounded-xl border border-white/15 bg-black/40 shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${d === 0 ? 'cursor-zoom-in' : 'cursor-pointer'}`}
                                    style={{
                                        // d<0 (left card): rotateY negative -> its right edge (near the center) comes closer to the eye. d>0 mirrored.
                                        transform: `translate(-50%, -50%) translateX(${c * SPREAD}%) rotateY(${c * ANGLE}deg) scale(${d === 0 ? 1 : SIDE_SCALE})`,
                                        opacity: d === 0 ? 1 : hidden ? 0 : SIDE_OPACITY,
                                        zIndex: 10 - a,
                                        pointerEvents: hidden ? 'none' : 'auto',
                                        transition: `transform ${MS}ms cubic-bezier(.2,.7,.2,1), opacity ${MS}ms ease`,
                                        willChange: 'transform, opacity',
                                    }}>
                                <img src={s.splashUrl} alt="" draggable={false} loading={a > 1 ? 'lazy' : 'eager'} className="h-full w-full object-cover" />
                            </button>
                        );
                    })}
                </div>
                {n > 1 && <><Arrow d={-1} className="left-1" /><Arrow d={1} className="right-1" /></>}
            </div>

            <p className="mt-3 text-center font-display text-lg font-semibold">
                {label} <span className="ml-2 text-sm font-normal tabular-nums text-white/45">{i + 1} / {n}</span>
            </p>

            {open && (
                <div role="dialog" aria-modal="true" aria-label={label} onClick={() => setOpen(false)}
                     className="fixed inset-0 z-[60] grid place-items-center bg-black/90 p-4 backdrop-blur-sm">
                    <img src={cur.splashUrl} alt={label} onClick={(e) => e.stopPropagation()} className="max-h-[88vh] max-w-full rounded-xl object-contain shadow-2xl" />
                    <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-sm">{label} · {i + 1} / {n}</p>
                    <button onClick={() => setOpen(false)} aria-label="Close preview" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"><X size={20} /></button>
                    {n > 1 && (
                        <>
                            <span onClick={(e) => e.stopPropagation()}><Arrow d={-1} modal className="left-4" /></span>
                            <span onClick={(e) => e.stopPropagation()}><Arrow d={1} modal className="right-4" /></span>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}