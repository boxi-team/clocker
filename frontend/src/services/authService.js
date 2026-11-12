const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Authentication & Account Linking Service for boxi.gg
const STORAGE_KEY = 'boxi_auth_user';
const ACTIVE_SUMMONER_KEY = 'boxi_active_summoner';

const parseRiotId = (raw, defaultRegion = 'EUW') => {
    if (!raw) return { name: '', tag: defaultRegion };
    const parts = raw.split('#');
    const name = parts[0].trim();
    const tag = (parts[1] || defaultRegion).trim();
    return { name, tag };
};

export const authService = {
    getUser() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    getActiveSummoner() {
        try {
            const raw = localStorage.getItem(ACTIVE_SUMMONER_KEY);
            if (raw) return JSON.parse(raw);
            const user = this.getUser();
            return user?.riotAccount || null;
        } catch {
            return null;
        }
    },

    saveUser(user) {
        if (!user) {
            localStorage.removeItem(STORAGE_KEY);
        } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
            if (user.riotAccount) {
                localStorage.setItem(ACTIVE_SUMMONER_KEY, JSON.stringify(user.riotAccount));
            }
        }
        window.dispatchEvent(new CustomEvent('boxi_auth_change', { detail: user }));
    },

    setActiveSummoner(summoner) {
        if (!summoner) {
            localStorage.removeItem(ACTIVE_SUMMONER_KEY);
        } else {
            localStorage.setItem(ACTIVE_SUMMONER_KEY, JSON.stringify(summoner));
        }
        window.dispatchEvent(new CustomEvent('boxi_auth_change'));
    },

    // 1. Login with Riot Games Account
    loginWithRiot({ riotId, region = 'EUW' }) {
        const { name, tag } = parseRiotId(riotId, region);
        if (!name) throw new Error('Summoner name is required');
        const user = {
            id: `riot_${Date.now()}`,
            method: 'riot',
            displayName: name,
            email: null,
            avatar: `https://ddragon.leagueoflegends.com/cdn/14.23.1/img/profileicon/29.png`,
            riotAccount: {
                name: `${name}#${tag}`,
                rawName: name,
                tag,
                region,
            },
            createdAt: new Date().toISOString(),
        };
        this.saveUser(user);
        return user;
    },

    // 2. Login with Google Account
    loginWithGoogle({ email, displayName, avatar, riotId = null, region = 'EUW' }) {
        if (!email) throw new Error('Email is required');
        let riotAccount = null;
        if (riotId && riotId.trim()) {
            const { name, tag } = parseRiotId(riotId, region);
            riotAccount = {
                name: `${name}#${tag}`,
                rawName: name,
                tag,
                region,
            };
        }
        const user = {
            id: `google_${Date.now()}`,
            method: 'google',
            displayName: displayName || email.split('@')[0],
            email,
            avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
            riotAccount,
            createdAt: new Date().toISOString(),
        };
        this.saveUser(user);
        return user;
    },

    // 3. Fara cont (Guest / Link Summoner directly)
    loginAsGuest({ riotId, region = 'EUW' }) {
        const { name, tag } = parseRiotId(riotId, region);
        if (!name) throw new Error('Summoner name is required');
        const user = {
            id: `guest_${Date.now()}`,
            method: 'guest',
            displayName: name,
            email: null,
            avatar: null,
            riotAccount: {
                name: `${name}#${tag}`,
                rawName: name,
                tag,
                region,
            },
            createdAt: new Date().toISOString(),
        };
        this.saveUser(user);
        return user;
    },

    // 4. Standard Email/Password Login & Register (Real Backend API calls)
    async loginWithEmail({ email, password }) {
        if (!email || !password) throw new Error('Email-ul și parola sunt obligatorii.');

        let res;
        try {
            res = await fetch(`${API}/v1/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password }),
            });
        } catch {
            throw new Error('Nu se poate comunica cu backend-ul (port 3000). Asigură-te că serverul Java rulează.');
        }

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(body.error?.message || 'Email sau parolă incorectă.');
        }

        const user = body.data?.user || body.data;
        if (body.data?.token) {
            localStorage.setItem('boxi_token', body.data.token);
        }
        this.saveUser(user);
        return { status: 'SUCCESS', user };
    },

    async registerWithEmail({ username, email, password, riotId = null, region = 'EUW' }) {
        if (!email || !password) throw new Error('Email-ul și parola sunt obligatorii.');
        if (password.length < 6) throw new Error('Parola trebuie să aibă cel puțin 6 caractere.');

        let res;
        try {
            res = await fetch(`${API}/v1/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username.trim(),
                    email: email.trim(),
                    password,
                    riotId: riotId?.trim() || null,
                    region,
                }),
            });
        } catch {
            throw new Error('Nu se poate comunica cu backend-ul (port 3000). Endpoint-ul POST /v1/auth/register trebuie implementat în Java.');
        }

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(body.error?.message || 'Eroare la crearea contului în backend.');
        }

        return {
            status: 'PENDING_VERIFICATION',
            email: email.trim(),
            username: username.trim(),
        };
    },

    async verifyEmailAndLogin({ email, code }) {
        if (!email || !code) throw new Error('Email-ul și codul sunt obligatorii.');

        let res;
        try {
            res = await fetch(`${API}/v1/auth/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), code: String(code).trim() }),
            });
        } catch {
            throw new Error('Nu se poate comunica cu backend-ul (port 3000). Endpoint-ul POST /v1/auth/verify-email trebuie implementat în Java.');
        }

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(body.error?.message || 'Codul de verificare este invalid sau a expirat.');
        }

        const user = body.data?.user || body.data;
        if (body.data?.token) {
            localStorage.setItem('boxi_token', body.data.token);
        }
        this.saveUser(user);
        return user;
    },

    async resendVerificationEmail({ email }) {
        let res;
        try {
            res = await fetch(`${API}/v1/auth/resend-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
        } catch {
            throw new Error('Nu se poate comunica cu backend-ul (port 3000). Endpoint-ul POST /v1/auth/resend-code trebuie implementat în Java.');
        }

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(body.error?.message || 'Eroare la retrimiterea codului din backend.');
        }

        return body.data;
    },

    // Link or Update Riot Account on currently logged-in user
    linkRiotAccount({ riotId, region = 'EUW' }) {
        const { name, tag } = parseRiotId(riotId, region);
        if (!name) throw new Error('Summoner name is required');
        const current = this.getUser();
        const riotAccount = {
            name: `${name}#${tag}`,
            rawName: name,
            tag,
            region,
        };
        if (current) {
            const updated = {
                ...current,
                riotAccount,
            };
            this.saveUser(updated);
            return updated;
        } else {
            return this.loginAsGuest({ riotId, region });
        }
    },

    unlinkRiotAccount() {
        const current = this.getUser();
        if (current) {
            if (current.method === 'guest') {
                this.logout();
                return null;
            }
            const updated = { ...current, riotAccount: null };
            this.saveUser(updated);
            localStorage.removeItem(ACTIVE_SUMMONER_KEY);
            return updated;
        }
        localStorage.removeItem(ACTIVE_SUMMONER_KEY);
        return null;
    },

    logout() {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ACTIVE_SUMMONER_KEY);
        window.dispatchEvent(new CustomEvent('boxi_auth_change', { detail: null }));
    },

    // Internal helpers for demo / local storage users
    _getRegisteredUsers() {
        try {
            return JSON.parse(localStorage.getItem('boxi_registered_users') || '[]');
        } catch {
            return [];
        }
    },

    _saveRegisteredUser(userWithPassword) {
        try {
            const users = this._getRegisteredUsers();
            const filtered = users.filter((u) => u.email.toLowerCase() !== userWithPassword.email.toLowerCase());
            filtered.push(userWithPassword);
            localStorage.setItem('boxi_registered_users', JSON.stringify(filtered));
        } catch {
            // ignore
        }
    },
};
