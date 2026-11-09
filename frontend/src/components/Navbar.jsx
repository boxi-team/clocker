import { useState } from 'react';
import { Home, User, Radio, ListOrdered, Trophy, Search } from 'lucide-react';
import logo from '../assets/logo.png';
const TABS = [
  ['home', 'Home', Home], ['profile', 'Profile', User], ['live', 'Live Game', Radio],
  ['tiers', 'Tier Lists', ListOrdered], ['leaders', 'Leaderboards', Trophy],
];

export default function Navbar({ page, onNavigate, onSearch }) {
  const [q, setQ] = useState('');
  const submit = (e) => { e.preventDefault(); if (q.trim()) { onSearch(q.trim(), 'EUW'); setQ(''); } };
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_8px_32px_-12px_rgba(0,0,0,.5)] backdrop-blur-(--nav-blur) backdrop-saturate-150">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <button onClick={() => onNavigate('home')} className="flex items-center gap-2.5 rounded-lg font-display text-lg font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
          <img src={logo} alt="" className="h-9 w-9 rounded-lg object-contain" />
          <span>Boxi<span className="text-accent">.GG</span></span>
        </button>
        <form onSubmit={submit} role="search"
              className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 transition focus-within:border-accent/50 focus-within:bg-white/[0.06] md:flex">
          <Search size={14} className="text-white/40" aria-hidden />
          <label htmlFor="nav-search" className="sr-only">Search Riot ID</label>
          <input id="nav-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Riot ID"
            className="w-44 bg-transparent text-sm outline-none placeholder:text-white/35" />
          <kbd className="rounded border border-white/10 px-1.5 font-sans text-[10px] text-white/35">EUW</kbd>
        </form>
        <nav aria-label="Main" className="no-scrollbar ml-auto flex gap-0.5 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
          {TABS.map(([id, label, Icon]) => {
            const active = page === id;
            return (
              <button key={id} onClick={() => onNavigate(id)} aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-accent/60 ${active ? 'bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08)]' : 'text-white/55 hover:bg-white/[0.05] hover:text-white/90'}`}>
                <Icon size={15} className={active ? 'text-accent' : ''} aria-hidden /> {label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
