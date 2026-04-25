import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useRegionalIntel } from '../lib/useRegionalIntel';
import type { IntelTopic, RegionalInsight } from '../lib/tavily';
import type { City } from '../lib/types';

interface Props {
  city: City | null;
}

const ACCENT: Record<
  IntelTopic,
  { dot: string; bg: string; icon: ReactNode }
> = {
  price: { dot: 'bg-terracotta', bg: 'bg-terracotta-50/40', icon: <EuroIcon /> },
  yield: { dot: 'bg-gold', bg: 'bg-gold-50/40', icon: <SunIcon /> },
  subsidy: { dot: 'bg-sage', bg: 'bg-sage-50/40', icon: <ScrollIcon /> },
  install: { dot: 'bg-ink', bg: 'bg-paper-dark/30', icon: <ToolIcon /> },
  feedin: { dot: 'bg-info', bg: 'bg-blue-50/40', icon: <BoltIcon /> },
  news: { dot: 'bg-plum', bg: 'bg-plum-light/15', icon: <NewspaperIcon /> },
};

const ORDER: IntelTopic[] = ['price', 'yield', 'subsidy', 'install', 'feedin', 'news'];

export function RegionalIntel({ city }: Props) {
  const { loading, insights, error } = useRegionalIntel(city);

  if (!city) return null;

  const byTopic = new Map(insights.map((i) => [i.topic, i]));
  const items = ORDER.map((t) => byTopic.get(t) ?? null);
  const showSkeletons = loading && insights.length === 0;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="nb-eyebrow flex items-center gap-2">
          <span className="relative inline-flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-terracotta animate-ping opacity-50" />
            <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-terracotta" />
          </span>
          live regional intel · {city.toLowerCase()}
        </p>
        <div className="flex items-baseline gap-3">
          {loading ? (
            <p className="text-[11px] italic font-serif text-ink-400">checking the latest…</p>
          ) : null}
          <a
            href="https://tavily.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] uppercase tracking-[0.18em] text-ink-400 hover:text-terracotta transition-colors"
          >
            via tavily ↗
          </a>
        </div>
      </div>

      {error ? (
        <p className="text-[12px] italic font-serif text-ink-400">
          couldn't reach the live data — using market averages.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((insight, idx) => {
              if (showSkeletons || (!insight && loading)) {
                return <SkeletonCard key={ORDER[idx]} topic={ORDER[idx]} />;
              }
              if (!insight) return null;
              return <InsightCard key={insight.topic} insight={insight} delay={idx * 0.04} />;
            })}
          </div>
          {!loading && insights.length > 0 ? (
            <p className="text-[10px] italic font-serif text-ink-400 pt-1">
              live web search for {city}, synthesised by{' '}
              <a
                href="https://tavily.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline hover:text-terracotta"
              >
                Tavily
              </a>
              . Each card cites its sources — verify before quoting to a customer.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function InsightCard({ insight, delay }: { insight: RegionalInsight; delay: number }) {
  const style = ACCENT[insight.topic];
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`rounded-xl border border-hairline ${style.bg} p-4 space-y-2 print-keep`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`w-1 h-1 rounded-full ${style.dot}`} />
          <p className="nb-eyebrow text-[10px]">{insight.label}</p>
        </div>
        <span aria-hidden className="text-ink-400">
          {style.icon}
        </span>
      </div>
      <p className="font-serif italic text-[14px] leading-relaxed text-ink">
        “{insight.answer}”
      </p>
      {insight.sources.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
          {insight.sources.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-ink-400 hover:text-terracotta transition-colors underline-offset-2 hover:underline truncate max-w-[210px]"
              title={s.title}
            >
              ↗ {hostname(s.url)}
            </a>
          ))}
        </div>
      ) : null}
    </motion.article>
  );
}

function SkeletonCard({ topic }: { topic: IntelTopic }) {
  const style = ACCENT[topic];
  return (
    <div
      className={`rounded-xl border border-hairline ${style.bg} p-4 space-y-2`}
      aria-hidden
    >
      <div className="flex items-center gap-2">
        <span className={`w-1 h-1 rounded-full ${style.dot}`} />
        <span className="h-2 w-24 rounded bg-paper-dark animate-pulse" />
      </div>
      <div className="space-y-1.5">
        <span className="block h-2.5 rounded bg-paper-dark animate-pulse w-full" />
        <span className="block h-2.5 rounded bg-paper-dark animate-pulse w-5/6" />
        <span className="block h-2.5 rounded bg-paper-dark animate-pulse w-3/6" />
      </div>
    </div>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/* ---------------- icons ---------------- */
function EuroIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 7a6 6 0 0 0-9 1m0 0a6 6 0 0 0 0 8m0-8H4m0 4h6m-6 0a6 6 0 0 0 13 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.6" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <line
            key={i}
            x1={12 + Math.cos(a) * 6.5}
            y1={12 + Math.sin(a) * 6.5}
            x2={12 + Math.cos(a) * 9.5}
            y2={12 + Math.sin(a) * 9.5}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
function ScrollIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4h11a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H8a4 4 0 0 1-4-4V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 9h7M9 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function NewspaperIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M17 9h3v8a2 2 0 0 1-2 2h-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6 9h8M6 12h8M6 15h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ToolIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5 2.5-2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
