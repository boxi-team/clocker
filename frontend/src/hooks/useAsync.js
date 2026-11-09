import { useEffect, useState } from 'react';

export function useAsync(fn, deps = []) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    fn().then((d) => alive && setData(d));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return data;
}
