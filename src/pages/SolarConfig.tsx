import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { RegionalSnapshot } from '../components/RegionalSnapshot';
import { Slider } from '../components/Slider';
import { PrimaryCta } from '../components/TextModeInput';
import { SolarMap } from '../components/SolarMap';
import {
  fetchBuildingInsights,
  fetchDataLayers,
  type BuildingInsights,
  type DataLayers,
} from '../lib/google';
import { fmtEur, fmtNumber } from '../lib/format';
import { defaultConfigForBuilding, design as designSystem } from '../lib/calc';
import type { City, FormInputs, SolarConfigInputs, SystemDesign } from '../lib/types';

interface Props {
  inputs: FormInputs;
  initial?: { config: SolarConfigInputs; insights: BuildingInsights | null } | null;
  onContinue: (design: SystemDesign, insights: BuildingInsights | null) => void;
  onBack: () => void;
}

const PANEL_WATTAGE_OPTIONS = [350, 400, 440] as const;

export function SolarConfig({ inputs, initial, onContinue, onBack }: Props) {
  const { lat, lng, formatted } = inputs.address;
  const [insights, setInsights] = useState<BuildingInsights | null>(initial?.insights ?? null);
  const [loading, setLoading] = useState(!insights);
  const [error, setError] = useState<string | null>(null);
  const [dataLayers, setDataLayers] = useState<DataLayers | null>(null);
  const [showFlux, setShowFlux] = useState(false);

  // Editable state. Restored from `initial` when returning to this screen.
  const [config, setConfig] = useState<SolarConfigInputs>(
    initial?.config ?? defaultConfigForBuilding(insights, inputs),
  );
  // Subset of FormInputs that the user can adjust on this screen.
  const [liveInputs, setLiveInputs] = useState<FormInputs>(inputs);

  useEffect(() => {
    if (insights) return;
    let cancelled = false;
    setLoading(true);
    fetchBuildingInsights(lat, lng)
      .then((data) => {
        if (cancelled) return;
        setInsights(data);
        setConfig(defaultConfigForBuilding(data, inputs));
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  // Fetch data layers in parallel with insights so the heatmap is ready
  // immediately when the user toggles it.
  useEffect(() => {
    let cancelled = false;
    fetchDataLayers(lat, lng, 50)
      .then((d) => {
        if (!cancelled) setDataLayers(d);
      })
      .catch(() => {
        // Data layers may not be available for every building.
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  const sp = insights?.solarPotential;
  const maxPanels = sp?.solarPanelConfigs?.length
    ? sp.solarPanelConfigs[sp.solarPanelConfigs.length - 1].panelsCount
    : sp?.solarPanels?.length ?? 12;

  // Peak annual sunshine across the roof's segments.
  const maxSunHours = useMemo(() => {
    if (!sp) return 0;
    const q = sp.wholeRoofStats?.sunshineQuantiles;
    return q && q.length ? Math.round(q[q.length - 1]) : 0;
  }, [sp]);

  const liveDesign = useMemo(
    () => designSystem(liveInputs, config, insights),
    [liveInputs, config, insights],
  );

  const updateConfig = <K extends keyof SolarConfigInputs>(key: K, v: SolarConfigInputs[K]) =>
    setConfig((c) => ({ ...c, [key]: v }));

  const updateInputs = <K extends keyof FormInputs>(key: K, v: FormInputs[K]) =>
    setLiveInputs((i) => ({ ...i, [key]: v }));

  return (
    <main className="relative pb-24">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[280px] bg-paper-glow pointer-events-none" />

      <div className="max-w-[1280px] mx-auto px-6 md:px-10 pt-6 md:pt-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 md:mb-8 flex flex-wrap items-baseline justify-between gap-4"
        >
          <div className="min-w-0">
            <div className="flex items-baseline gap-3 mb-2">
              <p className="nb-eyebrow text-sage-dark">step two · the roof</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-400 tabular-nums">
                {inputs.projectId}
              </p>
            </div>
            <h1 className="font-serif text-[28px] md:text-[40px] leading-tight tracking-tightest text-ink truncate max-w-[60ch]">
              {formatted}
            </h1>
            {inputs.customerName ? (
              <p className="text-[13px] italic font-serif text-ink-500 mt-1">
                for {inputs.customerName}
              </p>
            ) : null}
          </div>
          <button
            onClick={onBack}
            className="text-[13px] italic font-serif text-ink-500 hover:text-ink transition-colors"
          >
            ← back to the basics
          </button>
        </motion.header>

        {error ? (
          <div className="bg-paper-light border border-hairline rounded-xl p-6">
            <p className="font-serif italic text-terracotta">
              Couldn't fetch Solar API data for this address.
            </p>
            <p className="text-[12px] text-ink-500 mt-2">{error}</p>
            <p className="text-[12px] text-ink-500 mt-4">
              Try a different residential address — Solar API coverage is best for single-family homes
              in supported regions (much of Germany, US, UK, etc).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
            {/* LEFT — map + stats */}
            <section className="lg:col-span-7 space-y-5">
              <div className="relative">
                {insights ? (
                  <SolarMap
                    address={inputs.address}
                    insights={insights}
                    panelsCount={config.panelsCount}
                    showFlux={showFlux}
                    fluxUrl={dataLayers?.annualFluxUrl ?? null}
                    showPanels={!showFlux}
                    className="w-full aspect-[4/3] md:aspect-[16/11]"
                  />
                ) : (
                  <div className="w-full aspect-[4/3] md:aspect-[16/11] rounded-2xl border border-hairline bg-paper-dark/40 flex items-center justify-center">
                    <p className="font-serif italic text-ink-500">
                      {loading ? 'finding your roof…' : 'no data yet'}
                    </p>
                  </div>
                )}

                {/* live badge */}
                {insights ? (
                  <div className="absolute top-3 left-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-paper-light/90 backdrop-blur-sm shadow-soft text-[11px]">
                    <span className="relative inline-flex w-1.5 h-1.5">
                      <span className="absolute inset-0 rounded-full bg-terracotta animate-ping opacity-50" />
                      <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-terracotta" />
                    </span>
                    <span className="font-medium uppercase tracking-[0.18em] text-ink-500">
                      live · google solar
                    </span>
                  </div>
                ) : null}

                {/* layer toggle */}
                {insights ? (
                  <div className="absolute bottom-3 left-3 inline-flex items-center bg-paper-light/95 backdrop-blur-sm shadow-card rounded-full p-1 text-[12px]">
                    <button
                      type="button"
                      onClick={() => setShowFlux(false)}
                      className={`px-3 py-1.5 rounded-full transition-colors duration-200 ${
                        !showFlux ? 'bg-ink text-paper-light' : 'text-ink-500 hover:text-ink'
                      }`}
                    >
                      <span className="font-serif italic">panels</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFlux(true)}
                      disabled={!dataLayers?.annualFluxUrl}
                      className={`px-3 py-1.5 rounded-full transition-colors duration-200 ${
                        showFlux
                          ? 'bg-ink text-paper-light'
                          : dataLayers?.annualFluxUrl
                            ? 'text-ink-500 hover:text-ink'
                            : 'text-ink-300 cursor-not-allowed'
                      }`}
                      title={dataLayers?.annualFluxUrl ? 'Annual sunlight on this roof' : 'No heatmap data for this address'}
                    >
                      <span className="font-serif italic">heatmap</span>
                    </button>
                  </div>
                ) : null}

                {/* flux legend */}
                {showFlux && insights ? (
                  <div className="absolute bottom-3 right-3 px-3 py-2 rounded-lg bg-paper-light/95 backdrop-blur-sm shadow-card text-[10px] uppercase tracking-[0.18em] text-ink-500">
                    <p className="mb-1">annual sunlight</p>
                    <div className="flex items-center gap-2">
                      <span>less</span>
                      <span
                        className="block w-32 h-1.5 rounded-full"
                        style={{
                          background:
                            'linear-gradient(90deg, rgba(80,38,70,0.3) 0%, #8C3C3C 25%, #C44A2C 50%, #F08232 70%, #FDB813 85%, #FFF8C8 100%)',
                        }}
                      />
                      <span>more</span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="max system" value={`${((maxPanels * (sp?.panelCapacityWatts ?? 400)) / 1000).toFixed(1)} kWp`} sub={`${maxPanels} panels`} />
                <Stat
                  label="ideal yearly"
                  value={`${fmtNumber(sp?.solarPanelConfigs?.[sp.solarPanelConfigs.length - 1]?.yearlyEnergyDcKwh ?? 0)} kWh`}
                  sub="all panels on"
                />
                <Stat label="sunshine" value={`${fmtNumber(maxSunHours)} hr/yr`} sub="best part of roof" />
                <Stat label="roof area" value={`${fmtNumber(Math.round(sp?.wholeRoofStats?.areaMeters2 ?? 0))} m²`} sub={`${sp?.roofSegmentStats?.length ?? 0} segments`} />
              </div>

              <RegionalSnapshot city={(inputs.address.city as City) ?? null} />
            </section>

            {/* RIGHT — controls */}
            <aside className="lg:col-span-5 space-y-6">
              {/* Live preview — pinned to viewport while user scrolls the controls below */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="bg-ink rounded-2xl p-6 text-paper-light lg:sticky lg:top-6 lg:z-10 shadow-card"
              >
                <p className="text-[10px] uppercase tracking-[0.2em] text-paper-light/60 mb-4">
                  your design — live
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Mini
                    label="kWp"
                    value={
                      <AnimatedNumber value={liveDesign.pvArrayKwp} decimals={1} duration={500} />
                    }
                  />
                  <Mini
                    label="kWh / yr"
                    value={
                      <AnimatedNumber
                        value={liveDesign.annualProductionKwh}
                        decimals={0}
                        duration={500}
                      />
                    }
                  />
                  <Mini
                    label="€ saved/yr"
                    value={
                      <AnimatedNumber
                        value={liveDesign.annualSavingsEur}
                        prefix="€"
                        duration={500}
                      />
                    }
                  />
                </div>
                <div className="mt-5 pt-5 border-t border-paper-light/10 grid grid-cols-2 gap-2 text-[12px]">
                  <Footline label="payback" value={`${liveDesign.paybackYears.toFixed(1)} yrs`} />
                  <Footline label="cost" value={fmtEur(liveDesign.cost.total)} />
                </div>
              </motion.div>

              <div className="bg-paper-light/60 border border-hairline rounded-2xl p-6">
                <div className="divide-y divide-hairline">
                  <Slider
                    label="Number of panels"
                    helper={`Solar API found a max of ${maxPanels} possible. The map updates as you slide.`}
                    min={1}
                    max={Math.max(1, maxPanels)}
                    step={1}
                    value={Math.min(config.panelsCount, Math.max(1, maxPanels))}
                    onChange={(v) => updateConfig('panelsCount', v)}
                    formatValue={(v) => `${v}`}
                    formatBound={(v) => `${v}`}
                  />

                  <div className="py-5">
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="nb-label">Panel wattage</span>
                      <span className="font-serif text-[22px] leading-none text-ink tracking-tight">
                        {config.panelWattage} W
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {PANEL_WATTAGE_OPTIONS.map((w) => {
                        const active = w === config.panelWattage;
                        return (
                          <button
                            key={w}
                            type="button"
                            onClick={() => updateConfig('panelWattage', w)}
                            className={`px-3 py-1.5 rounded-full text-[12px] font-medium tracking-wide
                              border transition-colors duration-150 ${
                                active
                                  ? 'bg-ink text-paper-light border-ink'
                                  : 'bg-transparent text-ink-700 border-hairline hover:border-ink-700'
                              }`}
                          >
                            {w} W
                          </button>
                        );
                      })}
                    </div>
                    <p className="nb-helper mt-3">
                      Higher-wattage panels = same roof, more output. Slightly more expensive.
                    </p>
                  </div>

                  <Slider
                    label="Battery"
                    helper="Set to 0 to skip — improves payback, hurts self-consumption."
                    min={0}
                    max={20}
                    step={1}
                    value={config.batteryKwh}
                    onChange={(v) => updateConfig('batteryKwh', v)}
                    formatValue={(v) => `${v} kWh`}
                    formatBound={(v) => `${v} kWh`}
                  />

                  <Slider
                    label="Annual electricity"
                    helper="Refine if your bill says different."
                    min={1000}
                    max={15000}
                    step={100}
                    value={liveInputs.energyDemandKwh}
                    onChange={(v) => updateInputs('energyDemandKwh', v)}
                    formatValue={(v) => `${fmtNumber(v)} kWh`}
                    formatBound={(v) => `${fmtNumber(v)} kWh`}
                  />

                  <Slider
                    label="Your kWh price"
                    helper="From your utility bill."
                    min={0.2}
                    max={0.7}
                    step={0.01}
                    value={liveInputs.energyPricePerKwh}
                    onChange={(v) => updateInputs('energyPricePerKwh', v)}
                    formatValue={(v) => `€${v.toFixed(2)}`}
                    formatBound={(v) => `€${v.toFixed(2)}`}
                  />

                  <div className="py-5">
                    <label className="flex items-center justify-between cursor-pointer select-none">
                      <span>
                        <span className="nb-label block">EV in the household?</span>
                        <span className="nb-helper block mt-0.5">Adds ~0.18 kWh per km.</span>
                      </span>
                      <span className="relative inline-flex shrink-0">
                        <input
                          type="checkbox"
                          checked={liveInputs.hasEv}
                          onChange={(e) => updateInputs('hasEv', e.target.checked)}
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
                        height: liveInputs.hasEv ? 'auto' : 0,
                        opacity: liveInputs.hasEv ? 1 : 0,
                        marginTop: liveInputs.hasEv ? 16 : 0,
                      }}
                      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-hairline">
                        <Slider
                          label="EV mileage"
                          helper="Annual driving distance."
                          min={0}
                          max={30000}
                          step={500}
                          value={liveInputs.evAnnualKm}
                          onChange={(v) => updateInputs('evAnnualKm', v)}
                          formatValue={(v) => `${fmtNumber(v)} km`}
                          formatBound={(v) => `${fmtNumber(v)} km`}
                        />
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] text-ink-500 italic font-serif max-w-[16ch]">
                  happy with it?
                </p>
                <PrimaryCta
                  disabled={!insights}
                  onClick={() => onContinue(liveDesign, insights)}
                >
                  See my savings
                </PrimaryCta>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-paper-light/60 border border-hairline rounded-xl p-4">
      <p className="nb-eyebrow text-[10px] mb-1.5">{label}</p>
      <p className="font-serif text-[20px] leading-tight text-ink tracking-tight tabular-nums">
        {value}
      </p>
      {sub ? <p className="text-[11px] text-ink-400 italic mt-0.5">{sub}</p> : null}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-paper-light/50">{label}</p>
      <p className="font-serif text-[28px] leading-tight text-paper-light tracking-tight tabular-nums mt-1">
        {value}
      </p>
    </div>
  );
}

function Footline({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-paper-light/55">{label}</span>
      <span className="font-serif italic text-paper-light tabular-nums">{value}</span>
    </div>
  );
}
