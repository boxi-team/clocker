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
                setInfo('Your account is not verified yet. We sent a new verification code to your email.');
                return;
            }
            finish(res.user);
        } catch (err) {
            setError(err.message || 'Authentication failed. Please check your credentials.');
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
            setError('Passwords do not match.');
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
            setInfo(`Verification code sent to ${email.trim()}`);
        } catch (err) {
            setError(err.message || 'Registration failed. Please try again.');
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

        // Auto-advance to next box
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }

        // If all 6 digits entered, submit automatically
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
            setError('Please enter all 6 digits of the verification code.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const user = await verifyEmailAndLogin({ email: email.trim(), code });
            finish(user);
        } catch (err) {
            setError(err.message || 'Invalid or expired verification code.');
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
            await resendVerificationEmail({ email: email.trim() });
            setCountdown(30);
            setInfo('A new verification code has been dispatched to your email.');
        } catch (err) {
            setError('Could not resend email. Please try again.');
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
                        <span>Secure Authentication</span>
                    </div>
                    <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                        {mode === 'verify' ? 'Email Verification' : mode === 'login' ? 'Sign In' : 'Create an Account'}
                    </h1>
                    <p className="mt-1 text-sm text-white/55">
                        {mode === 'verify'
                            ? `Enter the 6-digit verification code sent to your email to activate your account.`
                            : mode === 'login'
                            ? 'Sign in with your email and password to access your profile.'
                            : 'Sign up with email and password to track your match history and stats.'}
                    </p>
                </div>

                {/* Tab switcher between Login and Register */}
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
                            <span>Sign In</span>
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
                            <span>Create Account</span>
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

                {/* ==================== 1. LOGIN FORM ==================== */}
                {mode === 'login' && (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-white/70">Email Address</label>
                            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-2.5 pl-3 focus-within:border-accent/60">
                                <Mail size={15} className="text-white/40" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-white/70">Password</label>
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
                            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                        </button>

                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={() => { setMode('register'); setError(''); }}
                                className="text-xs text-white/50 hover:text-accent transition"
                            >
                                Don&apos;t have an account yet? <strong className="font-semibold text-white">Create one</strong>
                            </button>
                        </div>
                    </form>
                )}

                {/* ==================== 2. REGISTER FORM ==================== */}
                {mode === 'register' && (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-white/70">Username</label>
                            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-2.5 pl-3 focus-within:border-accent/60">
                                <User size={15} className="text-white/40" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Your username"
                                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-white/70">
                                Email (where you will receive the verification code)
                            </label>
                            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-2.5 pl-3 focus-within:border-accent/60">
                                <Mail size={15} className="text-white/40" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-white/70">Password</label>
                                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-2.5 pl-3 focus-within:border-accent/60">
                                    <Lock size={15} className="text-white/40" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Min. 6 characters"
                                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-white/70">Confirm Password</label>
                                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-2.5 pl-3 focus-within:border-accent/60">
                                    <Lock size={15} className="text-white/40" />
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Repeat password"
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
                                <span>Optional Riot ID Linking (can also be done later)</span>
                            </label>
                            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-1.5 pl-2.5">
                                <input
                                    type="text"
                                    value={riotId}
                                    onChange={(e) => setRiotId(e.target.value)}
                                    placeholder="e.g. Caps#EUW or Faker#KR1"
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
                            <span>{loading ? 'Sending code...' : 'Create Account & Send Code'}</span>
                            <ArrowRight size={15} />
                        </button>

                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={() => { setMode('login'); setError(''); }}
                                className="text-xs text-white/50 hover:text-accent transition"
                            >
                                Already have an account? <strong className="font-semibold text-white">Sign In</strong>
                            </button>
                        </div>
                    </form>
                )}

                {/* ==================== 3. EMAIL VERIFICATION SCREEN (OTP) ==================== */}
                {mode === 'verify' && (
                    <div className="space-y-6">
                        <div className="rounded-2xl border border-accent/25 bg-accent/5 p-4 text-center">
                            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-accent/20 text-accent ring-1 ring-accent/30">
                                <Mail size={24} />
                            </div>
                            <p className="text-xs text-white/60">We sent a verification code to:</p>
                            <p className="font-semibold text-white text-sm">{email}</p>
                        </div>

                        {/* 6 Digit Input Boxes */}
                        <div>
                            <label className="mb-2 block text-center text-xs font-medium text-white/70">
                                Enter the 6-digit code
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
                            <span>{loading ? 'Verifying...' : 'Verify & Sign In'}</span>
                        </button>

                        <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                            <button
                                type="button"
                                onClick={() => { setMode('register'); setError(''); }}
                                className="text-white/50 hover:text-white"
                            >
                                Change email
                            </button>

                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={countdown > 0 || loading}
                                className="flex items-center gap-1 font-semibold text-accent disabled:opacity-40"
                            >
                                <RotateCcw size={12} />
                                <span>
                                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                                </span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer security note */}
                <div className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] text-white/35">
                    <Shield size={12} className="text-accent/60" />
                    <span>Encrypted Connection · Secure Email Verification</span>
                </div>
            </Glass>
        </div>
    );
}
