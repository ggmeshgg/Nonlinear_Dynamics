import { describe, it, expect } from 'vitest';
import { calculateRLCParameters as calc } from '../math/rlcParameters';
import { toSI, fromSI } from '../math/units';
import { defaults } from '../data/presets';
import { classifyFixedPoint } from '../math/stability';
const p = toSI(defaults);
describe('SI и параметры', () => {
  it('преобразует единицы без смешения Гц и кГц', () => { expect(p.L).toBe(0.002); expect(p.C).toBeCloseTo(1e-7, 12); expect(p.frequencyHz).toBe(10000); const roundTrip=fromSI(p); for(const key of Object.keys(defaults) as (keyof typeof defaults)[]) expect(roundTrip[key]).toBeCloseTo(defaults[key],10); });
  it('проверяет все физические формулы и размерные связи', () => {
    const m = calc(p);
    expect(m.omega).toBeCloseTo(2 * Math.PI * 10000); expect(m.omega0).toBeCloseTo(1 / Math.sqrt(p.L * p.C)); expect(m.f0).toBeCloseTo(11253.953952);
    expect(m.beta).toBe(p.R / (2 * p.L)); expect(m.criticalResistance).toBeCloseTo(2 * Math.sqrt(p.L / p.C)); expect(m.qualityFactor).toBeCloseTo(Math.sqrt(p.L / p.C) / p.R);
    expect(m.tau).toBe(-p.R / p.L); expect(m.delta).toBeCloseTo(1 / (p.L * p.C)); expect(m.discriminant).toBeCloseTo(m.tau! ** 2 - 4 * m.delta!); expect(m.discriminant).toBeCloseTo(4 * (m.beta! ** 2 - m.omega0! ** 2));
    expect(m.omegaD).toBeCloseTo(Math.sqrt(m.omega0! ** 2 - m.beta! ** 2)); expect(m.omegaRes).toBeCloseTo(Math.sqrt(m.omega0! ** 2 - 2 * m.beta! ** 2));
  });
  it.each([[0, 'центр'], [0.5, 'устойчивая спираль'], [1, 'вырожденный устойчивый узел'], [2, 'устойчивый узел']])('R/Rcrit=%s → %s', (ratio, type) => { const m = calc({ ...p, R: Number(ratio) * calc(p).criticalResistance! }); expect(m.fixedPointType).toBe(type); expect(m.eigenvalues).toHaveLength(2); });
  it.each([{ ...p, L: 0 }, { ...p, C: 0 }, { ...p, R: -1 }, { ...p, L: NaN }])('не делит на ноль в вырожденном контуре', q => { expect(calc(q).isValidRLC).toBe(false); expect(JSON.stringify(calc(q))).not.toContain('NaN'); });
  it('не вычисляет комплексную частоту максимума', () => { expect(calc({ ...p, R: 2 * calc(p).criticalResistance! }).omegaRes).toBeNull(); });
  it('не выводит Infinity для идеального LC', () => { const m = calc({ ...p, R: 0 }); expect(m.qualityFactor).toBeNull(); expect(m.warnings.length).toBeGreaterThan(0); });
  it('использует относительный допуск около критического режима', () => { expect(calc({ ...p, R: calc(p).criticalResistance! * (1 + 1e-8) }).dampingRegime).toBe('critical'); });
});
describe('Общая классификация', () => {
  it.each([[-1,-1,'седло'],[-3,1,'устойчивый узел'],[3,1,'неустойчивый узел'],[-1,1,'устойчивая спираль'],[1,1,'неустойчивая спираль'],[0,1,'центр'],[0,0,'негиперболический случай']])('τ=%s, Δ=%s', (tau, delta, type) => expect(classifyFixedPoint(Number(tau), Number(delta))).toBe(type));
});
