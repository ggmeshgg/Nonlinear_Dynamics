import { useId } from 'react';
export function ParameterSlider({ name, label, unit, value, min, max, step, onChange }: { name: string; label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  const unique = useId();
  const rangeId = name.startsWith('linked-') ? `${name}-${unique}-range` : `${name}-range`;
  const change = (v: string) => { if (v.trim() === '') return; const n = Number(v); if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n))); };
  return <div className="parameter"><div className="parameter-heading"><label htmlFor={rangeId}>{label}</label><div><input id={name.startsWith('linked-')?`${name}-${unique}-number`:`${name}-number`} aria-label={`${label}, числовое поле`} type="number" min={min} max={max} step="any" value={Number(value.toPrecision(10))} onChange={e => change(e.target.value)} /><span>{unit}</span></div></div><input id={rangeId} aria-label={`${label}, ползунок`} type="range" min={min} max={max} step={step} value={value} onChange={e => change(e.target.value)} /><div className="range-labels"><span>{min} {unit}</span><span>{max} {unit}</span></div></div>;
}
