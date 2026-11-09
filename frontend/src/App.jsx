import { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Stage from './components/Stage';
import Home from './pages/Home';
import Profile from './pages/Profile';
import { Glass } from './components/ui';

export default function App() {
    const [page, setPage] = useState('home');
    const [summoner, setSummoner] = useState({ name: 'NeonSage#EUW', region: 'EUW' });
    const search = (name, region) => { setSummoner({ name, region }); setPage('profile'); };

    // New page = start at the top (otherwise you land mid-page after clicking from the footer or a lower panel)
    useEffect(() => { window.scrollTo(0, 0); }, [page]);

    return (
        <div className="relative flex min-h-screen flex-col overflow-x-clip bg-ink font-sans text-white antialiased">
            <Navbar page={page} onNavigate={setPage} onSearch={search} />

            {page === 'home' ? (
                // Home builds its own sections (each with its own background)
                <main key="home" className="animate-rise flex-1">
                    <Home onSearch={search} onNavigate={setPage} />
                </main>
            ) : (
                // Other pages: one background fixed behind the whole screen
                <Stage fixed blobs className="flex-1">
                    <main key={page} className="animate-rise">
                        {page === 'profile' && <Profile summoner={summoner} />}
                        {page !== 'profile' && (
                            <Glass className="mx-auto mt-20 max-w-md p-8 text-center text-white/60">Next step: this page is not built yet.</Glass>
                        )}
                    </main>
                </Stage>
            )}

            <Footer onNavigate={setPage} />
        </div>
    );
}
