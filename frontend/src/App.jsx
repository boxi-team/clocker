import { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Stage from './components/Stage';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Auth from './pages/Auth';
import Champions from './pages/Champions';
import ChampionDetail from './pages/ChampionDetail';
import Leaderboard from './pages/Leaderboard';
import LiveGame from './pages/LiveGame';
import { useLocation, navigate } from './hooks/useUrl';
import { Glass } from './components/ui';
import { useAuth } from './hooks/useAuth';

export default function App() {
    const [localPage, setPage] = useState('home');
    const { user, activeSummoner } = useAuth();
    const { pathname } = useLocation();
    const seg = pathname.split('/').filter(Boolean);
    const page = seg[0] === 'champions' ? (seg[1] ? 'champion' : 'champions')
        : seg[0] === 'leaderboard' ? 'leaders'
        : seg[0] === 'live' ? 'live'
        : localPage;
    const onUrlPage = seg[0] === 'champions' || seg[0] === 'leaderboard' || seg[0] === 'live';

    // Temporary searched summoner (from search bar). If null, activeSummoner from auth is used.
    const [searchedSummoner, setSearchedSummoner] = useState(null);

    const go = (p) => {
        if (p === 'tiers') return navigate('/champions?view=tier-list');
        if (p === 'champions') return navigate('/champions');
        if (p === 'leaders') return navigate('/leaderboard');
        if (p === 'live') return navigate('/live');
        if (p === 'profile') setSearchedSummoner(null); // Going directly to profile clears search to show own profile
        if (onUrlPage) navigate('/');
        setPage(p);
    };

    const search = (name, region) => {
        setSearchedSummoner({ name, region });
        if (onUrlPage) navigate('/');
        setPage('profile');
    };

    // The summoner to display on Profile: searched summoner if active search, otherwise linked active summoner
    const currentSummoner = searchedSummoner || activeSummoner;
    const isOwnProfile = !searchedSummoner || (activeSummoner && (activeSummoner.name === searchedSummoner.name || activeSummoner.rawName === searchedSummoner.name));

    useEffect(() => { window.scrollTo(0, 0); }, [page, seg[1]]);

    return (
        <div className="relative flex min-h-screen flex-col overflow-x-clip bg-ink font-sans text-white antialiased">
            <Navbar
                page={page === 'champions' || page === 'champion' ? 'tiers' : page}
                onNavigate={go}
                onSearch={search}
            />

            {page === 'home' ? (
                <main key="home" className="animate-rise flex-1">
                    <Home onSearch={search} onNavigate={go} summoner={currentSummoner} />
                </main>
            ) : (
                <Stage fixed blobs className="flex-1">
                    <main key={page} className="animate-rise">
                        {/* Profile page: if user is logged in or has linked summoner (or searched a player), show Profile.
                            Otherwise show Login / Register / Link page! */}
                        {page === 'profile' && (
                            currentSummoner ? (
                                <Profile
                                    key={`${currentSummoner.region}:${currentSummoner.name}`}
                                    summoner={currentSummoner}
                                    isOwnProfile={isOwnProfile}
                                    onBackToMyProfile={activeSummoner ? () => setSearchedSummoner(null) : undefined}
                                />
                            ) : (
                                <Auth
                                    onLoginSuccess={(s) => {
                                        setSearchedSummoner(null);
                                        setPage('profile');
                                    }}
                                />
                            )
                        )}

                        {page === 'login' && (
                            <Auth
                                onLoginSuccess={(s) => {
                                    setSearchedSummoner(null);
                                    setPage('profile');
                                }}
                            />
                        )}

                        {page === 'champions' && <Champions />}
                        {page === 'champion' && <ChampionDetail id={decodeURIComponent(seg[1])} />}
                        {page === 'leaders' && <Leaderboard onSearch={search} />}
                        {page === 'live' && <LiveGame summoner={currentSummoner} onSearch={search} onNavigate={go} />}

                        {!['profile', 'login', 'champions', 'champion', 'leaders', 'live'].includes(page) && (
                            <Glass className="mx-auto mt-20 max-w-md p-8 text-center text-white/60">
                                Next step: this page is not built yet.
                            </Glass>
                        )}
                    </main>
                </Stage>
            )}

            <Footer onNavigate={go} />
        </div>
    );
}
