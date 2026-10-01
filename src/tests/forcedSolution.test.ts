import { describe, it, expect } from 'vitest';
import { solveRLCResponse } from '../math/forcedSolution';
import { calculateRLCParameters as calc } from '../math/rlcParameters';
import { capacitorAmplitude, resonanceCurve } from '../math/resonance';
import { automaticDuration, sampleTime } from '../math/timeSampling';
import { toSI } from '../math/units';
import { defaults, presets } from '../data/presets';
const p = toSI(defaults), initial = { charge: 0.0000013, current: -0.027 };
describe('Аналитическое решение', () => {
  it.each(presets)('$name: начальные условия и уравнение Кирхгофа', preset => {
    const q = toSI(preset.params), h = 1e-9, t = 0.000013;
    const r = solveRLCResponse(q, initial, [0,t-h,t,t+h]);
    expect(r.charge[0]).toBe(initial.charge); expect(r.current[0]).toBe(initial.current);
    const dq = (r.charge[3]-r.charge[1])/(2*h), di = (r.current[3]-r.current[1])/(2*h);
    expect(dq).toBeCloseTo(r.current[2], 7);
    expect(q.L * di + q.R * r.current[2] + r.charge[2] / q.C).toBeCloseTo(r.sourceVoltage[2], 4);
  });
  it('f=0: источник постоянный, равновесие q*=CU', () => {
    const q = { ...p, frequencyHz: 0 }, r = solveRLCResponse(q, initial, [0,0.01]);
    expect(r.sourceVoltage).toEqual([10,10]); expect(r.charge[1]).toBeCloseTo(q.C * q.sourceAmplitude, 12); expect(r.current[1]).toBeCloseTo(0,12);
  });
  it('свободная система: вынужденная часть равна нулю', () => expect(solveRLCResponse({ ...p, sourceAmplitude: 0 }, initial, [0,0.001]).forcedCharge).toEqual([0,0]));
  it('точный идеальный резонанс даёт рост амплитуды и конечные числа', () => {
    const q = { ...p, R: 0, frequencyHz: calc(p).f0! }, w = calc(q).omega0!, t = 10.25 / q.frequencyHz;
    const r = solveRLCResponse(q, { charge: 0, current: 0 }, [0,t]);
    expect(r.charge[1]).toBeCloseTo(q.sourceAmplitude / q.L / (2*w) * t * Math.sin(w*t), 12);
    expect(r.charge[0]).toBe(0); expect(r.current[0]).toBe(0); expect(r.capacitorVoltage.every(Number.isFinite)).toBe(true); expect(capacitorAmplitude(q,q.frequencyHz)).toBeNull();
  });
  it('окрестность идеального резонанса устойчива к потере точности', () => {
    const q = { ...p, R: 0, frequencyHz: calc(p).f0! * (1+1e-12) };
    const a = solveRLCResponse(q,initial,[0,0.001]); const b = solveRLCResponse({ ...q, frequencyHz: calc(p).f0! },initial,[0,0.001]);
    expect(a.charge[1]).toBeCloseTo(b.charge[1],10);
  });
  it.each([{...p,L:0},{...p,C:0}])('вырожденные параметры возвращают пустые графики', q => expect(solveRLCResponse(q,initial,[0,1]).time).toEqual([]));
  it('за пределами временного домена выдаёт явную ошибку', () => expect(() => solveRLCResponse(p,initial,[-1])).toThrow(RangeError));
  it('амплитуда соответствует аналитическому решению', () => { const m = calc(p), r = solveRLCResponse(p,initial,sampleTime(m,0.005)); const tail=r.capacitorVoltage.slice(-400); expect(Math.max(...tail)).toBeCloseTo(capacitorAmplitude(p,p.frequencyHz)!,1); });
  it('сетка содержит точный максимум и частоту источника', () => { const m=calc(p), r=resonanceCurve(p,m); expect(r.frequency).toContain(m.fRes); expect(r.frequency).toContain(p.frequencyHz); expect(r.amplitude.every(x=>x===null||Number.isFinite(x))).toBe(true); });
  it('нулевой источник в идеальном резонансе не даёт 0/0', () => expect(capacitorAmplitude({...p,R:0,sourceAmplitude:0},calc(p).f0!)).toBe(0));
  it('энергия LC сохраняется', () => { const q={...p,R:0,sourceAmplitude:0}, r=solveRLCResponse(q,initial,sampleTime(calc(q),0.01)), e=initial.charge**2/(2*q.C)+q.L*initial.current**2/2; r.charge.forEach((charge,i)=>expect(charge**2/(2*q.C)+q.L*r.current[i]**2/2).toBeCloseTo(e,10)); });
  it('сетка краевых параметров остаётся конечной и ограниченной', () => {
    for(const R of [0,1,47,200]) for(const L of [0.001,0.05]) for(const C of [1e-7,1e-5]) for(const frequencyHz of [0,250,20000]) {
      const q={...p,R,L,C,frequencyHz}, m=calc(q), times=sampleTime(m,automaticDuration(m)), r=solveRLCResponse(q,initial,times);
      expect(times.length).toBeLessThanOrEqual(3000); for(const values of Object.values(r)) expect(values.every(Number.isFinite)).toBe(true);
    }
  });
});
