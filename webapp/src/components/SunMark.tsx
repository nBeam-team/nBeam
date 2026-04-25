import { motion } from 'framer-motion';

interface Props {
  size?: number;
  className?: string;
}

/**
 * Decorative sun composition. Concentric rings, 16 rays, a solid disc,
 * with a slow continuous rotation.
 */
export function SunMark({ size = 360, className }: Props) {
  return (
    <div className={className} aria-hidden>
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 360 360"
        fill="none"
        className="block"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1, rotate: [0, 360] }}
        transition={{
          opacity: { duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] },
          scale: { duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] },
          rotate: { duration: 220, repeat: Infinity, ease: 'linear' },
        }}
      >
        <defs>
          <radialGradient id="sun-disc" cx="50%" cy="45%">
            <stop offset="0%" stopColor="#E66A4D" />
            <stop offset="60%" stopColor="#C44A2C" />
            <stop offset="100%" stopColor="#9F3A21" />
          </radialGradient>
          <radialGradient id="sun-glow" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#C44A2C" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#C44A2C" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* outer glow */}
        <circle cx="180" cy="180" r="180" fill="url(#sun-glow)" />

        {/* concentric rings */}
        <circle cx="180" cy="180" r="148" stroke="#C44A2C" strokeWidth="0.6" opacity="0.22" />
        <circle cx="180" cy="180" r="116" stroke="#C44A2C" strokeWidth="0.6" opacity="0.18" />
        <circle cx="180" cy="180" r="90" stroke="#C44A2C" strokeWidth="0.6" opacity="0.14" />

        {/* 16 rays — alternating short/long */}
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i * Math.PI) / 8;
          const long = i % 2 === 0;
          const inner = 78;
          const outer = long ? 152 : 132;
          const x1 = 180 + Math.cos(a) * inner;
          const y1 = 180 + Math.sin(a) * inner;
          const x2 = 180 + Math.cos(a) * outer;
          const y2 = 180 + Math.sin(a) * outer;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#C44A2C"
              strokeWidth={long ? 1.8 : 1.2}
              strokeLinecap="round"
              opacity={long ? 0.85 : 0.55}
            />
          );
        })}

        {/* sun disc */}
        <circle cx="180" cy="180" r="64" fill="url(#sun-disc)" />
        {/* highlight */}
        <circle cx="160" cy="158" r="14" fill="#FFC9B5" opacity="0.55" />
      </motion.svg>
    </div>
  );
}
