interface Props {
  size?: number;
}

export function Logo({ size = 26 }: Props) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="16" cy="16" r="6.2" fill="#C44A2C" />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          const x1 = 16 + Math.cos(a) * 9.5;
          const y1 = 16 + Math.sin(a) * 9.5;
          const x2 = 16 + Math.cos(a) * 13.5;
          const y2 = 16 + Math.sin(a) * 13.5;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#C44A2C"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <span className="font-serif text-[20px] font-medium tracking-tightest text-ink">
        nbeam
      </span>
    </span>
  );
}
