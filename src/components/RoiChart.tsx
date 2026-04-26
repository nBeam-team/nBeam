import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtEur } from '../lib/format';

interface Props {
  data: { year: number; cumulative: number }[];
  paybackYear: number;
}

export function RoiChart({ data, paybackYear }: Props) {
  return (
    <div className="bg-paper-light/60 border border-hairline rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <p className="nb-eyebrow text-[10px] mb-1">Twenty-five years</p>
          <h3 className="font-serif text-[18px] italic text-ink">cumulative net</h3>
        </div>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="roiFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C44A2C" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#C44A2C" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#EBE0CC" vertical={false} />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={{ stroke: '#E0D3BC' }}
              tick={{ fill: '#8B7B6E', fontSize: 11 }}
              ticks={[0, 5, 10, 15, 20, 25]}
              unit="y"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#8B7B6E', fontSize: 11 }}
              tickFormatter={(v: number) =>
                Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
              }
              width={42}
            />
            <Tooltip
              cursor={{ stroke: '#C44A2C', strokeWidth: 1, strokeDasharray: '4 4' }}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid #E0D3BC',
                background: '#FAF4E8',
                fontSize: 13,
                padding: '8px 10px',
                fontFamily: 'Fraunces, serif',
                fontStyle: 'italic',
                color: '#1A1410',
                boxShadow: '0 4px 12px -2px rgba(26,20,16,0.10)',
              }}
              formatter={(v) => [fmtEur(Number(v)), 'net']}
              labelFormatter={(y) => `year ${y}`}
            />
            <ReferenceLine y={0} stroke="#B5A89B" strokeDasharray="3 3" />
            {paybackYear > 0 && paybackYear <= 25 ? (
              <ReferenceLine
                x={paybackYear}
                stroke="#7A8F6F"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                label={{
                  value: 'break-even',
                  position: 'insideTopLeft',
                  fill: '#5D7253',
                  fontSize: 11,
                  fontStyle: 'italic',
                  fontFamily: 'Fraunces, serif',
                }}
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="#C44A2C"
              strokeWidth={2.5}
              fill="url(#roiFill)"
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
              dot={false}
              activeDot={{ r: 5, fill: '#C44A2C', stroke: '#FAF4E8', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
