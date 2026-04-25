import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  subtext?: string;
  accent?: 'terracotta' | 'sage' | 'plum' | 'ink';
  delay?: number;
}

const ACCENT_DOT: Record<NonNullable<Props['accent']>, string> = {
  terracotta: 'bg-terracotta',
  sage: 'bg-sage',
  plum: 'bg-plum',
  ink: 'bg-ink',
};

export function SpecCard({ icon, label, value, subtext, accent = 'terracotta', delay = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative bg-paper-light/60 backdrop-blur-sm border border-hairline rounded-xl p-5
        transition-all duration-300 ease-standard cursor-default
        hover:bg-paper-light hover:border-ink-300 hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1 h-1 rounded-full ${ACCENT_DOT[accent]}`} />
        <p className="nb-eyebrow text-[10px]">{label}</p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="font-serif text-[28px] leading-none text-ink tracking-tight">{value}</p>
        <span className="opacity-60 group-hover:opacity-100 transition-opacity">{icon}</span>
      </div>
      {subtext ? <p className="text-[11px] text-ink-400 mt-2 italic">{subtext}</p> : null}
    </motion.div>
  );
}
