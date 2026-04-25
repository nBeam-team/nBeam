import { motion } from 'framer-motion';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { EnergyFlow } from '../components/EnergyFlow';
import { PrintProposal } from '../components/PrintProposal';
import { RegionalSnapshot } from '../components/RegionalSnapshot';
import { RoiChart } from '../components/RoiChart';
import { SpecCard } from '../components/SpecCard';
import { staticMapUrl } from '../lib/staticMap';
import { fmtEur, fmtNumber } from '../lib/format';
import type { City, SystemDesign } from '../lib/types';

interface Props {
  design: SystemDesign;
  onChange?: (next: SystemDesign) => void;
  onBackToConfig: () => void;
  onRestart: () => void;
}

export function Results({ design, onBackToConfig, onRestart }: Props) {
  const cityForSnapshot = (design.inputs.address.city as City) ?? null;

  return (
    <main className="relative pb-24 print:pb-0">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[480px] bg-paper-glow pointer-events-none print:hidden" />

      {/* PRINT-ONLY: formal proposal layout */}
      <PrintProposal design={design} />

      {/* Pre-load the static map image so it's already cached when the user clicks print */}
      <img
        src={staticMapUrl(design, { width: 900, height: 540, zoom: 20 })}
        alt=""
        aria-hidden
        loading="eager"
        className="hidden"
      />

      <div className="max-w-[1100px] mx-auto px-6 md:px-10 pt-8 md:pt-12 print:hidden">
        {/* Editorial header (screen) */}
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mb-12 md:mb-16 print:hidden"
        >
          <div className="flex items-baseline justify-between mb-4">
            <p className="nb-eyebrow text-sage-dark">proposal ready</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400 tabular-nums">
              {design.inputs.projectId}
              {design.inputs.offerCreatedAt
                ? ` · ${new Date(design.inputs.offerCreatedAt).toLocaleDateString('en-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : ''}
            </p>
          </div>
          <h1 className="font-serif text-[44px] md:text-[68px] leading-[0.95] tracking-tightest text-ink">
            {design.inputs.customerName ? (
              <>
                <span className="italic text-terracotta">{design.inputs.customerName}'s</span> home,
                in sunlight.
              </>
            ) : (
              <>
                A home in <span className="italic text-terracotta">sunlight</span>.
              </>
            )}
          </h1>
          <p className="mt-5 text-[15px] md:text-[16px] text-ink-500 max-w-xl">
            Sized for {fmtNumber(design.inputs.energyDemandKwh)} kWh annual use at{' '}
            <span className="text-ink">{design.inputs.address.formatted}</span>
            {design.inputs.hasEv ? `, plus ${fmtNumber(design.inputs.evAnnualKm)} km of EV driving` : ''}.
          </p>
          {design.budgetLimited && design.inputs.budgetEur && (
            <p className="mt-4 text-[13px] italic font-serif text-terracotta-dark">
              note — over the stated budget of {fmtEur(design.inputs.budgetEur)}. tweak the panel count
              to fit if needed.
            </p>
          )}

          {/* Live regional context — shows what's happening in your city today */}
          <div className="mt-8 max-w-2xl" data-no-print>
            <RegionalSnapshot city={cityForSnapshot} variant="full" />
          </div>
        </motion.header>

        {/* The big numbers — editorial three-up */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-y-10 md:gap-x-12 mb-16 md:mb-20"
        >
          <BigStat
            eyebrow="annual savings"
            value={
              <AnimatedNumber value={design.annualSavingsEur} prefix="€" duration={1100} />
            }
            footnote="year one — and growing with prices."
            accent="terracotta"
            delay={0.15}
          />
          <BigStat
            eyebrow="payback"
            value={
              <>
                <AnimatedNumber value={design.paybackYears} decimals={1} duration={1100} />
                <span className="font-serif italic text-ink-400 text-[28px] md:text-[36px] ml-2">yrs</span>
              </>
            }
            footnote="then pure profit for 25+ years."
            accent="sage"
            delay={0.25}
          />
          <BigStat
            eyebrow="co₂ avoided"
            value={
              <>
                <AnimatedNumber value={design.co2ReductionTons} decimals={1} duration={1100} />
                <span className="font-serif italic text-ink-400 text-[28px] md:text-[36px] ml-2">t/yr</span>
              </>
            }
            footnote={`≈ ${Math.round(design.co2ReductionTons * 4.2)} trees planted/year.`}
            accent="plum"
            delay={0.35}
          />
        </motion.section>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-12 print:grid-cols-1 print:gap-6">
          {/* LEFT: System */}
          <section className="lg:col-span-7 space-y-8 print:space-y-5 print-keep">
            <Header2>the system</Header2>

            <EnergyFlow
              pvKwp={design.pvArrayKwp}
              batteryKwh={design.batteryKwh}
              inverterKw={design.inverterKw}
              hasEv={design.inputs.hasEv}
              modulesCount={design.modulesCount}
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <SpecCard
                accent="terracotta"
                delay={0.1}
                icon={<SunSm />}
                label="solar"
                value={
                  <>
                    <AnimatedNumber value={design.pvArrayKwp} decimals={1} duration={900} />
                    <span className="text-[15px] italic text-ink-400 ml-1">kWp</span>
                  </>
                }
                subtext={`${design.modulesCount} × 400 W`}
              />
              <SpecCard
                accent="sage"
                delay={0.18}
                icon={<BattSm />}
                label="battery"
                value={
                  <>
                    <AnimatedNumber value={design.batteryKwh} decimals={0} duration={900} />
                    <span className="text-[15px] italic text-ink-400 ml-1">kWh</span>
                  </>
                }
                subtext={design.batteryKwh > 0 ? 'lithium' : 'none'}
              />
              <SpecCard
                accent="plum"
                delay={0.26}
                icon={<BoltSm />}
                label="inverter"
                value={
                  <>
                    <AnimatedNumber value={design.inverterKw} decimals={1} duration={900} />
                    <span className="text-[15px] italic text-ink-400 ml-1">kW</span>
                  </>
                }
                subtext="hybrid"
              />
              <SpecCard
                accent="ink"
                delay={0.34}
                icon={<RoofSm />}
                label="roof use"
                value={
                  <>
                    <AnimatedNumber value={design.roofUtilizationPct} decimals={0} duration={900} />
                    <span className="text-[15px] italic text-ink-400 ml-1">%</span>
                  </>
                }
                subtext={
                  design.roofAreaM2 > 0
                    ? `${design.modulesCount * 2} of ${design.roofAreaM2} m²`
                    : `${design.modulesCount * 2} m² used`
                }
              />
            </div>
          </section>

          {/* RIGHT: Money */}
          <aside className="lg:col-span-5 space-y-8 print:space-y-5">
            <Header2>the money</Header2>

            {/* Receipt-style cost breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="bg-paper-light/60 border border-hairline rounded-xl p-6"
            >
              <p className="nb-eyebrow text-[10px] mb-5">investment</p>
              <ul className="space-y-3.5">
                <CostRow label="solar system" sub="modules + DC" amount={design.cost.pvSystem} />
                {design.batteryKwh > 0 ? (
                  <CostRow label="battery" sub="lithium pack + BMS" amount={design.cost.battery} />
                ) : null}
                <CostRow label="installation" sub="labor, permits, testing" amount={design.cost.installation} />
              </ul>
              <div className="mt-5 pt-5 border-t border-hairline flex items-baseline justify-between">
                <span className="font-serif italic text-[18px] text-ink">total</span>
                <span className="font-serif text-[32px] text-terracotta tabular-nums tracking-tight">
                  <AnimatedNumber value={design.cost.total} prefix="€" duration={1100} />
                </span>
              </div>
            </motion.div>

            <RoiChart data={design.roi} paybackYear={design.paybackYears} />

            <div className="space-y-3 pt-2 print:hidden" data-no-print>
              <button
                onClick={onBackToConfig}
                className="group w-full h-12 rounded-full border border-ink text-ink font-medium
                  bg-transparent hover:bg-ink hover:text-paper-light transition-colors duration-200 text-[14px]
                  flex items-center justify-between px-6"
              >
                <span className="font-serif italic">← tweak the design</span>
                <span className="text-[18px]">⚙</span>
              </button>
              <button
                onClick={() => window.print()}
                className="group w-full h-12 rounded-full bg-terracotta text-paper-light font-medium
                  hover:bg-terracotta-dark transition-colors duration-200 text-[14px]
                  flex items-center justify-between px-6"
              >
                <span className="font-serif italic">save as pdf</span>
                <span className="text-[18px] transition-transform group-hover:translate-x-0.5">→</span>
              </button>
              <button
                onClick={onRestart}
                className="w-full h-10 text-ink-500 font-medium text-[13px] hover:text-ink transition-colors"
              >
                start over
              </button>
            </div>
          </aside>
        </div>

      </div>
    </main>
  );
}

function Header2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-[20px] italic text-ink-500 tracking-tight">— {children}</h2>
  );
}

function BigStat({
  eyebrow,
  value,
  footnote,
  delay = 0,
  accent,
}: {
  eyebrow: string;
  value: React.ReactNode;
  footnote: string;
  delay?: number;
  accent: 'terracotta' | 'sage' | 'plum';
}) {
  const dot = accent === 'terracotta' ? 'bg-terracotta' : accent === 'sage' ? 'bg-sage' : 'bg-plum';
  const valueColor = accent === 'terracotta' ? 'text-terracotta' : accent === 'sage' ? 'text-sage-dark' : 'text-plum';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="md:border-l md:border-hairline md:pl-8 md:first:border-l-0 md:first:pl-0"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1 h-1 rounded-full ${dot}`} />
        <p className="nb-eyebrow text-[10px]">{eyebrow}</p>
      </div>
      <p className={`font-serif text-[44px] md:text-[56px] leading-[0.95] tracking-tightest tabular-nums ${valueColor}`}>
        {value}
      </p>
      <p className="text-[13px] text-ink-500 italic font-serif mt-3">{footnote}</p>
    </motion.div>
  );
}

