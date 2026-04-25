import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { AddressInput } from '../components/AddressInput';
import { ImportModeInput } from '../components/ImportModeInput';
import { ModeToggle, type Mode } from '../components/ModeToggle';
import { RegionalIntel } from '../components/RegionalIntel';
import { Slider } from '../components/Slider';
import { SolarStrip } from '../components/SolarStrip';
import { SunMark } from '../components/SunMark';
import { PrimaryCta, TextModeBody } from '../components/TextModeInput';
import { geocodeAddress, type Address } from '../lib/google';
import { fmtEur, fmtNumber } from '../lib/format';
import type { ImportResult } from '../lib/dataImport';
import { DEFAULT_PARTIAL, type ParsedInputs } from '../lib/parse';
import { makeProjectId, type City, type FormInputs } from '../lib/types';

interface SlidersValues {
  energyDemandKwh: number;
  budgetEur: number;
  energyPricePerKwh: number;
  hasEv: boolean;
  evAnnualKm: number;
}

interface Props {
  initial?: FormInputs;
  initialText?: string;
  initialMode?: Mode;
  onSubmit: (inputs: FormInputs, mode: Mode, text?: string) => void;
}

export function InputForm({ initial, initialText = '', initialMode = 'import', onSubmit }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [address, setAddress] = useState<Address | null>(initial?.address ?? null);
  const [customerName, setCustomerName] = useState<string>(initial?.customerName ?? '');
  const [text, setText] = useState<string>(initialText);
  const [describeParsed, setDescribeParsed] = useState<ParsedInputs>({});
  const [importText, setImportText] = useState<string>('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [sliders, setSliders] = useState<SlidersValues>({
    energyDemandKwh: initial?.energyDemandKwh ?? DEFAULT_PARTIAL.energyDemandKwh,
    budgetEur: initial?.budgetEur ?? DEFAULT_PARTIAL.budgetEur,
    energyPricePerKwh: initial?.energyPricePerKwh ?? DEFAULT_PARTIAL.energyPricePerKwh,
    hasEv: initial?.hasEv ?? DEFAULT_PARTIAL.hasEv,
    evAnnualKm: initial?.evAnnualKm ?? DEFAULT_PARTIAL.evAnnualKm,
  });

  // Stable project id + request timestamp for the lifetime of this form session.
  const [projectId] = useState(() => initial?.projectId ?? makeProjectId());
  const [requestCreatedAt] = useState(() => initial?.requestCreatedAt ?? new Date().toISOString());

  // Loading flags surfaced as inline spinners on the name + address fields.
  const [aiLoading, setAiLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // Track the last AI-extracted strings we acted on so we don't keep
  // re-applying them after the user clears or edits the field.
  const lastAiNameRef = useRef<string | null>(null);
  const lastAiAddressRef = useRef<string | null>(null);

  // Auto-fill the customer-name field from describe-mode extraction.
  useEffect(() => {
    const aiName = describeParsed.customerName?.trim();
    if (!aiName) return;
    if (aiName === lastAiNameRef.current) return;
    if (customerName.trim()) return;
    lastAiNameRef.current = aiName;
    setCustomerName(aiName);
  }, [describeParsed.customerName, customerName]);

  // Auto-fill the address field by geocoding the AI-extracted address string.
  useEffect(() => {
    const aiAddress = describeParsed.customerAddress?.trim();
    if (!aiAddress) return;
    if (aiAddress === lastAiAddressRef.current) return;
    if (address) return;
    lastAiAddressRef.current = aiAddress;
    let cancelled = false;
    setGeocoding(true);
    geocodeAddress(aiAddress)
      .then((resolved) => {
        if (cancelled) return;
        if (resolved) setAddress(resolved);
      })
      .finally(() => {
        if (!cancelled) setGeocoding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [describeParsed.customerAddress, address]);

  // Snapshot city: prefer the picked address, otherwise the AI/regex parse.
  const snapshotCity =
    (address?.city ??
      importResult?.fields?.country ??
      describeParsed.city ??
      null) as City | null;

  const canSubmit = address !== null;

  const handleSubmit = () => {
    if (!address) return;

    // Pull values from whichever mode is active; defaults fill the rest.
    const importedFields = importResult?.fields ?? {};
    const fromMode =
      mode === 'describe'
        ? describeParsed
        : mode === 'import'
          ? importedFields
          : sliders;

    const final: FormInputs = {
      // meta
      projectId: importedFields.projectId ?? projectId,
      customerContactId: importedFields.customerContactId,
      requestCreatedAt: importedFields.requestCreatedAt ?? requestCreatedAt,
      offerCreatedAt: new Date().toISOString(),

      // Customer: the dedicated input wins over imported value when filled.
      customerName: customerName.trim() || importedFields.customerName,
      customerEmail: importedFields.customerEmail,
      customerPhone: importedFields.customerPhone,

      // location
      address,
      country: importedFields.country ?? address.countryCode,

      // energy
      energyDemandKwh: fromMode.energyDemandKwh ?? DEFAULT_PARTIAL.energyDemandKwh,
      energyPricePerKwh: fromMode.energyPricePerKwh ?? DEFAULT_PARTIAL.energyPricePerKwh,
      energyPriceIncreasePct:
        importedFields.energyPriceIncreasePct ?? DEFAULT_PARTIAL.energyPriceIncreasePct,
      energyPriceFlexibleTariff:
        importedFields.energyPriceFlexibleTariff ?? DEFAULT_PARTIAL.energyPriceFlexibleTariff,
      basePricePerMonth: importedFields.basePricePerMonth ?? DEFAULT_PARTIAL.basePricePerMonth,
      basePriceIncreasePct: importedFields.basePriceIncreasePct ?? DEFAULT_PARTIAL.basePriceIncreasePct,
      loadProfile: importedFields.loadProfile ?? DEFAULT_PARTIAL.loadProfile,
      loadProfileEditorId: importedFields.loadProfileEditorId,

      // household
      numInhabitants: importedFields.numInhabitants ?? describeParsed.numInhabitants,

      // existing solar
      hasSolar: importedFields.hasSolar ?? describeParsed.hasSolar ?? DEFAULT_PARTIAL.hasSolar,
      solarSizeKw: importedFields.solarSizeKw,
      solarAngleDeg: importedFields.solarAngleDeg,
      solarOrientationDeg: importedFields.solarOrientationDeg,
      solarBuiltYear: importedFields.solarBuiltYear,
      solarFeedInPerKwh: importedFields.solarFeedInPerKwh,
      solarFeedInPostEegPerKwh: importedFields.solarFeedInPostEegPerKwh,

      // existing storage
      hasStorage:
        importedFields.hasStorage ?? describeParsed.hasStorage ?? DEFAULT_PARTIAL.hasStorage,
      storageSizeKwh: importedFields.storageSizeKwh,
      storageBuiltYear: importedFields.storageBuiltYear,

      // existing wallbox
      hasWallbox:
        importedFields.hasWallbox ?? describeParsed.hasWallbox ?? DEFAULT_PARTIAL.hasWallbox,
      wallboxChargeSpeedKw: importedFields.wallboxChargeSpeedKw,

      // EV
      hasEv: fromMode.hasEv ?? DEFAULT_PARTIAL.hasEv,
      evAnnualKm: fromMode.evAnnualKm ?? DEFAULT_PARTIAL.evAnnualKm,

      budgetEur: importedFields.budgetEur ?? sliders.budgetEur ?? DEFAULT_PARTIAL.budgetEur,
    };
    onSubmit(final, mode, text);
  };

  return (
    <main className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[560px] bg-paper-glow pointer-events-none" />

      <div
        aria-hidden
        className="hidden md:block absolute -top-24 -right-24 -z-10 pointer-events-none select-none"
      >
        <SunMark size={420} />
      </div>

      <div className="max-w-[920px] mx-auto px-6 md:px-10 pt-10 md:pt-20 pb-24">
        <div aria-hidden className="md:hidden flex justify-end -mt-2 mb-4">
          <SunMark size={140} />
        </div>

        {/* Hero — installer framing */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mb-10 md:mb-14 max-w-2xl relative"
        >
          <div className="flex items-baseline justify-between mb-5">
            <p className="nb-eyebrow">new proposal</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400 tabular-nums">
              {projectId}
            </p>
          </div>
          <h1 className="font-serif text-[44px] md:text-[60px] leading-[0.96] tracking-tightest text-ink">
            Build a solar quote in{' '}
            <span className="italic text-terracotta">minutes</span>.
          </h1>
          <p className="mt-5 text-[16px] md:text-[17px] text-ink-500 max-w-xl leading-relaxed">
            Drop your customer's data, pick their address, and we'll size a system, price it, and
            generate a proposal — backed by Google Solar API geometry and live regional pricing.
          </p>
          <div className="mt-8 max-w-md">
            <SolarStrip count={9} />
          </div>
        </motion.div>

        {/* Customer name + Address */}
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="nb-customer" className="nb-eyebrow">
              customer name
            </label>
            <div className="relative">
              <input
                id="nb-customer"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="who is this for?"
                className="w-full bg-transparent
                  text-[18px] leading-snug text-ink
                  placeholder:text-ink-300 placeholder:italic
                  font-serif
                  outline-none
                  border-0 border-b border-hairline
                  pt-3 pb-3 pr-8
                  focus:border-ink transition-colors duration-200"
              />
              {mode === 'describe' && aiLoading && !customerName.trim() ? (
                <span
                  aria-label="extracting customer name"
                  className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center"
                >
                  <FormSpinner />
                </span>
              ) : null}
            </div>
            <p className="nb-helper">
              {mode === 'describe' && aiLoading && !customerName.trim()
                ? 'gemini is reading your description…'
                : 'appears on the proposal — optional but recommended.'}
            </p>
          </div>
          <AddressInput
            value={address}
            onChange={setAddress}
            loading={mode === 'describe' && (aiLoading || geocoding) && !address}
          />
        </motion.section>

        {/* Mode toggle */}
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-10"
        >
          <ModeToggle value={mode} onChange={setMode} />
        </motion.section>

        {/* Mode content */}
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.14 }}
          className="relative"
        >
          <AnimatePresence mode="wait">
            {mode === 'import' ? (
              <motion.div
                key="import"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25 }}
              >
                <ImportModeInput
                  text={importText}
                  onTextChange={setImportText}
                  onParsed={setImportResult}
                />
              </motion.div>
            ) : mode === 'describe' ? (
              <motion.div
                key="describe"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25 }}
              >
                <TextModeBody
                  text={text}
                  onTextChange={setText}
                  onParsed={setDescribeParsed}
                  onAiLoadingChange={setAiLoading}
                />
              </motion.div>
            ) : (
              <motion.div
                key="guided"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
              >
                <GuidedForm value={sliders} onChange={setSliders} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* Submit row */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-ink-500 italic font-serif max-w-xs leading-snug">
            {address
              ? "we'll find this roof on satellite next →"
              : 'pick the customer address above to continue.'}
          </p>
          <PrimaryCta disabled={!canSubmit} onClick={handleSubmit}>
            Find the roof
          </PrimaryCta>
        </div>

        <div className="mt-10">
          <RegionalIntel city={snapshotCity} />
        </div>
      </div>
    </main>
  );
}

