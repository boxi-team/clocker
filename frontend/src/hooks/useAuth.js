import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

export function useAuth() {
    const [user, setUser] = useState(() => authService.getUser());
    const [activeSummoner, setActiveSummoner] = useState(() => authService.getActiveSummoner());

    useEffect(() => {
        const sync = () => {
            setUser(authService.getUser());
            setActiveSummoner(authService.getActiveSummoner());
        };

        window.addEventListener('boxi_auth_change', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('boxi_auth_change', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const loginWithRiot = useCallback((params) => {
        const u = authService.loginWithRiot(params);
        setUser(u);
        setActiveSummoner(u.riotAccount);
        return u;
    }, []);

    const loginWithGoogle = useCallback((params) => {
        const u = authService.loginWithGoogle(params);
        setUser(u);
        setActiveSummoner(u.riotAccount);
        return u;
    }, []);

    const loginAsGuest = useCallback((params) => {
        const u = authService.loginAsGuest(params);
        setUser(u);
        setActiveSummoner(u.riotAccount);
        return u;
    }, []);

    const loginWithEmail = useCallback((params) => {
        const u = authService.loginWithEmail(params);
        setUser(u);
        setActiveSummoner(u.riotAccount);
        return u;
    }, []);

    const registerWithEmail = useCallback(async (params) => {
        const res = await authService.registerWithEmail(params);
        return res;
    }, []);

    const verifyEmailAndLogin = useCallback((params) => {
        const u = authService.verifyEmailAndLogin(params);
        setUser(u);
        setActiveSummoner(u.riotAccount);
        return u;
    }, []);

    const resendVerificationEmail = useCallback(async (params) => {
        return await authService.resendVerificationEmail(params);
    }, []);

    const linkRiotAccount = useCallback((params) => {
        const u = authService.linkRiotAccount(params);
        setUser(u);
        setActiveSummoner(u.riotAccount);
        return u;
    }, []);

    const unlinkRiotAccount = useCallback(() => {
        const u = authService.unlinkRiotAccount();
        setUser(u);
        setActiveSummoner(null);
        return u;
    }, []);

    const logout = useCallback(() => {
        authService.logout();
        setUser(null);
        setActiveSummoner(null);
    }, []);

    return {
        user,
        activeSummoner,
        isAuthenticated: !!user,
        isGuest: user?.method === 'guest',
        hasLinkedRiot: !!user?.riotAccount,
        loginWithRiot,
        loginWithGoogle,
        loginAsGuest,
        loginWithEmail,
        registerWithEmail,
        verifyEmailAndLogin,
        resendVerificationEmail,
        linkRiotAccount,
        unlinkRiotAccount,
        logout,
    };
}