function CostRow({ label, sub, amount }: { label: string; sub?: string; amount: number }) {
  return (
    <li className="flex items-baseline justify-between gap-4">
      <div className="min-w-0 flex-1 flex items-baseline gap-2">
        <span className="text-[14px] text-ink">{label}</span>
        <span className="flex-1 border-b border-dotted border-ink-300/40 mx-1 mb-1" />
        {sub ? <span className="text-[11px] text-ink-400 italic shrink-0">{sub}</span> : null}
      </div>
      <span className="font-serif text-[16px] text-ink tabular-nums shrink-0">{fmtEur(amount)}</span>
    </li>
  );
}

/* ---------------- Tiny icons ---------------- */
function SunSm() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3.5" fill="#C44A2C" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <line
            key={i}
            x1={12 + Math.cos(a) * 6.5}
            y1={12 + Math.sin(a) * 6.5}
            x2={12 + Math.cos(a) * 9.5}
            y2={12 + Math.sin(a) * 9.5}
            stroke="#C44A2C"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
function BattSm() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 28" fill="none" aria-hidden>
      <rect x="6" y="2" width="12" height="3" rx="1" fill="#7A8F6F" />
      <rect x="3" y="5" width="18" height="22" rx="3" fill="none" stroke="#7A8F6F" strokeWidth="1.5" />
      <rect x="6" y="14" width="12" height="10" rx="1" fill="#7A8F6F" />
    </svg>
  );
}
function BoltSm() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 2 4 14h7l-1 8 10-12h-7l1-8Z" fill="#5D4A5C" />
    </svg>
  );
}
function RoofSm() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12 12 4l9 8" stroke="#1A1410" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 11v9h14v-9" stroke="#1A1410" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
