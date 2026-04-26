/**
 * Print-only proposal layout. Hidden on screen; renders as the PDF body
 * when the user prints. Sections: header, prepared-for/by, executive
 * summary, property (with Static Maps screenshot), proposed system,
 * financial projection, terms, signatures.
 */
import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtEur, fmtNumber } from '../lib/format';
import { staticMapUrl } from '../lib/staticMap';
import type { SystemDesign } from '../lib/types';

interface Props {
  design: SystemDesign;
}

export function PrintProposal({ design }: Props) {
  const [mapFailed, setMapFailed] = useState(false);
  const today = new Date().toLocaleDateString('en-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);
  const validUntilStr = validUntil.toLocaleDateString('en-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const lastRoi = design.roi[design.roi.length - 1];
  const totalRoi = lastRoi?.cumulative ?? 0;
  const totalSavedVsBaseline = lastRoi ? lastRoi.cumulative - lastRoi.baseline : 0;
  const mapUrl = staticMapUrl(design, { width: 900, height: 540, zoom: 20 });

  return (
    <div className="print-only text-ink leading-snug">
      {/* 1. HEADER */}
      <header className="flex items-start justify-between pb-4 border-b border-ink/40">
        <div>
          <p className="font-serif text-[20px] font-medium tracking-tightest leading-none">
            ☉ nbeam
          </p>
          <p className="nb-eyebrow text-[9px] mt-1">solar &amp; storage proposal</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-500">project</p>
          <p className="font-serif text-[14px] tabular-nums">{design.inputs.projectId}</p>
          <p className="text-[10px] text-ink-500 mt-1.5 tabular-nums">{today}</p>
        </div>
      </header>

      {/* 2. PREPARED FOR / BY */}
      <section className="grid grid-cols-2 gap-6 mt-6 print-keep">
        <div>
          <p className="nb-eyebrow text-[9px]">prepared for</p>
          <div className="mt-2 text-[12px] leading-relaxed">
            {design.inputs.customerName ? (
              <p className="font-medium text-ink">{design.inputs.customerName}</p>
            ) : (
              <p className="italic text-ink-400">[customer name]</p>
            )}
            <p>{design.inputs.address.formatted}</p>
            {design.inputs.customerEmail ? <p>{design.inputs.customerEmail}</p> : null}
            {design.inputs.customerPhone ? <p>{design.inputs.customerPhone}</p> : null}
          </div>
        </div>
        <div>
          <p className="nb-eyebrow text-[9px]">prepared by</p>
          <div className="mt-2 text-[12px] leading-relaxed">
            <p className="font-medium text-ink">Reonic Solar GmbH</p>
            <p>Berliner Straße 142, 10115 Berlin</p>
            <p>+49 30 4012 8870 · hello@reonic.de</p>
            <p className="text-[10px] text-ink-500 mt-1">
              Master HWK certified · Reg. DE-SOL-2024-0042 · VAT DE369221877
            </p>
          </div>
        </div>
      </section>

      {/* 3. EXECUTIVE SUMMARY */}
      <section className="mt-8 print-keep">
        <SectionHeading>Executive summary</SectionHeading>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
          <SummaryItem
            label="System size"
            value={`${design.pvArrayKwp.toFixed(1)} kWp solar`}
            note={`${design.modulesCount} × ${design.config.panelWattage} W modules`}
          />
          {design.batteryKwh > 0 && (
            <SummaryItem
              label="Battery"
              value={`${design.batteryKwh.toFixed(0)} kWh storage`}
              note="lithium pack + BMS"
            />
          )}
          <SummaryItem
            label="Annual production"
            value={`${fmtNumber(design.annualProductionKwh)} kWh`}
            note={`${(design.selfConsumptionRatio * 100).toFixed(0)}% self-consumed`}
          />
          <SummaryItem
            label="Annual savings"
            value={fmtEur(design.annualSavingsEur)}
            note="year one, escalating"
          />
          <SummaryItem
            label="Payback"
            value={`${design.paybackYears.toFixed(1)} years`}
            note="then 25-year lifespan"
          />
          <SummaryItem
            label="CO₂ avoided"
            value={`${design.co2ReductionTons.toFixed(1)} t / year`}
            note={`≈ ${Math.round(design.co2ReductionTons * 4.2)} trees / year`}
          />
        </ul>
      </section>

      {/* 4. THE PROPERTY */}
      <section className="mt-8 print-keep">
        <SectionHeading>The property</SectionHeading>
        <div className="grid grid-cols-3 gap-4 mb-3">
          <PropertyStat
            label="roof area"
            value={`${fmtNumber(design.roofAreaM2)} m²`}
          />
          <PropertyStat
            label="utilisation"
            value={`${design.roofUtilizationPct}%`}
          />
          <PropertyStat
            label="segments"
            value={`${design.insights?.solarPotential.roofSegmentStats?.length ?? 0}`}
          />
        </div>
        {/* Static map screenshot */}
        <div className="rounded-md overflow-hidden border border-ink/20 bg-paper-dark">
          {mapFailed ? (
            <div className="aspect-[5/3] flex flex-col items-center justify-center px-6 text-center">
              <p className="font-serif italic text-[14px] text-ink-700">
                map preview unavailable
              </p>
              <p className="text-[10px] text-ink-500 mt-2 leading-relaxed">
                Enable <span className="font-medium">Maps Static API</span> on the
                <br />
                Maps JS key in Google Cloud Console to include a satellite screenshot here.
              </p>
            </div>
          ) : (
            <img
              src={mapUrl}
              alt="Satellite view of the property with proposed panel layout"
              className="block w-full"
              onError={() => setMapFailed(true)}
            />
          )}
        </div>
        <p className="text-[10px] italic text-ink-500 mt-1.5">
          rooftop imagery © google · panel layout informed by Google Solar API
        </p>
      </section>

      {/* 5. PROPOSED SYSTEM */}
      <section className="mt-8 print-keep print-break-before">
        <SectionHeading>Proposed system &amp; investment</SectionHeading>
        <table className="w-full text-[11px] tabular-nums">
          <thead>
            <tr className="text-left border-b border-ink/30">
              <th className="py-1.5 font-medium uppercase tracking-[0.12em] text-[9px]">Item</th>
              <th className="py-1.5 font-medium uppercase tracking-[0.12em] text-[9px]">Specification</th>
              <th className="py-1.5 font-medium uppercase tracking-[0.12em] text-[9px] text-center">Qty</th>
              <th className="py-1.5 font-medium uppercase tracking-[0.12em] text-[9px] text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {design.cost.bom.map((item, idx) => (
              <LineRow
                key={idx}
                item={item.name}
                spec={item.brand ? `Brand: ${item.brand}` : item.category}
                qty={`${item.quantity} ${item.unit}`}
                total={fmtEur(item.totalPrice)}
              />
            ))}
            <tr className="border-t-2 border-ink/60">
              <td className="py-3 font-serif italic text-[14px]" colSpan={3}>
                Total investment
              </td>
              <td className="py-3 font-serif text-[20px] text-terracotta text-right">
                {fmtEur(design.cost.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 6. FINANCIAL PROJECTION */}
      <section className="mt-8 print-keep">
        <SectionHeading>Financial projection</SectionHeading>
        <div className="grid grid-cols-3 gap-4 text-[12px] mb-3">
          <Projection
            label="Year-1 savings"
            value={fmtEur(design.annualSavingsEur)}
          />
          <Projection
            label="Payback period"
            value={`${design.paybackYears.toFixed(1)} years`}
          />
          <Projection
            label="25-year saved vs no solar"
            value={fmtEur(totalSavedVsBaseline)}
            tone="strong"
          />
        </div>
        <p className="text-[10px] italic text-ink-500 mt-1 mb-3">
          Net cash position after 25 years: {fmtEur(totalRoi)}.
        </p>
        <div className="border border-ink/20 rounded-md bg-paper p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-500 mb-1">
            twenty-five years
          </p>
          <p className="font-serif italic text-[14px] text-ink mb-2">cumulative net</p>
          <PrintRoiChart data={design.roi} paybackYear={design.paybackYears} />
        </div>
        <p className="text-[10px] italic text-ink-500 mt-1.5">
          assumes {design.inputs.energyPriceIncreasePct.toFixed(1)}%/yr price escalation,{' '}
          {(design.inputs.solarFeedInPerKwh ?? 0.082).toFixed(3)} €/kWh feed-in tariff,{' '}
          {(design.selfConsumptionRatio * 100).toFixed(0)}% self-consumption.
        </p>
      </section>

      {/* 7. TERMS & NEXT STEPS */}
      <section className="mt-8 print-keep">
        <SectionHeading>Terms &amp; next steps</SectionHeading>
        <div className="grid grid-cols-2 gap-6 text-[11px] leading-relaxed">
          <div>
            <p className="font-medium text-ink mb-1">Quote validity</p>
            <p className="text-ink-500">
              This estimate is valid until <span className="text-ink">{validUntilStr}</span>.
              Final pricing is confirmed after a site survey.
            </p>
          </div>
          <div>
            <p className="font-medium text-ink mb-1">Assumptions</p>
            <p className="text-ink-500">
              Sizing uses Google Solar API rooftop geometry. Production estimates use the
              top-energy panel positions on viable roof segments.
            </p>
          </div>
          <div>
            <p className="font-medium text-ink mb-1">Next steps</p>
            <ol className="text-ink-500 space-y-0.5 list-decimal pl-4">
              <li>On-site survey (1–2 hrs)</li>
              <li>Final binding quote</li>
              <li>Grid pre-registration</li>
              <li>Installation scheduling (6–10 weeks lead)</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-ink mb-1">Subsidies</p>
            <p className="text-ink-500">
              KfW programmes and regional incentives may apply. Final eligibility confirmed
              at site survey.
            </p>
          </div>
        </div>
      </section>

      {/* 8. SIGNATURES */}
      <section className="mt-8 print-keep">
        <SectionHeading>Acceptance</SectionHeading>
        <div className="grid grid-cols-2 gap-12 mt-6 text-[10px] uppercase tracking-[0.18em] text-ink-500">
          <SignatureBlock label="customer" />
          <SignatureBlock label="installer" />
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-10 pt-3 border-t border-ink/30 flex items-baseline justify-between text-[9px] text-ink-400 italic font-serif">
        <span>nbeam · estimates only — for a binding quote contact a certified installer</span>
        <span className="tabular-nums">{design.inputs.projectId}</span>
      </footer>
    </div>
  );
}

