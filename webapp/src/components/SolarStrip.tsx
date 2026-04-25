/**
 * Decorative row of stylized solar panels, used as a horizontal ornament.
 */
export function SolarStrip({ count = 8 }: { count?: number }) {
  return (
    <svg
      viewBox={`0 0 ${count * 64} 56`}
      className="w-full h-10 opacity-60"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => {
        const x = i * 64 + 8;
        return (
          <g key={i} transform={`translate(${x} 8) skewX(-12)`}>
            <rect width="48" height="38" rx="2" fill="#1A1410" opacity="0.06" stroke="#1A1410" strokeOpacity="0.45" strokeWidth="0.7" />
            {Array.from({ length: 3 }).map((_, r) => (
              <line
                key={`r${r}`}
                x1="0"
                y1={(r + 1) * 9.5}
                x2="48"
                y2={(r + 1) * 9.5}
                stroke="#1A1410"
                strokeOpacity="0.35"
                strokeWidth="0.5"
              />
            ))}
            {Array.from({ length: 3 }).map((_, c) => (
              <line
                key={`c${c}`}
                x1={(c + 1) * 12}
                y1="0"
                x2={(c + 1) * 12}
                y2="38"
                stroke="#1A1410"
                strokeOpacity="0.35"
                strokeWidth="0.5"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
