import type { RLCParams } from './units';
import { classifyFixedPoint, type FixedPointType } from './stability';
export interface RLCParameters {
  omega: number; frequencyHz: number; frequencyKHz: number;
  omega0: number | null; f0: number | null; beta: number | null; omegaD: number | null;
  omegaRes: number | null; fRes: number | null; qualityFactor: number | null;
  criticalResistance: number | null; tau: number | null; delta: number | null; discriminant: number | null;
  eigenvalues: { real: number; imaginary: number }[];
  dampingRegime: 'underdamped' | 'critical' | 'overdamped' | 'invalid'; fixedPointType: FixedPointType | null;
  isValidRLC: boolean; warnings: string[];
}
export function calculateRLCParameters(p: RLCParams): RLCParameters {
  const valid = Object.values(p).every(Number.isFinite) && p.L > 0 && p.C > 0 && p.R >= 0 && p.frequencyHz >= 0 && p.sourceAmplitude >= 0;
  const omega = Number.isFinite(p.frequencyHz) && p.frequencyHz >= 0 ? 2 * Math.PI * p.frequencyHz : 0;
  if (!valid) return { omega, frequencyHz: omega / (2 * Math.PI), frequencyKHz: omega / (2 * Math.PI * 1000), omega0: null, f0: null, beta: null, omegaD: null, omegaRes: null, fRes: null, qualityFactor: null, criticalResistance: null, tau: null, delta: null, discriminant: null, eigenvalues: [], dampingRegime: 'invalid', fixedPointType: null, isValidRLC: false, warnings: ['Для модели последовательного RLC-контура второго порядка требуется L > 0 и C > 0. Значение 0 соответствует вырожденному предельному случаю. Все параметры должны быть конечными и неотрицательными.'] };
  const omega0 = 1 / Math.sqrt(p.L * p.C), beta = p.R / (2 * p.L), criticalResistance = 2 * Math.sqrt(p.L / p.C);
  const critical = Math.abs(beta - omega0) / omega0 < 1e-6;
  const dampingRegime = critical ? 'critical' : beta < omega0 ? 'underdamped' : 'overdamped';
  const tau = -2 * beta, delta = omega0 * omega0, discriminant = tau * tau - 4 * delta;
  const omegaD = beta < omega0 && !critical ? Math.sqrt((omega0 - beta) * (omega0 + beta)) : null;
  const alpha = beta > omega0 ? Math.sqrt((beta - omega0) * (beta + omega0)) : 0;
  const eigenvalues = critical ? [{ real: -beta, imaginary: 0 }, { real: -beta, imaginary: 0 }] : beta < omega0 ? [{ real: -beta, imaginary: omegaD! }, { real: -beta, imaginary: -omegaD! }] : [{ real: -delta / (beta + alpha), imaginary: 0 }, { real: -beta - alpha, imaginary: 0 }];
  const omegaRes = delta - 2 * beta * beta > 0 ? Math.sqrt(delta - 2 * beta * beta) : null;
  const warnings: string[] = [];
  if (omegaRes === null) warnings.push('При данных параметрах выраженного резонансного максимума U_C(ω) при ω > 0 нет.');
  if (p.R === 0) warnings.push('Идеальный контур: потерь нет, Q → ∞. Переходная составляющая не затухает.');
  if (p.R === 0 && p.sourceAmplitude > 0 && Math.abs(omega - omega0) / omega0 < 1e-10) warnings.push('При точном резонансе без потерь конечного установившегося решения не существует: амплитуда растёт со временем.');
  if (critical && beta !== omega0) warnings.push('В пределах относительного допуска 10⁻⁶ применяется формула критического затухания.');
  return { omega, frequencyHz: p.frequencyHz, frequencyKHz: p.frequencyHz / 1000, omega0, f0: omega0 / (2 * Math.PI), beta, omegaD, omegaRes, fRes: omegaRes === null ? null : omegaRes / (2 * Math.PI), qualityFactor: p.R === 0 ? null : Math.sqrt(p.L / p.C) / p.R, criticalResistance, tau, delta, discriminant, eigenvalues, dampingRegime, fixedPointType: classifyFixedPoint(tau, delta, critical), isValidRLC: true, warnings };
}