/* ---------------- subcomponents ---------------- */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-700 pb-1.5 mb-3 border-b border-ink/20">
      {children}
    </h2>
  );
}

function SummaryItem({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <li className="flex items-baseline gap-2 leading-tight py-1">
      <span className="w-1 h-1 rounded-full bg-terracotta shrink-0" />
      <span className="text-ink-500">{label}:</span>
      <span className="font-serif italic text-ink">{value}</span>
      {note ? <span className="text-[10px] italic text-ink-400">— {note}</span> : null}
    </li>
  );
}

function PropertyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-ink/20 rounded-md p-3">
      <p className="text-[9px] uppercase tracking-[0.18em] text-ink-500">{label}</p>
      <p className="font-serif text-[18px] text-ink mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

function LineRow({
  item,
  spec,
  qty,
  total,
}: {
  item: string;
  spec: string;
  qty: string;
  total: string;
}) {
  return (
    <tr className="border-b border-ink/15">
      <td className="py-2 font-medium text-ink">{item}</td>
      <td className="py-2 text-ink-500">{spec}</td>
      <td className="py-2 text-center text-ink-500 tabular-nums">{qty}</td>
      <td className="py-2 text-right font-serif text-[12px] tabular-nums">{total}</td>
    </tr>
  );
}

function Projection({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'strong';
}) {
  return (
    <div
      className={`border rounded-md p-3 ${
        tone === 'strong' ? 'border-terracotta/50 bg-terracotta/5' : 'border-ink/20'
      }`}
    >
      <p className="text-[9px] uppercase tracking-[0.18em] text-ink-500">{label}</p>
      <p
        className={`font-serif italic text-[18px] mt-0.5 tabular-nums ${
          tone === 'strong' ? 'text-terracotta' : 'text-ink'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SignatureBlock({ label }: { label: string }) {
  return (
    <div>
      <p>{label}</p>
      <div className="border-b border-ink mt-10 mb-1" />
      <p className="text-[9px]">name</p>
      <div className="border-b border-ink mt-8 mb-1" />
      <p className="text-[9px]">date</p>
    </div>
  );
}

/**
 * Fixed-size ROI chart for the print pipeline. ResponsiveContainer doesn't
 * work here because the print-only ancestor is `display:none` until the
 * print dialog opens, so the parent box measures 0×0 and the responsive
 * chart never renders. Using fixed pixel dimensions sidesteps that entirely.
 */
function PrintRoiChart({
  data,
  paybackYear,
}: {
  data: { year: number; cumulative: number; baseline: number }[];
  paybackYear: number;
}) {
  return (
    <div className="overflow-hidden">
      <AreaChart
        width={640}
        height={210}
        data={data}
        margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
      >
        <defs>
          <linearGradient id="printRoiFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C44A2C" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#C44A2C" stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id="printBaselineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5D4A5C" stopOpacity={0.04} />
            <stop offset="100%" stopColor="#5D4A5C" stopOpacity={0.18} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#EBE0CC" vertical={false} />
        <XAxis
          dataKey="year"
          tickLine={false}
          axisLine={{ stroke: '#E0D3BC' }}
          tick={{ fill: '#6B5D54', fontSize: 10 }}
          ticks={[0, 5, 10, 15, 20, 25]}
          unit="y"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#6B5D54', fontSize: 10 }}
          tickFormatter={(v: number) =>
            Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
          }
          width={42}
        />
        <ReferenceLine y={0} stroke="#B5A89B" strokeDasharray="3 3" />
        {paybackYear > 0 && paybackYear <= 25 ? (
          <ReferenceLine
            x={paybackYear}
            stroke="#5D7253"
            strokeWidth={1.4}
            strokeDasharray="4 4"
            label={{
              value: 'break-even',
              position: 'insideTopLeft',
              fill: '#5D7253',
              fontSize: 10,
              fontStyle: 'italic',
              fontFamily: 'Fraunces, serif',
            }}
          />
        ) : null}
        <Area
          type="monotone"
          dataKey="baseline"
          stroke="#5D4A5C"
          strokeWidth={1.4}
          strokeDasharray="5 4"
          fill="url(#printBaselineFill)"
          isAnimationActive={false}
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke="#C44A2C"
          strokeWidth={2}
          fill="url(#printRoiFill)"
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
      <div className="flex items-baseline gap-5 px-2 mt-1 text-[10px] font-serif italic text-ink-500">
        <span className="inline-flex items-baseline gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-terracotta align-middle" /> with solar
        </span>
        <span className="inline-flex items-baseline gap-1.5">
          <span
            className="inline-block w-3 align-middle border-t border-dashed"
            style={{ borderColor: '#5D4A5C', borderTopWidth: 1.4 }}
          />{' '}
          without solar
        </span>
      </div>
    </div>
  );
}
