import type { RLCParameters } from './rlcParameters';
export function automaticDuration(m: RLCParameters): number {
  if (!m.isValidRLC) return 0.001;
  const periods = 6 / Math.max(m.frequencyHz, m.f0! / 10);
  const slowRate = m.dampingRegime === 'overdamped' ? -m.eigenvalues[0].real : m.beta!;
  const decay = slowRate > 0 ? 6 / slowRate : 8 / m.f0!;
  return Math.min(1, Math.max(periods, decay, 8 / m.f0!));
}
export function sampleTime(m: RLCParameters, duration: number) {
  const end = Math.min(10, Math.max(1e-6, duration));
  const fastest = Math.max(m.frequencyHz, m.f0 ?? 0);
  const count = Math.min(3000, Math.max(1000, Math.ceil(end * fastest * 32)));
  // Most points cover the full interval; extra early points resolve fast transients.
  const values = new Set(Array.from({ length: Math.floor(count * 0.7) }, (_, i) => end * i / (Math.floor(count * 0.7) - 1)));
  const early = Math.min(end, m.beta && m.beta > 0 ? 6 / m.beta : end);
  for (let i = 0; i < Math.floor(count * 0.3); i++) values.add(early * i / (Math.floor(count * 0.3) - 1));
  return [...values].sort((a, b) => a - b);
}