/* ---------------- guided sliders ---------------- */

function GuidedForm({
  value,
  onChange,
}: {
  value: SlidersValues;
  onChange: (v: SlidersValues) => void;
}) {
  const update = <K extends keyof SlidersValues>(key: K, v: SlidersValues[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="divide-y divide-hairline">
      <Slider
        label="Annual electricity"
        helper="From the customer's last bill — typical household: 3,000–6,000 kWh."
        min={1000}
        max={15000}
        step={100}
        value={value.energyDemandKwh}
        onChange={(v) => update('energyDemandKwh', v)}
        formatValue={(v) => `${fmtNumber(v)} kWh`}
        formatBound={(v) => `${fmtNumber(v)} kWh`}
        ariaUnit="kilowatt-hours per year"
      />
      <Slider
        label="Budget"
        helper="Typical solar + battery: €10k–€25k. KfW subsidies may apply."
        min={5000}
        max={50000}
        step={500}
        value={value.budgetEur}
        onChange={(v) => update('budgetEur', v)}
        formatValue={(v) => fmtEur(v)}
        ariaUnit="euros"
      />
      <Slider
        label="Customer's kWh price"
        helper="What they pay their utility today. Drives savings."
        min={0.2}
        max={0.7}
        step={0.01}
        value={value.energyPricePerKwh}
        onChange={(v) => update('energyPricePerKwh', v)}
        formatValue={(v) => `€${v.toFixed(2)}`}
        formatBound={(v) => `€${v.toFixed(2)}`}
        ariaUnit="euros per kilowatt-hour"
      />

      <div className="py-5">
        <label className="flex items-center justify-between cursor-pointer select-none">
          <span>
            <span className="nb-label block">Customer drives an EV?</span>
            <span className="nb-helper block mt-0.5">
              We'll size the system to cover their driving too.
            </span>
          </span>
          <span className="relative inline-flex shrink-0">
            <input
              type="checkbox"
              checked={value.hasEv}
              onChange={(e) => update('hasEv', e.target.checked)}
              className="peer sr-only"
            />
            <span
              className="w-12 h-7 rounded-full bg-paper-dark peer-checked:bg-sage
                transition-colors duration-200 ease-standard"
            />
            <span
              className="absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-paper-light shadow-soft
                peer-checked:translate-x-5 transition-transform duration-200 ease-spring"
            />
          </span>
        </label>

        <motion.div
          initial={false}
          animate={{
            height: value.hasEv ? 'auto' : 0,
            opacity: value.hasEv ? 1 : 0,
            marginTop: value.hasEv ? 16 : 0,
          }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="overflow-hidden"
        >
          <div className="border-t border-hairline">
            <Slider
              label="EV mileage"
              helper="≈ 0.18 kWh per km."
              min={0}
              max={30000}
              step={500}
              value={value.evAnnualKm}
              onChange={(v) => update('evAnnualKm', v)}
              formatValue={(v) => `${fmtNumber(v)} km`}
              formatBound={(v) => `${fmtNumber(v)} km`}
              ariaUnit="kilometers per year"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function FormSpinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="animate-spin" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="#E0D3BC" strokeWidth="1.6" fill="none" />
      <path
        d="M8 2a6 6 0 0 1 6 6"
        stroke="#C44A2C"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
