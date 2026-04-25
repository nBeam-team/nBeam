export const fmtEur = (n: number) =>
  '€' + Math.round(n).toLocaleString('en-DE', { maximumFractionDigits: 0 });

export const fmtKwh = (n: number) =>
  Math.round(n).toLocaleString('en-DE') + ' kWh';

export const fmtNumber = (n: number) =>
  Math.round(n).toLocaleString('en-DE');

export const fmtKwp = (n: number) => `${n.toFixed(1)} kWp`;
export const fmtKw = (n: number) => `${n.toFixed(1)} kW`;
export const fmtBattery = (n: number) => `${n.toFixed(0)} kWh`;
