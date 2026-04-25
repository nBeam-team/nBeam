import { motion } from 'framer-motion';

interface Props {
  pvKwp: number;
  batteryKwh: number;
  inverterKw: number;
  hasEv: boolean;
  modulesCount: number;
}

export function EnergyFlow({ pvKwp, batteryKwh, inverterKw, hasEv, modulesCount }: Props) {
  return (
    <div className="relative w-full aspect-[16/10] rounded-2xl border border-hairline overflow-hidden bg-paper-light">
      <div
        aria-hidden
        className="absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(60% 80% at 16% 22%, rgba(196,74,44,0.10) 0%, transparent 60%), radial-gradient(60% 80% at 84% 78%, rgba(122,143,111,0.12) 0%, transparent 60%)',
        }}
      />

      <svg
        viewBox="0 0 800 500"
        preserveAspectRatio="xMidYMid meet"
        className="relative w-full h-full"
        role="img"
        aria-label={`${pvKwp.toFixed(1)} kWp solar feeding ${batteryKwh.toFixed(0)} kWh battery and a ${inverterKw.toFixed(1)} kW inverter that powers your home${hasEv ? ' and EV' : ''}.`}
      >
        <defs>
          <linearGradient id="flow-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#C44A2C" stopOpacity="0.12" />
            <stop offset="0.5" stopColor="#C44A2C" stopOpacity="0.85" />
            <stop offset="1" stopColor="#7A8F6F" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Connection lines */}
        <FlowLine d="M210 200 C 280 200, 320 250, 400 250" delay={0.2} />
        <FlowLine d="M400 250 C 480 250, 520 200, 590 200" delay={0.5} />
        <FlowLine d="M400 250 L 400 380" delay={0.7} />
        {hasEv ? <FlowLine d="M400 380 C 460 380, 540 380, 620 380" delay={0.9} /> : null}

        {/* Solar */}
        <Node x={150} y={200} delay={0.05}>
          <circle r="58" fill="#C44A2C" opacity="0.10" />
          <circle r="44" fill="#FAF4E8" stroke="#C44A2C" strokeWidth="1.5" />
          <g transform="translate(-22 -22)"><SunSvg /></g>
          <text y="78" textAnchor="middle" className="font-serif" fontSize="11" letterSpacing="2.5" fill="#8B7B6E">
            SOLAR
          </text>
          <text y="98" textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="20" fontWeight="500" fill="#1A1410">
            {pvKwp.toFixed(1)} kWp
          </text>
          <text y="116" textAnchor="middle" fontSize="11" fill="#B5A89B">
            {modulesCount} modules
          </text>
        </Node>

        {/* Battery */}
        <Node x={400} y={250} delay={0.4}>
          <circle r="46" fill="#7A8F6F" opacity="0.12" />
          <circle r="36" fill="#FAF4E8" stroke="#7A8F6F" strokeWidth="1.5" />
          <g transform="translate(-16 -18)"><BatterySvg /></g>
          <text y="64" textAnchor="middle" className="font-serif" fontSize="11" letterSpacing="2.5" fill="#8B7B6E">
            BATTERY
          </text>
          <text y="84" textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="20" fontWeight="500" fill="#1A1410">
            {batteryKwh.toFixed(0)} kWh
          </text>
        </Node>

        {/* Inverter */}
        <Node x={650} y={200} delay={0.6}>
          <circle r="46" fill="#5D4A5C" opacity="0.10" />
          <circle r="36" fill="#FAF4E8" stroke="#5D4A5C" strokeWidth="1.5" />
          <g transform="translate(-16 -18)"><BoltSvg /></g>
          <text y="64" textAnchor="middle" fontSize="11" letterSpacing="2.5" fill="#8B7B6E">
            INVERTER
          </text>
          <text y="84" textAnchor="middle" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="20" fontWeight="500" fill="#1A1410">
            {inverterKw.toFixed(1)} kW
          </text>
        </Node>

        {/* Home */}
        <Node x={400} y={420} delay={0.8}>
          <rect x="-44" y="-32" width="88" height="60" rx="6" fill="#FAF4E8" stroke="#8B7B6E" strokeWidth="1.5" />
          <path d="M-50 -32 L0 -56 L50 -32" fill="#FAF4E8" stroke="#8B7B6E" strokeWidth="1.5" strokeLinejoin="round" />
          <rect x="-10" y="-4" width="20" height="32" fill="#8B7B6E" opacity="0.4" />
          <text y="48" textAnchor="middle" className="font-serif" fontSize="13" fontStyle="italic" fontWeight="500" fill="#1A1410">
            home
          </text>
        </Node>

        {/* EV */}
        {hasEv ? (
          <Node x={690} y={380} delay={1}>
            <rect x="-36" y="-14" width="72" height="22" rx="6" fill="#FAF4E8" stroke="#8B7B6E" strokeWidth="1.5" />
            <circle cx="-20" cy="10" r="6" fill="#1A1410" />
            <circle cx="20" cy="10" r="6" fill="#1A1410" />
            <text y="36" textAnchor="middle" className="font-serif" fontSize="13" fontStyle="italic" fontWeight="500" fill="#1A1410">
              ev
            </text>
          </Node>
        ) : null}
      </svg>
    </div>
  );
}

function Node({
  x,
  y,
  delay,
  children,
}: {
  x: number;
  y: number;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {children}
      </motion.g>
    </g>
  );
}

function FlowLine({ d, delay }: { d: string; delay: number }) {
  return (
    <motion.path
      d={d}
      stroke="url(#flow-grad)"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
      strokeDasharray="5 6"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ delay, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    />
  );
}

function SunSvg() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" fill="#C44A2C" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <line
            key={i}
            x1={12 + Math.cos(a) * 7}
            y1={12 + Math.sin(a) * 7}
            x2={12 + Math.cos(a) * 10.5}
            y2={12 + Math.sin(a) * 10.5}
            stroke="#C44A2C"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
function BatterySvg() {
  return (
    <svg width="32" height="36" viewBox="0 0 24 28" fill="none">
      <rect x="6" y="2" width="12" height="3" rx="1" fill="#7A8F6F" />
      <rect x="3" y="5" width="18" height="22" rx="3" fill="#FAF4E8" stroke="#7A8F6F" strokeWidth="1.5" />
      <rect x="6" y="14" width="12" height="10" rx="1" fill="#7A8F6F" />
    </svg>
  );
}
function BoltSvg() {
  return (
    <svg width="32" height="36" viewBox="0 0 24 24" fill="none">
      <path d="M14 2 4 14h7l-1 8 10-12h-7l1-8Z" fill="#5D4A5C" />
    </svg>
  );
}
