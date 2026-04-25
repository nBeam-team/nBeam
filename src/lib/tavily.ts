/**
 * Frontend client for the Tavily search proxy.
 * The proxy lives in vite.config.ts and injects the API key server-side.
 */

export interface TavilySource {
  url: string;
  title: string;
}

export interface RegionalContext {
  city: string;
  answer: string;
  sources: TavilySource[];
  fetchedAt: number;
}

interface TavilyResponse {
  answer?: string;
  results?: { url: string; title: string; content?: string; score?: number }[];
  error?: string;
}

const MEMORY: Record<string, RegionalContext> = {};

export async function fetchRegionalContext(
  city: string,
  signal?: AbortSignal,
): Promise<RegionalContext> {
  const cached = MEMORY[city];
  if (cached) return cached;

  const query = `${city}, Germany 2024: average residential electricity price per kWh, typical rooftop solar PV annual yield in kWh per kWp, residential solar subsidies and incentives.`;

  const res = await fetch('/api/tavily/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      search_depth: 'basic',
      include_answer: true,
      max_results: 4,
    }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`tavily ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as TavilyResponse;
  if (data.error) throw new Error(data.error);

  const ctx: RegionalContext = {
    city,
    answer: (data.answer || '').trim(),
    sources: (data.results || []).slice(0, 3).map((r) => ({
      url: r.url,
      title: r.title,
    })),
    fetchedAt: Date.now(),
  };
  MEMORY[city] = ctx;
  return ctx;
}
