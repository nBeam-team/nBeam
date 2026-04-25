import { useCallback, useState } from 'react';
import { extractFromText } from './gemini';
import type { ParsedInputs } from './parse';

interface State {
  data: ParsedInputs | null;
  loading: boolean;
  error: string | null;
  /** The text that was last successfully extracted (used to detect staleness). */
  extractedText: string | null;
}

export interface AiExtractResult {
  data: ParsedInputs | null;
  loading: boolean;
  error: string | null;
  /** True when the textarea has been edited since the last successful extraction. */
  stale: boolean;
  /** Manually run an extraction against the current text. */
  trigger: () => void;
}

/**
 * Manual Gemini extraction hook. Caller invokes `trigger()` when the user is
 * ready (typically a button click). Regex parsing runs independently and
 * provides an instant fallback for free.
 */
export function useAiParse(text: string): AiExtractResult {
  const [state, setState] = useState<State>({
    data: null,
    loading: false,
    error: null,
    extractedText: null,
  });

  const trigger = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    extractFromText(trimmed)
      .then((data) =>
        setState({ data, loading: false, error: null, extractedText: trimmed }),
      )
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setState((s) => ({ ...s, loading: false, error: String(err) }));
      });
  }, [text]);

  const stale = !!state.extractedText && state.extractedText !== text.trim();

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    stale,
    trigger,
  };
}
