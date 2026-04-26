import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { NL_EXAMPLE, parseNaturalLanguage, type ParsedInputs } from '../lib/parse';
import { useAiParse } from '../lib/useAiParse';
import { fmtEur, fmtNumber } from '../lib/format';

interface BodyProps {
  text: string;
  onTextChange: (text: string) => void;
  /** Parent uses the merged AI+regex result for downstream submit. */
  onParsed?: (inputs: ParsedInputs) => void;
  /** Notifies the parent when the AI extraction is in flight. */
  onAiLoadingChange?: (loading: boolean) => void;
  /** Bypasses extraction and loads a static demo. */
  onTryExample?: () => void;
}

export function TextModeBody({ text, onTextChange, onParsed, onAiLoadingChange, onTryExample }: BodyProps) {
  const regex = useMemo(() => parseNaturalLanguage(text), [text]);
  const ai = useAiParse(text);

  // Once the AI extraction returns, its fields take precedence over regex.
  const merged = useMemo<ParsedInputs>(
    () => ({ ...regex.inputs, ...(ai.data ?? {}) }),
    [regex.inputs, ai.data],
  );

  useEffect(() => {
    if (onParsed) onParsed(merged);
  }, [merged, onParsed]);

  useEffect(() => {
    if (onAiLoadingChange) onAiLoadingChange(ai.loading);
  }, [ai.loading, onAiLoadingChange]);

  const chips = buildChips(merged);
  const totalKnown = chips.length;
  const empty = text.trim().length === 0;
  const sourceLabel = ai.loading
    ? 'gemini reading…'
    : ai.data
      ? ai.stale
        ? 'gemini · stale'
        : 'gemini · live'
      : ai.error
        ? 'pattern match'
        : 'pattern match';
  const aiState: 'idle' | 'loading' | 'live' | 'fallback' = ai.loading
    ? 'loading'
    : ai.data
      ? 'live'
      : ai.error
        ? 'fallback'
        : 'idle';
  const buttonDisabled = empty || ai.loading;
  const buttonLabel = ai.loading
    ? 'extracting…'
    : ai.data
      ? ai.stale
        ? 're-extract with gemini'
        : 'extracted ✓'
      : 'extract with gemini';

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div className="flex items-baseline gap-2">
          <p className="nb-eyebrow">describe the customer</p>
          <AiPill state={aiState} />
        </div>
        <button
          type="button"
          onClick={() => {
            if (onTryExample) onTryExample();
            else onTextChange(NL_EXAMPLE);
          }}
          className="text-[12px] italic font-serif text-ink-500 hover:text-terracotta transition-colors underline-offset-4 decoration-hairline hover:decoration-terracotta underline"
        >
          try an example →
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={NL_EXAMPLE}
        rows={6}
        className="w-full resize-none bg-transparent
          text-[18px] leading-[1.55] text-ink
          placeholder:text-ink-300 placeholder:italic
          font-serif
          outline-none
          border-0 border-b border-hairline
          pt-3 pb-4
          focus:border-ink transition-colors duration-200"
        aria-label="Describe the customer in your own words"
      />

      {/* Manual extraction trigger */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={ai.trigger}
          disabled={buttonDisabled}
          className="group inline-flex items-center gap-2 pl-3 pr-4 h-9 rounded-full
            bg-terracotta text-paper-light text-[13px] font-medium
            transition-all duration-200 ease-standard
            hover:bg-terracotta-dark hover:-translate-y-0.5
            active:translate-y-0
            disabled:bg-ink-300 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          <span className="inline-flex items-center justify-center w-5 h-5">
            {ai.loading ? <ButtonSpinner /> : <SparkleIcon />}
          </span>
          <span className="font-serif italic">{buttonLabel}</span>
        </button>
        <p className="text-[11px] italic font-serif text-ink-400 max-w-sm leading-snug">
          {empty
            ? 'type or paste a description, then click to extract.'
            : ai.loading
              ? 'reading your description with Gemini…'
              : ai.stale
                ? "you've edited the text — re-extract for updated fields."
                : ai.data
                  ? 'fields extracted. edit the text to update, or move on.'
                  : 'pattern matching is running locally for free; click for AI extraction.'}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 min-h-[28px]">
        <div className="flex flex-wrap gap-1.5 items-center">
          <AnimatePresence mode="popLayout">
            {chips.map((c) => (
              <motion.span
                key={c.key + c.label}
                layout
                initial={{ opacity: 0, y: 4, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                  bg-sage-50 text-sage-dark text-[12px] font-medium tracking-wide"
              >
                <span className="w-1 h-1 rounded-full bg-sage" />
                {c.label}
              </motion.span>
            ))}
            {!empty && totalKnown === 0 && !ai.loading ? (
              <motion.span
                key="missing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[12px] italic text-ink-400 ml-1"
              >
                nothing extracted yet — using sensible defaults
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
        <span className="text-[11px] uppercase tracking-[0.18em] text-ink-400 shrink-0">
          {sourceLabel} · {totalKnown}
        </span>
      </div>

      {/* Transparency footer */}
      <p className="text-[11px] italic font-serif text-ink-400 leading-relaxed">
        This text is sent to Google Gemini to extract structured fields. We don't store it.
        Pattern-matching runs locally as an instant fallback.
      </p>
    </div>
  );
}

function buildChips(merged: ParsedInputs): { key: keyof ParsedInputs; label: string }[] {
  const chips: { key: keyof ParsedInputs; label: string }[] = [];
  if (merged.customerName) chips.push({ key: 'customerName', label: merged.customerName });
  if (merged.city) chips.push({ key: 'city', label: merged.city });
  if (merged.energyDemandKwh)
    chips.push({ key: 'energyDemandKwh', label: `${fmtNumber(merged.energyDemandKwh)} kWh/yr` });
  if (merged.budgetEur) chips.push({ key: 'budgetEur', label: fmtEur(merged.budgetEur) });
  if (merged.energyPricePerKwh)
    chips.push({ key: 'energyPricePerKwh', label: `€${merged.energyPricePerKwh.toFixed(2)}/kWh` });
  if (merged.numInhabitants)
    chips.push({ key: 'numInhabitants', label: `${merged.numInhabitants} people` });
  if (merged.hasEv === true)
    chips.push({
      key: 'hasEv',
      label: merged.evAnnualKm
        ? `EV · ${fmtNumber(merged.evAnnualKm)} km/yr`
        : 'has EV',
    });
  else if (merged.hasEv === false) chips.push({ key: 'hasEv', label: 'no EV' });
  if (merged.hasSolar) chips.push({ key: 'hasSolar', label: 'existing solar' });
  if (merged.hasStorage) chips.push({ key: 'hasStorage', label: 'existing battery' });
  if (merged.hasWallbox) chips.push({ key: 'hasWallbox', label: 'existing wallbox' });
  return chips;
}

/* ---------------- AI status pill ---------------- */

function AiPill({ state }: { state: 'idle' | 'loading' | 'live' | 'fallback' }) {
  const dotClass =
    state === 'loading'
      ? 'bg-terracotta animate-pulse'
      : state === 'live'
        ? 'bg-sage'
        : state === 'fallback'
          ? 'bg-ink-300'
          : 'bg-terracotta';
  const label =
    state === 'loading'
      ? 'gemini reading…'
      : state === 'live'
        ? 'gemini · live'
        : state === 'fallback'
          ? 'pattern match · ai unavailable'
          : 'ai-powered';
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-500">
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}

/* ---------------- Primary CTA (still shared) ---------------- */

interface CtaProps {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export function PrimaryCta({ disabled, onClick, children }: CtaProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative inline-flex items-center gap-3 pl-5 pr-2 h-[44px]
        rounded-full bg-ink text-paper-light
        text-[14px] font-medium tracking-wide
        transition-all duration-300 ease-standard
        hover:-translate-y-0.5 hover:bg-terracotta
        active:translate-y-0
        disabled:bg-ink-300 disabled:text-paper-light disabled:cursor-not-allowed
        disabled:hover:translate-y-0 disabled:hover:bg-ink-300"
    >
      <span className="font-serif italic">{children}</span>
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-paper-light text-ink transition-transform duration-300 ease-spring group-hover:translate-x-0.5 group-disabled:bg-paper">
        <ArrowRightIcon />
      </span>
    </button>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2.5 7h9m0 0L7.5 3m4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.5v2.5M8 12v2.5M14.5 8H12M4 8H1.5M12.6 3.4l-1.8 1.8M5.2 10.8l-1.8 1.8M12.6 12.6l-1.8-1.8M5.2 5.2 3.4 3.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}

function ButtonSpinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" className="animate-spin" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" fill="none" opacity="0.3" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
