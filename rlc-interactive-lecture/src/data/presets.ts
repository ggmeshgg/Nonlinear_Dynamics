import type { UIParams } from '../math/units';
export const defaults: UIParams = { R: 47, LmH: 2, CuF: 0.1, frequencyKHz: 10, sourceAmplitude: 10 };
// The laboratory Rcrit ≈ 283 Ω lies beyond the required R slider. Damping demos
// use C=1 μF so all three demonstration resistances stay within 0–200 Ω.
const rc = 2 * Math.sqrt(0.002 / 1e-6);
export const presets: { name: string; params: UIParams }[] = [
  { name: 'Лабораторный №1', params: defaults },
  { name: 'Лабораторный №2', params: { ...defaults, R: 100 } },
  { name: 'Слабое затухание', params: { ...defaults, CuF: 1, R: rc * 0.5, frequencyKHz: 3 } },
  { name: 'Критическое затухание', params: { ...defaults, CuF: 1, R: rc, frequencyKHz: 3 } },
  { name: 'Сильное затухание', params: { ...defaults, CuF: 1, R: rc * 2, frequencyKHz: 3 } },
  { name: 'Идеальный LC', params: { ...defaults, R: 0 } },
];
