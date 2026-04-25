import { useId } from 'react';

interface Props {
  label: string;
  helper?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  formatValue: (v: number) => string;
  formatBound?: (v: number) => string;
  ariaUnit?: string;
}

export function Slider({
  label,
  helper,
  min,
  max,
  step = 1,
  value,
  onChange,
  formatValue,
  formatBound,
  ariaUnit,
}: Props) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  const fmtBound = formatBound ?? formatValue;

  return (
    <div className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="nb-label">
          {label}
        </label>
        <span
          className="font-serif text-[22px] leading-none text-ink tabular-nums tracking-tight"
          aria-live="polite"
        >
          {formatValue(value)}
        </span>
      </div>

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="nb-slider"
        style={{
          background: `linear-gradient(90deg, #1A1410 0%, #1A1410 ${pct}%, #E0D3BC ${pct}%, #E0D3BC 100%)`,
        }}
        aria-label={`${label}${ariaUnit ? ` in ${ariaUnit}` : ''}, range ${min} to ${max}`}
      />

      <div className="flex items-center justify-between text-[11px] text-ink-400 tabular-nums">
        <span>{fmtBound(min)}</span>
        <span>{fmtBound(max)}</span>
      </div>

      {helper ? <p className="nb-helper mt-1">{helper}</p> : null}
    </div>
  );
}
