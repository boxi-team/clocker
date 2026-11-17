const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const emailService = {
    // Send real request to backend to send verification email
    async sendVerificationEmail(email, username) {
        let res;
        try {
            res = await fetch(`${API}/v1/auth/send-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), username: username?.trim() }),
            });
        } catch {
            throw new Error('Backend unreachable. The server on port 3000 is not running or not responding.');
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error?.message || 'Error sending verification email from backend.');
        }

        return data.data;
    },

    // Send code to backend for validation
    async verifyCode(email, code) {
        let res;
        try {
            res = await fetch(`${API}/v1/auth/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), code: String(code).trim() }),
            });
        } catch {
            throw new Error('Backend unreachable during code verification.');
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error?.message || 'The verification code entered is invalid or has expired.');
        }

        return data.data;
    },

    // Resend code via backend
    async resendCode(email) {
        let res;
        try {
            res = await fetch(`${API}/v1/auth/resend-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
        } catch {
            throw new Error('Backend unreachable during code resend.');
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error?.message || 'Error resending code.');
        }

        return data.data;
    },
};
