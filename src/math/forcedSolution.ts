import type { RLCParams } from './units';
import { calculateRLCParameters, type RLCParameters } from './rlcParameters';
import { homogeneousResponse, sinc } from './initialConditions';
export interface InitialConditions { charge: number; current: number }
export interface RLCResponse { time: number[]; charge: number[]; current: number[]; capacitorVoltage: number[]; sourceVoltage: number[]; transientCharge: number[]; forcedCharge: number[]; forcedCurrent: number[]; envelopeVoltage: number[] }
export function particularResponse(p: RLCParams, m: RLCParameters): (t: number) => [number, number] {
  const w = m.omega, w0 = m.omega0!, F = p.sourceAmplitude / p.L;
  if (p.sourceAmplitude === 0) return () => [0, 0];
  // At and very close to lossless resonance use a stable zero-initial convolution.
  // This particular solution may contain a homogeneous term; decomposition is not unique.
  if (p.R === 0 && Math.abs(w - w0) / w0 < 1e-7) {
    const avg = (w + w0) / 2, diff = (w - w0) / 2;
    return t => {
      const k = F / (w + w0), s = t * sinc(diff * t);
      return [k * s * Math.sin(avg * t), k * (Math.cos(diff * t) * Math.sin(avg * t) + s * avg * Math.cos(avg * t))];
    };
  }
  const d = w0 * w0 - w * w, h = 2 * m.beta! * w;
  const norm = Math.hypot(d, h), a = F * (d / norm) / norm, b = F * (h / norm) / norm;
  return t => [a * Math.cos(w * t) + b * Math.sin(w * t), w * (-a * Math.sin(w * t) + b * Math.cos(w * t))];
}
export function solveRLCResponse(p: RLCParams, initial: InitialConditions, timeArray: number[], m = calculateRLCParameters(p)): RLCResponse {
  const result: RLCResponse = { time: [], charge: [], current: [], capacitorVoltage: [], sourceVoltage: [], transientCharge: [], forcedCharge: [], forcedCurrent: [], envelopeVoltage: [] };
  if (!m.isValidRLC || !Number.isFinite(initial.charge) || !Number.isFinite(initial.current)) return result;
  if (!timeArray.every(t => Number.isFinite(t) && t >= 0)) throw new RangeError('Время должно быть конечным и неотрицательным.');
  const forced = particularResponse(p, m), [qp0, ip0] = forced(0), qh0 = initial.charge - qp0, ih0 = initial.current - ip0;
  const amp = m.omegaD === null ? null : Math.hypot(qh0, (ih0 + m.beta! * qh0) / m.omegaD) / p.C;
  for (const t of timeArray) {
    const [qp, ip] = forced(t), [qh, ih] = homogeneousResponse(m, qh0, ih0, t);
    const q = t === 0 ? initial.charge : qh + qp, i = t === 0 ? initial.current : ih + ip;
    result.time.push(t); result.charge.push(q); result.current.push(i); result.capacitorVoltage.push(q / p.C);
    result.sourceVoltage.push(p.sourceAmplitude * Math.cos(m.omega * t)); result.transientCharge.push(qh); result.forcedCharge.push(qp); result.forcedCurrent.push(ip);
    result.envelopeVoltage.push(amp === null ? Math.abs(qh / p.C) : amp * Math.exp(-m.beta! * t));
  }
  return result;
}
