import { useEffect, useState } from 'react';

// Like useAsync, but also returns { error, loading, retry }. Keeps the previous data while refetching.
export function useRequest(fn, deps = []) {
    const [s, setS] = useState({ data: null, error: null, loading: true });
    const [tick, setTick] = useState(0);
    useEffect(() => {
        let alive = true;
        setS((p) => ({ data: p.data, error: null, loading: true }));
        Promise.resolve()
            .then(fn)
            .then((data) => alive && setS({ data, error: null, loading: false }),
                  (error) => alive && setS({ data: null, error, loading: false }));
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, tick]);
    return { ...s, retry: () => setTick((t) => t + 1) };
}
