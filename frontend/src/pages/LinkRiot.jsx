import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { Glass } from '../components/ui';
import RegionSelect from '../components/RegionSelect';
import { SEARCH_REGIONS } from '../lib/constants';
import { useAuth } from '../hooks/useAuth';

const REGION_LIST = Object.keys(SEARCH_REGIONS);

/** Shown after login when the account has no Riot ID yet; linking it opens the user's profile. */
export default function LinkRiot() {
    const { user, linkRiotAccount, logout } = useAuth();
    const [riotId, setRiotId] = useState('');
    const [region, setRegion] = useState('EUW');
    const [error, setError] = useState('');

    const submit = (e) => {
        e.preventDefault();
        setError('');
        if (!riotId.trim()) {
            setError('Please enter a valid Riot ID (Name#TAG)');
            return;
        }
        try {
            linkRiotAccount({ riotId: riotId.trim(), region });
        } catch (err) {
            setError(err.message || 'Failed to link account');
        }
    };

    return (
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl items-center justify-center px-4 py-8">
            <Glass className="w-full max-w-md p-6">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-white">
                    <Link2 size={18} className="text-accent" />
                    <h1 className="font-display font-semibold">Link your Riot account</h1>
                </div>
                <p className="mt-3 text-xs text-white/60">
                    Signed in as {user?.displayName || user?.email}. Add your Riot ID to see your profile.
                </p>

                <form onSubmit={submit} className="mt-4 space-y-4">
                    {error && <p className="text-xs text-loss">{error}</p>}
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-2 pl-3">
                        <input
                            type="text"
                            value={riotId}
                            onChange={(e) => setRiotId(e.target.value)}
                            placeholder="e.g. Caps#EUW or Faker#KR1"
                            aria-label="Riot ID (Game Name#TAG)"
                            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                            autoFocus
                        />
                        <RegionSelect value={region} onChange={setRegion} options={REGION_LIST} />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <button type="button" onClick={logout} className="text-xs text-white/50 hover:text-white">
                            Log out
                        </button>
                        <button
                            type="submit"
                            className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-ink shadow-[0_0_15px_rgba(94,225,255,0.4)] hover:bg-white"
                        >
                            Go to my profile
                        </button>
                    </div>
                </form>
            </Glass>
        </div>
    );
}
