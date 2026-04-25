import { useEffect, useRef, useState } from 'react';

interface Options {
  duration?: number;
  delay?: number;
  decimals?: number;
}

// Animates a number from 0 → target over `duration` ms with ease-out cubic.
export function useCountUp(target: number, options: Options = {}) {
  const { duration = 900, delay = 0, decimals = 0 } = options;
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastTargetRef = useRef<number>(target);

  useEffect(() => {
    const fromValue = lastTargetRef.current === target ? 0 : value;
    const distance = target - fromValue;
    if (Math.abs(distance) < 0.0001) {
      setValue(target);
      return;
    }
    lastTargetRef.current = target;
    startRef.current = null;

    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts + delay;
      const elapsed = ts - startRef.current;
      if (elapsed < 0) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = fromValue + distance * eased;
      setValue(next);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, delay]);

  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
