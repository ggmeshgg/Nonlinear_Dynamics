import type { RLCParams } from './units';
import { calculateRLCParameters, type RLCParameters } from './rlcParameters';
export function capacitorAmplitude(p: RLCParams, frequencyHz: number): number | null {
  if (p.L <= 0 || p.C <= 0 || !Number.isFinite(frequencyHz) || frequencyHz < 0) return null;
  if (p.sourceAmplitude === 0) return 0;
  const w = 2 * Math.PI * frequencyHz;
  const real = 1 - p.L * p.C * w * w, imag = p.R * p.C * w;
  if (p.R === 0 && Math.abs(real) < 1e-10) return null;
  return p.sourceAmplitude / Math.hypot(real, imag);
}
export function resonanceCurve(p: RLCParams, m: RLCParameters = calculateRLCParameters(p)) {
  if (!m.isValidRLC) return { frequency: [] as number[], amplitude: [] as (number | null)[] };
  const values = new Set(Array.from({ length: 801 }, (_, i) => i * 25));
  const peak = m.fRes ?? m.f0!;
  const width = Math.max(m.beta! / (2 * Math.PI), m.f0! * 1e-5);
  for (let i = -240; i <= 240; i++) {
    const f = peak + width * 8 * i / 240;
    if (f >= 0 && f <= 20000) values.add(f);
  }
  for (const f of [peak, m.f0!, p.frequencyHz]) if (f >= 0 && f <= 20000) values.add(f);
  const frequency = [...values].sort((a, b) => a - b);
  return { frequency, amplitude: frequency.map(f => capacitorAmplitude(p, f)) };
}
