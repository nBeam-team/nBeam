import { AnimatePresence, motion } from 'framer-motion';
import type { City } from '../lib/types';
import { useRegionalContext } from '../lib/useRegionalContext';

interface Props {
  city: City | null;
  variant?: 'compact' | 'full';
}

/**
 * Live regional context card (electricity prices, PV yield, subsidies),
 * sourced from Tavily search.
 */
export function RegionalSnapshot({ city, variant = 'compact' }: Props) {
  const { loading, data, error } = useRegionalContext(city);

  return (
    <AnimatePresence mode="wait">
      {city ? (
        <motion.div
          key={city + variant}
          layout
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className={
            variant === 'full'
              ? 'bg-paper-light/60 border border-hairline rounded-xl p-6'
              : 'bg-paper-light/40 border border-hairline rounded-xl p-4'
          }
        >
          <div className="flex items-baseline gap-2 mb-3">
            <span className="relative inline-flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-terracotta animate-ping opacity-50" />
              <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-terracotta" />
            </span>
            <p className="nb-eyebrow text-[10px]">live · {city.toLowerCase()}</p>
            {loading && (
              <span className="text-[11px] italic font-serif text-ink-400 ml-auto">
                checking the latest…
              </span>
            )}
          </div>

          {loading && !data ? (
            <SkeletonLine variant={variant} />
          ) : error ? (
            <p className="text-[12px] italic text-ink-400">
              couldn't reach live data — using market averages.
            </p>
          ) : data && data.answer ? (
            <>
              <p
                className={
                  variant === 'full'
                    ? 'font-serif italic text-[16px] leading-relaxed text-ink'
                    : 'font-serif italic text-[14px] leading-relaxed text-ink'
                }
              >
                "{data.answer}"
              </p>
              {data.sources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                  {data.sources.map((s) => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-ink-400 hover:text-terracotta transition-colors underline-offset-2 hover:underline truncate max-w-[260px]"
                      title={s.title}
                    >
                      ↗ {hostname(s.url)}
                    </a>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-[12px] italic text-ink-400">
              no signal from this region — using market averages.
            </p>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SkeletonLine({ variant }: { variant: 'compact' | 'full' }) {
  return (
    <div className="space-y-2">
      <div className={`h-3 rounded-sm bg-paper-dark animate-pulse ${variant === 'full' ? 'w-5/6' : 'w-4/6'}`} />
      <div className="h-3 rounded-sm bg-paper-dark animate-pulse w-3/6" />
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
