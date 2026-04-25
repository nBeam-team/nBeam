import { useEffect, useState } from 'react';
import type { City } from './types';
import { fetchRegionalContext, type RegionalContext } from './tavily';

interface State {
  city: City | null;
  loading: boolean;
  data: RegionalContext | null;
  error: string | null;
}

/**
 * Debounced live-region fetch. Re-runs only when the city changes.
 * The fetch itself is cached in lib/tavily.ts.
 */
export function useRegionalContext(city: City | null, debounceMs = 350) {
  const [state, setState] = useState<State>({
    city: null,
    loading: false,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!city) {
      setState({ city: null, loading: false, data: null, error: null });
      return;
    }
    setState((s) => ({ ...s, city, loading: true, error: null }));

    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetchRegionalContext(city, ctrl.signal)
        .then((data) =>
          setState({ city, loading: false, data, error: null }),
        )
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name === 'AbortError') return;
          setState({ city, loading: false, data: null, error: String(err) });
        });
    }, debounceMs);

    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [city, debounceMs]);

  return state;
}
