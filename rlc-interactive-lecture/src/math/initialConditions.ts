import type { RLCParameters } from './rlcParameters';
export const sinc = (x: number) => Math.abs(x) < 1e-4 ? 1 - x * x / 6 + x ** 4 / 120 : Math.sin(x) / x;
export function homogeneousResponse(m: RLCParameters, q0: number, i0: number, t: number): [number, number] {
  const b = m.beta!, w = m.omega0!;
  if (m.dampingRegime === 'critical') {
    const k = i0 + b * q0, e = Math.exp(-b * t);
    return [(q0 + k * t) * e, (i0 - b * k * t) * e];
  }
  if (m.dampingRegime === 'underdamped') {
    const wd = m.omegaD!, e = Math.exp(-b * t), s = t * sinc(wd * t), c = Math.cos(wd * t);
    return [e * (q0 * c + (i0 + b * q0) * s), e * (i0 * c - (b * i0 + w * w * q0) * s)];
  }
  const r1 = m.eigenvalues[0].real, r2 = m.eigenvalues[1].real;
  const a = (i0 - r2 * q0) / (r1 - r2), e1 = Math.exp(r1 * t), e2 = Math.exp(r2 * t);
  return [a * e1 + (q0 - a) * e2, r1 * a * e1 + r2 * (q0 - a) * e2];
}
