import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import {
  parseImport,
  SAMPLE_INPUTS,
  type ImportFormat,
  type ImportResult,
} from '../lib/dataImport';
import { fmtNumber } from '../lib/format';

interface Props {
  text: string;
  onTextChange: (text: string) => void;
  onParsed: (result: ImportResult) => void;
}

const FORMAT_LABELS: Record<ImportFormat, string> = {
  json: 'JSON detected',
  tsv: 'TSV / Excel paste',
  csv: 'CSV detected',
  unknown: 'paste or drop data',
};

export function ImportModeInput({ text, onTextChange, onParsed }: Props) {
  const [hover, setHover] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const result = useMemo(() => parseImport(text), [text]);
  const format = result.format;

  useEffect(() => {
    onParsed(result);
  }, [result, onParsed]);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setHover(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      onTextChange(content);
    } catch (err) {
       
      console.error('file read failed', err);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <p className="nb-eyebrow">paste or drop customer data</p>
        <div className="flex items-center gap-3 text-[12px] italic font-serif">
          <button
            type="button"
            onClick={() => onTextChange(SAMPLE_INPUTS.json)}
            className="text-ink-500 hover:text-terracotta transition-colors underline-offset-4 decoration-hairline hover:decoration-terracotta underline"
          >
            sample json →
          </button>
          <button
            type="button"
            onClick={() => onTextChange(SAMPLE_INPUTS.tsv)}
            className="text-ink-500 hover:text-terracotta transition-colors underline-offset-4 decoration-hairline hover:decoration-terracotta underline"
          >
            sample tsv →
          </button>
        </div>
      </div>

      {/* Drop + paste zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={handleDrop}
        className={`relative rounded-2xl border border-dashed transition-colors duration-200 ${
          hover ? 'border-terracotta bg-terracotta-50/50' : 'border-hairline bg-paper-light/40'
        }`}
      >
        <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-paper-light/95 shadow-soft text-[11px] uppercase tracking-[0.18em]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              format === 'unknown' ? 'bg-ink-300' : 'bg-sage'
            }`}
          />
          <span className="text-ink-500">{FORMAT_LABELS[format]}</span>
        </div>

        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={
            'drop a CSV/JSON file here, or paste from your CRM…\n\nWe handle JSON, TSV (Excel paste), and CSV.\nSee the sample links above for the expected schema.'
          }
          rows={10}
          className="w-full resize-y bg-transparent
            text-[14px] leading-snug text-ink
            placeholder:text-ink-300 placeholder:italic
            font-mono
            outline-none
            border-0
            p-5
            min-h-[200px]"
          aria-label="Paste customer data"
          spellCheck={false}
        />
      </div>

      {/* Match summary */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 text-[12px] text-ink-500">
          {text.trim() ? (
            <>
              <span className="nb-eyebrow text-[10px]">parsed</span>
              <span className="font-serif italic">
                {result.matched.length} field{result.matched.length === 1 ? '' : 's'} matched
                {Object.keys(result.unknown).length > 0
                  ? `, ${Object.keys(result.unknown).length} unrecognised`
                  : ''}
              </span>
            </>
          ) : (
            <span className="font-serif italic text-ink-400">empty — paste data above to begin.</span>
          )}
        </div>
        {(result.matched.length > 0 || Object.keys(result.unknown).length > 0) && (
          <button
            type="button"
            onClick={() => setShowPreview((s) => !s)}
            className="text-[12px] italic font-serif text-ink-500 hover:text-terracotta transition-colors underline-offset-4 decoration-hairline hover:decoration-terracotta underline"
          >
            {showPreview ? 'hide details' : 'show details'} →
          </button>
        )}
      </div>

      {/* Parsed-fields preview */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border border-hairline rounded-xl p-4 bg-paper-light/60 space-y-3">
              {result.matched.length > 0 ? (
                <div>
                  <p className="nb-eyebrow text-[10px] mb-2">matched</p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                    {result.matched.map((k) => (
                      <li key={k} className="flex items-baseline gap-2">
                        <span className="w-1 h-1 rounded-full bg-sage shrink-0" />
                        <span className="text-ink-700 truncate">{k}</span>
                        <span className="flex-1 border-b border-dotted border-hairline mb-1" />
                        <span className="font-serif italic text-ink truncate">
                          {humanValue(k, result)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {Object.keys(result.unknown).length > 0 && (
                <div>
                  <p className="nb-eyebrow text-[10px] mb-2 text-terracotta-dark">
                    unrecognised — will be ignored
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                    {Object.entries(result.unknown).map(([k, v]) => (
                      <li key={k} className="flex items-baseline gap-2 text-ink-400">
                        <span>{k}</span>
                        <span className="flex-1 border-b border-dotted border-hairline mb-1" />
                        <span className="italic font-serif truncate">{String(v)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.error && (
                <p className="text-[12px] italic font-serif text-terracotta">
                  Couldn't parse: {result.error}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- value formatter ---------------- */

function humanValue(schemaKey: string, result: ImportResult): string {
  const f = result.fields;
  switch (schemaKey) {
    case 'energy_demand_wh':
    case 'energy_demand_kwh':
      return f.energyDemandKwh ? `${fmtNumber(f.energyDemandKwh)} kWh` : '—';
    case 'energy_price_per_wh':
    case 'energy_price_per_kwh':
      return f.energyPricePerKwh ? `€${f.energyPricePerKwh.toFixed(2)}/kWh` : '—';
    case 'energy_price_increase':
      return f.energyPriceIncreasePct ? `${f.energyPriceIncreasePct}%/yr` : '—';
    case 'energy_price_with_flexible_tariff':
      return f.energyPriceFlexibleTariff ? 'flex tariff' : 'fixed';
    case 'base_price_per_month':
      return f.basePricePerMonth ? `€${f.basePricePerMonth}/mo` : '—';
    case 'base_price_increase':
      return f.basePriceIncreasePct ? `${f.basePriceIncreasePct}%/yr` : '—';
    case 'load_profile':
      return f.loadProfile ?? '—';
    case 'num_inhabitants':
      return f.numInhabitants ? `${f.numInhabitants} people` : '—';
    case 'has_ev':
      return f.hasEv ? 'yes' : 'no';
    case 'ev_annual_drive_distance_km':
      return f.evAnnualKm ? `${fmtNumber(f.evAnnualKm)} km/yr` : '—';
    case 'has_solar':
      return f.hasSolar ? 'yes' : 'no';
    case 'solar_size_kw':
      return f.solarSizeKw ? `${f.solarSizeKw} kW` : '—';
    case 'solar_built_year':
      return f.solarBuiltYear ? String(f.solarBuiltYear) : '—';
    case 'has_storage':
      return f.hasStorage ? 'yes' : 'no';
    case 'storage_size_kwh':
      return f.storageSizeKwh ? `${f.storageSizeKwh} kWh` : '—';
    case 'has_wallbox':
    case 'has_wallboxwall':
      return f.hasWallbox ? 'yes' : 'no';
    case 'wallbox_charge_speed_kw':
    case 'box_charge_speed_kw':
      return f.wallboxChargeSpeedKw ? `${f.wallboxChargeSpeedKw} kW` : '—';
    case 'project_id':
      return f.projectId ?? '—';
    case 'customer_name':
      return f.customerName ?? '—';
    case 'customer_email':
      return f.customerEmail ?? '—';
    case 'customer_contact_id':
      return f.customerContactId ?? '—';
    case 'country':
      return f.country ?? '—';
    default:
      return '—';
  }
}
