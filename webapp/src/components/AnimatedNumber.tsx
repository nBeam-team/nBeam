import { useCountUp } from '../lib/useCountUp';

interface Props {
  value: number;
  decimals?: number;
  duration?: number;
  delay?: number;
  prefix?: string;
  suffix?: string;
  thousands?: boolean;
  className?: string;
}

export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 900,
  delay = 0,
  prefix,
  suffix,
  thousands = true,
  className,
}: Props) {
  const animated = useCountUp(value, { duration, delay, decimals });
  const display = thousands
    ? animated.toLocaleString('en-DE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : animated.toFixed(decimals);
  return (
    <span className={`tabular-nums ${className ?? ''}`}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
