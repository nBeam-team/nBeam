interface Props {
  size?: number;
}

const TEAL = '#2A6D5C';
const GOLD = '#DEA126';

/**
 * 4-petal mark + nBeam wordmark. Opposite quadrants share a colour
 * (teal/gold), and each petal has a rounded outer corner with a curved
 * inner edge that creates a subtle "+" of negative space at the centre.
 */
export function Logo({ size = 30 }: Props) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden="true"
      >
        {/* top-left, teal */}
        <path
          d="M 0 8 Q 0 0 8 0 L 47 0 Q 50 50 0 47 L 0 8 Z"
          fill={TEAL}
        />
        {/* top-right, gold */}
        <path
          d="M 53 0 L 92 0 Q 100 0 100 8 L 100 47 Q 50 50 53 0 Z"
          fill={GOLD}
        />
        {/* bottom-right, teal */}
        <path
          d="M 53 100 L 92 100 Q 100 100 100 92 L 100 53 Q 50 50 53 100 Z"
          fill={TEAL}
        />
        {/* bottom-left, gold */}
        <path
          d="M 0 53 L 0 92 Q 0 100 8 100 L 47 100 Q 50 50 0 53 Z"
          fill={GOLD}
        />
      </svg>
      <span className="font-serif text-[22px] font-semibold tracking-tight text-ink leading-none">
        nBeam
      </span>
    </span>
  );
}
