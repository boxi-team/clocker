// Mini router on the History API (no extra dependency). Existing pages keep their state-based navigation.
import { useEffect, useState } from 'react';

const EVT = 'boxi:urlchange';

export function navigate(url, { replace = false } = {}) {
    window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
    window.dispatchEvent(new Event(EVT));
}

export function useLocation() {
    const [, bump] = useState(0);
    useEffect(() => {
        const f = () => bump((n) => n + 1);
        window.addEventListener('popstate', f);
        window.addEventListener(EVT, f);
        return () => { window.removeEventListener('popstate', f); window.removeEventListener(EVT, f); };
    }, []);
    return { pathname: window.location.pathname, search: window.location.search };
}

// Query string as state: set({ tier: 'gold', role: null }) removes empty values from the URL.
export function useSearchParams() {
    const { search } = useLocation();
    const params = new URLSearchParams(search);
    const set = (updates, opts = { replace: true }) => {
        const p = new URLSearchParams(window.location.search);
        for (const [k, v] of Object.entries(updates)) (v == null || v === '' ? p.delete(k) : p.set(k, v));
        const s = p.toString();
        navigate(window.location.pathname + (s ? `?${s}` : ''), opts);
    };
    return [params, set];
}
