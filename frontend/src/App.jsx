import { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Stage from './components/Stage';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Champions from './pages/Champions';
import ChampionDetail from './pages/ChampionDetail';
import { useLocation, navigate } from './hooks/useUrl';
import { Glass } from './components/ui';

export default function App() {
    const [localPage, setPage] = useState('home');
    const { pathname } = useLocation();
    const seg = pathname.split('/').filter(Boolean);
    const page = seg[0] === 'champions' ? (seg[1] ? 'champion' : 'champions') : localPage;
    const go = (p) => {
        if (p === 'tiers') return navigate('/champions?view=tier-list');
        if (p === 'champions') return navigate('/champions');
        if (seg[0] === 'champions') navigate('/');
        setPage(p);
    };

    // Setăm starea inițială pe null ca să știm că e prima vizită
    const [summoner, setSummoner] = useState(null);
    const search = (name, region) => { setSummoner({ name, region }); go('profile'); };

    useEffect(() => { window.scrollTo(0, 0); }, [page, seg[1]]);

    return (
        <div className="relative flex min-h-screen flex-col overflow-x-clip bg-ink font-sans text-white antialiased">
            <Navbar page={page === 'champions' || page === 'champion' ? 'tiers' : page} onNavigate={go} onSearch={search} />

            {page === 'home' ? (
                <main key="home" className="animate-rise flex-1">
                    {/* Am adăugat proprietatea summoner aici */}
                    <Home onSearch={search} onNavigate={go} summoner={summoner} />
                </main>
            ) : (
                <Stage fixed blobs className="flex-1">
                    <main key={page} className="animate-rise">
                        {page === 'profile' && summoner && <Profile key={`${summoner.region}:${summoner.name}`} summoner={summoner} />}
                        {page === 'champions' && <Champions />}
                        {page === 'champion' && <ChampionDetail id={decodeURIComponent(seg[1])} />}
                        {!['profile', 'champions', 'champion'].includes(page) && (
                            <Glass className="mx-auto mt-20 max-w-md p-8 text-center text-white/60">Next step: this page is not built yet.</Glass>
                        )}
                    </main>
                </Stage>
            )}

            <Footer onNavigate={go} />
        </div>
    );
}