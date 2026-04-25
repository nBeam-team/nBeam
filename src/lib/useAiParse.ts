import { useEffect, useState } from 'react';
import { extractFromText } from './gemini';
import type { ParsedInputs } from './parse';

interface State {
  data: ParsedInputs | null;
  loading: boolean;
  error: string | null;
}

/**
 * Debounced AI extraction hook. Re-runs ~700ms after the user stops typing.
 * Aborts the previous in-flight request when the input changes.
 */
export function useAiParse(text: string, debounceMs = 700) {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!text.trim()) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));

    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      extractFromText(text, ctrl.signal)
        .then((data) => setState({ data, loading: false, error: null }))
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name === 'AbortError') return;
          setState({ data: null, loading: false, error: String(err) });
        });
    }, debounceMs);

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [text, debounceMs]);

  return state;
}
