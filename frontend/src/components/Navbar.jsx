import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { Home, Radio, ListOrdered, Trophy, User, Search } from 'lucide-react';
import logo from '../assets/logo.png';
import { useAuth } from '../hooks/useAuth';

// Profile este ULTIMUL element din navbar, exact cum a cerut userul
const TABS = [
  ['home', 'Home', Home],
  ['live', 'Live Game', Radio],
  ['tiers', 'Tier Lists', ListOrdered],
  ['leaders', 'Leaderboards', Trophy],
  ['profile', 'Profile', User],
];

// ---- Tab indicator animation: square -> circle -> slides to the next tab -> unfolds ----
const DUR = 600;     // total ms
const RADIUS = 8;    // px, same as rounded-lg
const isTab = (id) => TABS.some(([t]) => t === id);
const frame = (r, o = {}) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.w}px`, height: `${r.h}px`, borderRadius: `${r.rad ?? RADIUS}px`, opacity: 1, ...o });
const dot = (r, o = {}) => frame({ left: r.left + r.w / 2 - r.h / 2, top: r.top, w: r.h, h: r.h, rad: r.h / 2 }, o);

export default function Navbar({ page, onNavigate, onSearch }) {
  const [q, setQ] = useState('');
  const navRef = useRef(null);
  const tabRefs = useRef({});
  const indRef = useRef(null);
  const shown = useRef(null);      // rect the indicator rests on (null = hidden)
  const anim = useRef(null);
  const lastPage = useRef(undefined);
  const [lit, setLit] = useState(isTab(page) ? page : null); // which tab looks selected (text/icon)

  const { user, activeSummoner } = useAuth();

  const rectOf = (id) => {
    const el = tabRefs.current[id];
    return el ? { left: el.offsetLeft, top: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null;
  };
  const rest = (r) => {
    const s = indRef.current?.style;
    if (!s) return;
    shown.current = r;
    if (!r) { s.opacity = '0'; return; }
    Object.assign(s, { opacity: '1', left: `${r.left}px`, top: `${r.top}px`, width: `${r.w}px`, height: `${r.h}px`, borderRadius: `${RADIUS}px` });
  };

  useLayoutEffect(() => {
    const el = indRef.current;
    if (!el) return;
    const to = isTab(page) ? rectOf(page) : null;
    if (lastPage.current === undefined) { lastPage.current = page; rest(to); return; } // first paint: no animation
    if (lastPage.current === page) return;
    lastPage.current = page;

    // Start from where the indicator is right now (it may be mid-animation)
    let from = shown.current;
    if (anim.current) {
      const c = getComputedStyle(el);
      from = Number(c.opacity) > 0 ? { left: parseFloat(c.left), top: parseFloat(c.top), w: parseFloat(c.width), h: parseFloat(c.height), rad: parseFloat(c.borderTopLeftRadius) } : null;
      anim.current.cancel();
      anim.current = null;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || (!from && !to)) {
      rest(to); setLit(to ? page : null); return;
    }

    let kf;
    if (from && to) {
      kf = [
        { ...frame(from), offset: 0, easing: 'cubic-bezier(.5,0,.3,1)' },                  // 1. the square collapses...
        { ...dot(from), offset: 0.24, easing: 'cubic-bezier(.65,0,.35,1)' },                // ...into a circle
        { ...dot(to), offset: 0.68, easing: 'cubic-bezier(.2,.9,.25,1.15)' },               // 2. the circle travels to the new tab
        { ...frame(to), offset: 1 },                                                        // 3. and unfolds
      ];
    } else if (to) {
      kf = [{ ...dot(to, { opacity: 0 }), offset: 0 }, { ...dot(to), offset: 0.3, easing: 'cubic-bezier(.2,.9,.25,1.15)' }, { ...frame(to), offset: 1 }];
    } else {
      kf = [{ ...frame(from), offset: 0, easing: 'cubic-bezier(.5,0,.3,1)' }, { ...dot(from), offset: 0.5 }, { ...dot(from, { opacity: 0 }), offset: 1 }];
    }

    const a = el.animate(kf, { duration: DUR, fill: 'forwards' });
    anim.current = a;
    a.onfinish = () => { rest(to); a.cancel(); if (anim.current === a) anim.current = null; };

    setLit(null); // the old tab is deselected right away...
    const t = setTimeout(() => setLit(to ? page : null), DUR * 0.62); // ...the new one lights up when the circle arrives
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Keep the indicator glued to its tab when the layout changes (resize, fonts loading)
  useEffect(() => {
    const fit = () => { if (!anim.current && indRef.current) rest(isTab(page) ? rectOf(page) : null); };
    const ro = new ResizeObserver(fit);
    if (navRef.current) ro.observe(navRef.current);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const submit = (e) => { e.preventDefault(); if (q.trim()) { onSearch(q.trim(), 'EUW'); setQ(''); } };

  return (
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_8px_32px_-12px_rgba(0,0,0,.5)] backdrop-blur-(--nav-blur) backdrop-saturate-150">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          {/* Logo */}
          <button
              onClick={() => onNavigate('home')}
              style={{ cursor: 'pointer' }}
              className="flex items-center gap-2.5 rounded-lg font-display text-lg font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <img
                src={logo}
                alt=""
                style={{ cursor: 'pointer' }}
                className="h-9 w-9 rounded-lg object-contain"
            />
            <span style={{ cursor: 'pointer' }}>boxi<span className="text-accent-shine">.gg</span></span>
          </button>

          {/* Search bar */}
          <form onSubmit={submit} role="search"
                className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 transition focus-within:border-accent/50 focus-within:bg-white/[0.06] md:flex">
            <Search size={14} className="text-white/40" aria-hidden />
            <label htmlFor="nav-search" className="sr-only">Search Riot ID</label>
            <input id="nav-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Riot ID"
                   className="w-44 bg-transparent text-sm outline-none placeholder:text-white/35" />
            <kbd className="rounded border border-white/10 px-1.5 font-sans text-[10px] text-white/35">EUW</kbd>
          </form>

          {/* Navigation Bar: Home, Live Game, Tier Lists, Leaderboards, and PROFILE as the last item! */}
          <nav ref={navRef} aria-label="Main" className="no-scrollbar relative ml-auto flex gap-0.5 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
            <span ref={indRef} aria-hidden className="pointer-events-none absolute opacity-0 bg-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,.08)]" />
            {TABS.map(([id, label, Icon]) => {
              const active = page === id;
              const on = lit === id;
              // If logged in and on profile tab, display summoner name or custom badge
              const tabLabel = (id === 'profile' && user)
                  ? (activeSummoner?.rawName || user.displayName || 'Profile')
                  : label;

              return (
                  <button key={id} ref={(el) => { tabRefs.current[id] = el; }} onClick={() => onNavigate(id)} aria-current={active ? 'page' : undefined}
                          className={`relative z-10 flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-accent/60 ${on ? 'text-white' : 'text-white/55 hover:bg-white/[0.05] hover:text-white/90'}`}>
                    <Icon size={15} className={on ? 'text-accent' : ''} aria-hidden />
                    <span>{tabLabel}</span>
                  </button>
              );
            })}
          </nav>
        </div>
      </header>
  );
}
