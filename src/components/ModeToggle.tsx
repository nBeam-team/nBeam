import { motion } from 'framer-motion';

export type Mode = 'import' | 'describe' | 'guided';

interface Props {
  value: Mode;
  onChange: (m: Mode) => void;
}

export function ModeToggle({ value, onChange }: Props) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <p className="nb-eyebrow">choose how to begin</p>
        <p className="text-[12px] italic font-serif text-ink-400">
          tap any card — switch any time
        </p>
      </div>

      <div role="radiogroup" aria-label="Input mode" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ModeCard
          active={value === 'import'}
          onClick={() => onChange('import')}
          icon={<UploadIcon />}
          title="Paste customer data"
          desc="Drop JSON, CSV, or Excel paste."
          badge="fastest"
        />
        <ModeCard
          active={value === 'describe'}
          onClick={() => onChange('describe')}
          icon={<PenIcon />}
          title="Describe in words"
          desc="Type a free-form summary."
        />
        <ModeCard
          active={value === 'guided'}
          onClick={() => onChange('guided')}
          icon={<SlidersIcon />}
          title="Step by step"
          desc="Move sliders manually."
        />
      </div>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  desc,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`group relative text-left rounded-2xl px-5 py-5
        transition-all duration-200 ease-standard
        ${
          active
            ? 'bg-ink text-paper-light shadow-card'
            : 'bg-paper-light/60 border border-hairline text-ink hover:border-ink-700 hover:-translate-y-0.5'
        }`}
    >
      <span
        className={`absolute top-4 right-4 w-5 h-5 rounded-full border transition-all duration-200 ${
          active ? 'border-paper-light bg-paper-light' : 'border-ink-300 bg-transparent group-hover:border-ink-700'
        }`}
        aria-hidden
      >
        {active ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-terracotta" />
          </motion.span>
        ) : null}
      </span>

      {badge && !active ? (
        <span className="absolute top-4 right-12 inline-flex items-center px-1.5 py-0.5 rounded-full bg-terracotta-50 text-terracotta-dark text-[9px] font-medium uppercase tracking-[0.18em]">
          {badge}
        </span>
      ) : null}

      <div className={`mb-3 ${active ? 'text-paper-light' : 'text-ink-700'}`}>{icon}</div>
      <p className="font-serif text-[18px] italic leading-tight">{title}</p>
      <p
        className={`mt-1.5 text-[12px] leading-snug ${
          active ? 'text-paper-light/70' : 'text-ink-500'
        }`}
      >
        {desc}
      </p>
    </button>
  );
}

function PenIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14.5 4.5 19.5 9.5M3 21l6-1 11.5-11.5a2.12 2.12 0 0 0-3-3L6 17l-3 4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function SlidersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6h10M20 6h-2M4 12h6M20 12h-6M4 18h12M20 18h-2"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <circle cx="14" cy="18" r="2.2" stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 16V4m0 0-4 4m4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
