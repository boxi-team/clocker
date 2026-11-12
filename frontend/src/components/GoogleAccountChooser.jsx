import { useState } from 'react';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import RegionSelect from './RegionSelect';
import { SEARCH_REGIONS } from '../lib/constants';

const REGION_LIST = Object.keys(SEARCH_REGIONS);

function GoogleIcon({ className = 'h-6 w-6' }) {
    return (
        <svg viewBox="0 0 24 24" className={className}>
            <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
        </svg>
    );
}

export default function GoogleAccountChooser({ onSelectAccount, onClose }) {
    const [step, setStep] = useState('input'); // 'input' | 'link_riot' | 'loading'
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    // Riot link step
    const [riotId, setRiotId] = useState('');
    const [region, setRegion] = useState('EUW');

    const handleGoogleSubmit = (e) => {
        e.preventDefault();
        setError('');
        if (!email.trim() || !email.includes('@')) {
            setError('Introdu o adresă validă de email Google / Gmail.');
            return;
        }
        setStep('loading');
        setTimeout(() => {
            setStep('link_riot');
        }, 350);
    };

    const handleComplete = (skipRiot = false) => {
        setStep('loading');
        setTimeout(() => {
            onSelectAccount({
                email: email.trim(),
                name: name.trim() || email.split('@')[0],
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email.trim())}`,
                riotId: skipRiot ? null : (riotId.trim() || null),
                region,
            });
        }, 300);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-rise font-sans">
            <div className="relative w-full max-w-[440px] overflow-hidden rounded-[28px] bg-white text-[#1f1f1f] shadow-2xl transition-all">
                {step === 'loading' && (
                    <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden bg-blue-100">
                        <div className="h-full w-full bg-[#1a73e8] animate-[shimmer_1s_infinite]" />
                    </div>
                )}

                <div className="p-7 sm:p-9">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <GoogleIcon className="h-6 w-6" />
                        <button
                            onClick={onClose}
                            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                            title="Închide"
                        >
                            ✕
                        </button>
                    </div>

                    {/* STEP 1: CONECTARE CU GOOGLE */}
                    {step === 'input' && (
                        <div className="mt-5">
                            <h2 className="text-[22px] font-normal tracking-tight text-[#1f1f1f]">
                                Conectați-vă cu Google
                            </h2>
                            <p className="mt-1 text-sm text-[#444746]">
                                pentru a continua pe <strong className="font-semibold text-[#1f1f1f]">boxi.gg</strong>
                            </p>

                            {error && (
                                <p className="mt-3 text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                                    {error}
                                </p>
                            )}

                            <form onSubmit={handleGoogleSubmit} className="mt-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        E-mail Google / Gmail
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="nume@gmail.com"
                                        className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-blue-100"
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Nume afișat (opțional)
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="ex: Alex"
                                        className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>

                                <div className="flex items-center justify-between pt-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="text-xs font-semibold text-gray-500 hover:text-gray-800"
                                    >
                                        Anulează
                                    </button>
                                    <button
                                        type="submit"
                                        className="rounded-full bg-[#1a73e8] px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-600 active:scale-95 transition"
                                    >
                                        Înainte
                                    </button>
                                </div>
                            </form>

                            <p className="mt-6 text-[11px] leading-relaxed text-[#5f6368]">
                                Pentru a continua, Google va permite accesul la adresa de e-mail și fotografia de profil pentru boxi.gg.
                            </p>
                        </div>
                    )}

                    {/* STEP 2: LINK RIOT ID */}
                    {step === 'link_riot' && (
                        <div className="mt-5">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 py-1 px-3">
                                <span className="h-2 w-2 rounded-full bg-green-500" />
                                <span className="text-xs font-semibold text-gray-800">{email}</span>
                                <Check size={13} className="text-green-600" />
                            </div>

                            <h2 className="text-[20px] font-normal tracking-tight text-[#1f1f1f]">
                                Asociază contul tău Riot Games
                            </h2>
                            <p className="mt-1 text-xs text-[#5f6368]">
                                Introdu Riot ID-ul tău pentru a-ți încărca statisticile și istoricul de meciuri.
                            </p>

                            <div className="mt-5 space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Riot ID (Game Name#TAG)
                                    </label>
                                    <div className="flex items-center gap-2 rounded-xl border border-gray-300 p-1.5 pl-3 focus-within:border-[#1a73e8]">
                                        <input
                                            type="text"
                                            value={riotId}
                                            onChange={(e) => setRiotId(e.target.value)}
                                            placeholder="Nume#TAG"
                                            className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                                            autoFocus
                                        />
                                        <RegionSelect value={region} onChange={setRegion} options={REGION_LIST} />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => handleComplete(true)}
                                        className="text-xs font-semibold text-gray-500 hover:text-gray-800"
                                    >
                                        Sari peste (asociază mai târziu)
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleComplete(false)}
                                        className="rounded-full bg-[#1a73e8] px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-600 active:scale-95 transition"
                                    >
                                        Conectare & Profil
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP: LOADING */}
                    {step === 'loading' && (
                        <div className="py-12 text-center">
                            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#1a73e8]" />
                            <p className="mt-4 text-xs font-medium text-gray-500">Se procesează...</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 bg-[#f8fafd] px-7 py-3 text-[11px] text-[#5f6368] flex items-center justify-between">
                    <span>Google Identity</span>
                    <div className="flex items-center gap-3">
                        <span>Confidențialitate</span>
                        <span>Termeni</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
