import { useState, useEffect, useRef } from 'react';
import { Glass } from '../components/ui';
import RegionSelect from '../components/RegionSelect';
import { SEARCH_REGIONS } from '../lib/constants';
import { useAuth } from '../hooks/useAuth';
import {
    LogIn,
    UserPlus,
    User,
    Shield,
    Sparkles,
    AlertCircle,
    ArrowRight,
    Lock,
    Mail,
    Link2,
    CheckCircle2,
    RotateCcw,
    Send,
} from 'lucide-react';

const REGION_LIST = Object.keys(SEARCH_REGIONS);

export default function Auth({ onLoginSuccess }) {
    const { loginWithEmail, registerWithEmail, verifyEmailAndLogin, resendVerificationEmail } = useAuth();

    // Mode: 'login' | 'register' | 'verify'
    const [mode, setMode] = useState('login');

    // Form inputs
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [username, setUsername] = useState('');

    // Optional Riot ID at registration
    const [riotId, setRiotId] = useState('');
    const [region, setRegion] = useState('EUW');

    // Verification inputs: 6 digits
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [countdown, setCountdown] = useState(0);
    const otpRefs = useRef([]);

    // Feedback
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);

    // Timer for resend code
    useEffect(() => {
        if (countdown <= 0) return;
        const t = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(t);
    }, [countdown]);

    const finish = (user) => {
        if (onLoginSuccess) {
            onLoginSuccess(user.riotAccount || { name: user.displayName, region });
        }
    };

    // 1. Submit Login
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setInfo('');
        setLoading(true);
        try {
            const res = await loginWithEmail({ email: email.trim(), password });
            if (res.status === 'NEEDS_VERIFICATION') {
                setMode('verify');
                setCountdown(30);
                setInfo('Contul tău nu este încă verificat. Ți-am trimis un cod nou pe email.');
                return;
            }
            finish(res.user);
        } catch (err) {
            setError(err.message || 'Eroare la autentificare.');
        } finally {
            setLoading(false);
        }
    };

    // 2. Submit Register (Sends Email Verification Code via Backend)
    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setInfo('');

        if (password !== confirmPassword) {
            setError('Parolele introduse nu se potrivesc.');
            return;
        }

        setLoading(true);
        try {
            await registerWithEmail({
                username: username.trim(),
                email: email.trim(),
                password,
                riotId: riotId.trim() || null,
                region,
            });

            setMode('verify');
            setCountdown(30);
            setOtp(['', '', '', '', '', '']);
            setInfo(`Am trimis codul de verificare la adresa ${email.trim()}`);
        } catch (err) {
            setError(err.message || 'Eroare la crearea contului.');
        } finally {
            setLoading(false);
        }
    };

    // 3. Handle OTP Code Input
    const handleOtpChange = (index, value) => {
        if (!/^[0-9]?$/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-advance la următoarea căsuță
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }

        // Dacă s-au completat toate 6 cifrele, trimite automat
        const fullCode = newOtp.join('');
        if (fullCode.length === 6) {
            submitVerification(fullCode);
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            const digits = pasted.split('');
            setOtp(digits);
            submitVerification(pasted);
        }
    };

    const submitVerification = async (codeToVerify) => {
        const code = codeToVerify || otp.join('');
        if (code.length < 6) {
            setError('Introdu toate cele 6 cifre ale codului primit pe email.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const user = await verifyEmailAndLogin({ email: email.trim(), code });
            finish(user);
        } catch (err) {
            setError(err.message || 'Cod invalid sau expirat.');
        } finally {
            setLoading(false);
        }
    };

    // Resend email
    const handleResend = async () => {
        if (countdown > 0) return;
        setError('');
        setInfo('');
        setLoading(true);
        try {
            const res = await resendVerificationEmail({ email: email.trim() });
            if (res.code) {
                setLastSentCode(res.code);
            }
            setCountdown(30);
            setInfo('Un nou cod de verificare a fost expediat pe email-ul tău.');
        } catch (err) {
            setError('Nu s-a putut retrimite emailul.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl items-center justify-center px-4 py-8">
            <Glass className="relative w-full max-w-lg overflow-hidden p-6 sm:p-8">
                <div className="pointer-events-none absolute -top-24 left-1/2 h-44 w-96 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />

                {/* Header */}
                <div className="relative mb-6 text-center">
                    <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
                        <Sparkles size={13} />
                        <span>Autentificare Securizată</span>
                    </div>
                    <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                        {mode === 'verify' ? 'Verificare Email' : mode === 'login' ? 'Intră în cont' : 'Creează un cont'}
                    </h1>
                    <p className="mt-1 text-sm text-white/55">
                        {mode === 'verify'
                            ? `Introdu codul de 6 cifre trimis pe email pentru a-ți activa contul.`
                            : mode === 'login'
                            ? 'Conectează-te cu emailul și parola ta pentru a accesa profilul.'
                            : 'Înregistrează-te cu email și parolă pentru a-ți salva istoricul și statisticile.'}
                    </p>
                </div>

                {/* Tab switcher între Login și Register (ascuns în ecranul de verify) */}
                {mode !== 'verify' && (
                    <div className="mb-6 flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
                        <button
                            type="button"
                            onClick={() => { setMode('login'); setError(''); setInfo(''); }}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition ${
                                mode === 'login'
                                    ? 'bg-accent text-ink font-bold shadow-lg shadow-accent/25'
                                    : 'text-white/60 hover:bg-white/[0.05] hover:text-white'
                            }`}
                        >
                            <LogIn size={14} />
                            <span>Conectare</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setMode('register'); setError(''); setInfo(''); }}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition ${
                                mode === 'register'
                                    ? 'bg-accent text-ink font-bold shadow-lg shadow-accent/25'
                                    : 'text-white/60 hover:bg-white/[0.05] hover:text-white'
                            }`}
                        >
                            <UserPlus size={14} />
                            <span>Înregistrare</span>
                        </button>
                    </div>
                )}

                {/* Error Banner */}
                {error && (
                    <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                        <AlertCircle size={15} className="shrink-0 text-red-400" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Info / Success Banner */}
                {info && (
                    <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs text-accent">
                        <CheckCircle2 size={15} className="shrink-0" />
                        <span>{info}</span>
                    </div>
                )}

                {/* ==================== 1. FORMULAR LOGIN ==================== */}
                {mode === 'login' && (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-white/70">Adresă de Email</label>
                            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-2.5 pl-3 focus-within:border-accent/60">
                                <Mail size={15} className="text-white/40" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="exemplu@email.com"
                                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-white/70">Parolă</label>
                            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-2.5 pl-3 focus-within:border-accent/60">
                                <Lock size={15} className="text-white/40" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-ink shadow-[0_0_25px_-5px_rgba(94,225,255,0.6)] transition hover:bg-white active:scale-[0.98] disabled:opacity-50"
                        >
                            <LogIn size={15} />
                            <span>{loading ? 'Se conectează...' : 'Conectare'}</span>
                        </button>

                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={() => { setMode('register'); setError(''); }}
                                className="text-xs text-white/50 hover:text-accent transition"
                            >
                                Nu ai încă un cont? <strong className="font-semibold text-white">Înregistrează-te</strong>
                            </button>
                        </div>
                    </form>
                )}

                {/* ==================== 2. FORMULAR REGISTER ==================== */}
                {mode === 'register' && (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-white/70">Nume utilizator</label>
                            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-2.5 pl-3 focus-within:border-accent/60">
                                <User size={15} className="text-white/40" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Numele tău"
                                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-white/70">
                                Email (unde vei primi codul de verificare)
                            </label>
                            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-2.5 pl-3 focus-within:border-accent/60">
                                <Mail size={15} className="text-white/40" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="exemplu@email.com"
                                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-white/70">Parolă</label>
                                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-2.5 pl-3 focus-within:border-accent/60">
                                    <Lock size={15} className="text-white/40" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Min. 6 caractere"
                                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-white/70">Confirmare parolă</label>
                                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-2.5 pl-3 focus-within:border-accent/60">
                                    <Lock size={15} className="text-white/40" />
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Repetă parola"
                                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Optional Riot Account Link right at registration */}
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-accent">
                                <Link2 size={13} />
                                <span>Asociere Riot ID opțională (poți completa și ulterior)</span>
                            </label>
                            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-1.5 pl-2.5">
                                <input
                                    type="text"
                                    value={riotId}
                                    onChange={(e) => setRiotId(e.target.value)}
                                    placeholder="ex: Caps#EUW sau Faker#KR1"
                                    className="w-full bg-transparent text-xs text-white outline-none placeholder:text-white/30"
                                />
                                <RegionSelect value={region} onChange={setRegion} options={REGION_LIST} />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-ink shadow-[0_0_25px_-5px_rgba(94,225,255,0.6)] transition hover:bg-white active:scale-[0.98] disabled:opacity-50"
                        >
                            <Send size={15} />
                            <span>{loading ? 'Se trimite codul...' : 'Creează Cont & Trimite Cod'}</span>
                            <ArrowRight size={15} />
                        </button>

                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={() => { setMode('login'); setError(''); }}
                                className="text-xs text-white/50 hover:text-accent transition"
                            >
                                Ai deja un cont? <strong className="font-semibold text-white">Conectează-te</strong>
                            </button>
                        </div>
                    </form>
                )}

                {/* ==================== 3. ECRAN VERIFICARE EMAIL (OTP) ==================== */}
                {mode === 'verify' && (
                    <div className="space-y-6">
                        <div className="rounded-2xl border border-accent/25 bg-accent/5 p-4 text-center">
                            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-accent/20 text-accent ring-1 ring-accent/30">
                                <Mail size={24} />
                            </div>
                            <p className="text-xs text-white/60">Am trimis un cod de verificare la:</p>
                            <p className="font-semibold text-white text-sm">{email}</p>
                        </div>

                        {/* 6 Digit Input Boxes */}
                        <div>
                            <label className="mb-2 block text-center text-xs font-medium text-white/70">
                                Introdu codul de 6 cifre
                            </label>
                            <div className="flex justify-center gap-2 sm:gap-3" onPaste={handleOtpPaste}>
                                {otp.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => (otpRefs.current[i] = el)}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(i, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                        className="h-12 w-11 rounded-xl border border-white/15 bg-white/[0.05] text-center font-display text-xl font-bold text-white outline-none transition focus:border-accent focus:bg-accent/10 focus:shadow-[0_0_15px_rgba(94,225,255,0.3)] sm:h-14 sm:w-13"
                                        autoFocus={i === 0}
                                    />
                                ))}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => submitVerification()}
                            disabled={loading || otp.join('').length < 6}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-ink shadow-[0_0_25px_-5px_rgba(94,225,255,0.6)] transition hover:bg-white active:scale-[0.98] disabled:opacity-50"
                        >
                            <CheckCircle2 size={16} />
                            <span>{loading ? 'Se verifică...' : 'Verifică & Intră în Cont'}</span>
                        </button>

                        <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                            <button
                                type="button"
                                onClick={() => { setMode('register'); setError(''); }}
                                className="text-white/50 hover:text-white"
                            >
                                Schimbă emailul
                            </button>

                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={countdown > 0 || loading}
                                className="flex items-center gap-1 font-semibold text-accent disabled:opacity-40"
                            >
                                <RotateCcw size={12} />
                                <span>
                                    {countdown > 0 ? `Retrimite în ${countdown}s` : 'Retrimite codul'}
                                </span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer security note */}
                <div className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] text-white/35">
                    <Shield size={12} className="text-accent/60" />
                    <span>Conexiune criptată · Verificare securizată prin email</span>
                </div>
            </Glass>
        </div>
    );
}
