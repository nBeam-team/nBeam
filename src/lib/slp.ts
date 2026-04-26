/**
 * Generates a synthetic BDEW H0 load profile for a full year (8760 hours).
 * Normalized to 1,000 kWh base consumption.
 */
export function generateSyntheticH0(): Float64Array {
  const hoursInYear = 8760;
  const profile = new Float64Array(hoursInYear);
  
  let total = 0;
  for (let h = 0; h < hoursInYear; h++) {
    const dayOfYear = Math.floor(h / 24);
    const hourOfDay = h % 24;
    
    // Seasonal factor: highest in winter (day 0 and 365), lowest in summer (day 180)
    const seasonal = 1.0 + 0.2 * Math.cos((dayOfYear / 365) * 2 * Math.PI);
    
    // Daily factor: peaks around 8 AM and 7 PM
    let daily = 0.5; // base
    daily += 0.3 * Math.max(0, 1 - Math.abs(hourOfDay - 8) / 3); // Morning
    daily += 0.6 * Math.max(0, 1 - Math.abs(hourOfDay - 19) / 4); // Evening
    
    const value = seasonal * daily;
    profile[h] = value;
    total += value;
  }
  
  // Normalize so the sum is 1000 kWh
  const scale = 1000 / total;
  for (let h = 0; h < hoursInYear; h++) {
    profile[h] *= scale;
  }
  
  return profile;
}
