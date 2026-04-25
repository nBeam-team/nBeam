/**
 * Print-only proposal layout. Hidden on screen; renders as the PDF body
 * when the user prints. Sections: header, prepared-for/by, executive
 * summary, property (with Static Maps screenshot), proposed system,
 * financial projection, terms, signatures.
 */
import { useState } from 'react';
import { RoiChart } from './RoiChart';
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

  const totalRoi = design.roi[design.roi.length - 1]?.cumulative ?? 0;
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
            <p className="font-medium text-ink">[Installer name]</p>
            <p className="italic text-ink-400">add company details in your CRM template</p>
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
            <LineRow
              item="Solar modules"
              spec={`${design.config.panelWattage} W monocrystalline, framed`}
              qty={`${design.modulesCount}`}
              total={fmtEur(design.cost.pvSystem)}
            />
            {design.batteryKwh > 0 && (
              <LineRow
                item="Battery storage"
                spec={`Lithium-ion, ${design.batteryKwh} kWh usable`}
                qty="1"
                total={fmtEur(design.cost.battery)}
              />
            )}
            <LineRow
              item="Hybrid inverter"
              spec={`${design.inverterKw.toFixed(1)} kW string inverter`}
              qty="1"
              total="incl."
            />
            <LineRow
              item="Installation"
              spec="Mounting, DC + AC wiring, commissioning"
              qty="—"
              total={fmtEur(design.cost.installation)}
            />
            <LineRow
              item="Permits &amp; testing"
              spec="Grid registration, inspection"
              qty="—"
              total="incl."
            />
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
            label="25-year cumulative"
            value={fmtEur(totalRoi)}
            tone="strong"
          />
        </div>
        <div className="border border-ink/20 rounded-md bg-paper">
          <RoiChart data={design.roi} paybackYear={design.paybackYears} />
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
