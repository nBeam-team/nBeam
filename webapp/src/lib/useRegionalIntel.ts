import { useEffect, useState } from 'react';
import { fetchRegionalIntel, type RegionalInsight } from './tavily';
import type { City } from './types';

interface State {
  city: City | null;
  loading: boolean;
  insights: RegionalInsight[];
  error: string | null;
}

/**
 * Multi-topic regional intel for a city. Cached per-city in tavily.ts.
 */
export function useRegionalIntel(city: City | null, debounceMs = 350) {
  const [state, setState] = useState<State>({
    city: null,
    loading: false,
    insights: [],
    error: null,
  });

  useEffect(() => {
    if (!city) {
      setState({ city: null, loading: false, insights: [], error: null });
      return;
    }
    setState((s) => ({ ...s, city, loading: true, error: null }));

    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetchRegionalIntel(city, ctrl.signal)
        .then((insights) =>
          setState({ city, loading: false, insights, error: null }),
        )
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name === 'AbortError') return;
          setState({ city, loading: false, insights: [], error: String(err) });
        });
    }, debounceMs);

    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [city, debounceMs]);

  return state;
}
