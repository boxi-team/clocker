const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const emailService = {
    // Trimite cererea reală către backend să expedieze emailul de verificare
    async sendVerificationEmail(email, username) {
        let res;
        try {
            res = await fetch(`${API}/v1/auth/send-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), username: username?.trim() }),
            });
        } catch {
            throw new Error('Backend inaccesibil. Serverul colegilor (pe portul 3000) nu rulează sau nu răspunde.');
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error?.message || 'Eroare la trimiterea emailului de verificare de către backend.');
        }

        return data.data;
    },

    // Trimite codul introdus către backend pentru validare
    async verifyCode(email, code) {
        let res;
        try {
            res = await fetch(`${API}/v1/auth/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), code: String(code).trim() }),
            });
        } catch {
            throw new Error('Backend inaccesibil la verificarea codului.');
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error?.message || 'Codul introdus este invalid sau a expirat.');
        }

        return data.data;
    },

    // Retrimite codul prin backend
    async resendCode(email) {
        let res;
        try {
            res = await fetch(`${API}/v1/auth/resend-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
        } catch {
            throw new Error('Backend inaccesibil la retrimiterea codului.');
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error?.message || 'Eroare la retrimiterea codului.');
        }

        return data.data;
    },
};
