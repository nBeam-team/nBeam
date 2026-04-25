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

/* ---------------- Regional intel: four targeted queries per city ---------------- */

export type IntelTopic =
  | 'price'
  | 'yield'
  | 'subsidy'
  | 'install'
  | 'feedin'
  | 'news';

export interface RegionalInsight {
  topic: IntelTopic;
  label: string;
  answer: string;
  sources: TavilySource[];
}

interface TopicSpec {
  id: IntelTopic;
  label: string;
  query: (city: string) => string;
  topic?: 'general' | 'news';
  timeRange?: 'day' | 'week' | 'month' | 'year';
  /** When 'advanced', Tavily returns a longer synthesized answer. */
  answerMode?: 'basic' | 'advanced';
}

const TOPIC_SPECS: TopicSpec[] = [
  {
    id: 'price',
    label: 'electricity prices',
    query: (c) =>
      `current residential electricity price per kWh in ${c}, Germany — recent changes and year-over-year trend`,
    answerMode: 'advanced',
  },
  {
    id: 'yield',
    label: 'regional solar yield',
    query: (c) =>
      `typical residential rooftop solar PV annual yield in kWh per kWp installed in ${c}, Germany — irradiance and orientation factors`,
    answerMode: 'advanced',
  },
  {
    id: 'subsidy',
    label: 'subsidies & incentives',
    query: (c) =>
      `residential solar PV subsidies KfW grants tax credits applicable in ${c}, Germany 2025 — including federal and regional programmes`,
    answerMode: 'advanced',
  },
  {
    id: 'install',
    label: 'installation costs',
    query: (c) =>
      `typical residential solar PV installation cost per kWp in ${c}, Germany 2025 — including labour, permits and equipment`,
    answerMode: 'advanced',
  },
  {
    id: 'feedin',
    label: 'feed-in & EEG updates',
    query: (c) =>
      `current EEG feed-in tariff and grid export remuneration for residential rooftop solar in ${c}, Germany 2025`,
    answerMode: 'advanced',
  },
  {
    id: 'news',
    label: 'recent news',
    query: (c) =>
      `${c} solar PV residential market news 2025 — installations, panel prices, regulation`,
    topic: 'news',
    timeRange: 'month',
  },
];

const intelCache = new Map<string, RegionalInsight[]>();

export async function fetchRegionalIntel(
  city: string,
  signal?: AbortSignal,
): Promise<RegionalInsight[]> {
  const cached = intelCache.get(city);
  if (cached) return cached;

  const results = await Promise.all(
    TOPIC_SPECS.map(async (spec): Promise<RegionalInsight | null> => {
      try {
        const body: Record<string, unknown> = {
          query: spec.query(city),
          search_depth: 'basic',
          include_answer: spec.answerMode ?? true,
          max_results: 4,
        };
        if (spec.topic) body.topic = spec.topic;
        if (spec.timeRange) body.time_range = spec.timeRange;

        const res = await fetch('/api/tavily/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        });
        if (!res.ok) return null;
        const data = (await res.json()) as TavilyResponse;
        const answer = (data.answer || '').trim();
        if (!answer) return null;
        return {
          topic: spec.id,
          label: spec.label,
          answer,
          sources: (data.results ?? []).slice(0, 2).map((r) => ({
            url: r.url,
            title: r.title,
          })),
        };
      } catch {
        return null;
      }
    }),
  );

  const insights = results.filter((r): r is RegionalInsight => r !== null);
  intelCache.set(city, insights);
  return insights;
}

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
