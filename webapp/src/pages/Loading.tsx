import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

const PHASES = [
  'reading your home',
  'sizing solar',
  'optimizing battery',
  'shaping savings',
];

interface Props {
  onDone: () => void;
}

const TOTAL_MS = 2400;

export function Loading({ onDone }: Props) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const ratio = Math.min(1, elapsed / TOTAL_MS);
      setProgress(ratio);
      const idx = Math.min(PHASES.length - 1, Math.floor(elapsed / (TOTAL_MS / PHASES.length)));
      setPhase(idx);
      if (ratio < 1) raf = requestAnimationFrame(tick);
      else setTimeout(onDone, 280);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <main className="relative min-h-[70vh] flex items-center justify-center px-6">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[480px] bg-paper-glow pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[440px]"
        role="status"
        aria-live="polite"
      >
        {/* Sun arc spinner */}
        <div className="flex justify-center mb-10">
          <Spinner />
        </div>

        <p className="text-center text-[11px] uppercase tracking-[0.18em] text-ink-400 mb-3">
          designing
        </p>

        <div className="text-center font-serif text-[28px] md:text-[34px] leading-tight italic text-ink min-h-[44px]">
          <AnimatePresence mode="wait">
            <motion.span
              key={phase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="inline-block"
            >
              {PHASES[phase]}…
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="mt-12">
          <div className="relative h-px w-full bg-hairline overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-terracotta transition-[width] duration-100 linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className="mt-3 text-center text-[11px] tabular-nums uppercase tracking-[0.18em] text-ink-400">
            {Math.round(progress * 100)}%
          </p>
        </div>
      </motion.div>
    </main>
  );
}

function Spinner() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      className="animate-[spin_1.6s_linear_infinite]"
      aria-hidden
    >
      <circle cx="28" cy="28" r="22" stroke="#E0D3BC" strokeWidth="2" fill="none" />
      <path
        d="M28 6a22 22 0 0 1 22 22"
        stroke="#C44A2C"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
