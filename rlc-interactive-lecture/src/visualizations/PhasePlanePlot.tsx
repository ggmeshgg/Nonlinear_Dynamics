import type { RLCResponse } from '../math/forcedSolution';
import type { RLCParameters } from '../math/rlcParameters';
import { Plot, colors } from './Plot';
export function PhasePlanePlot({ response: r, m, hideTransient }: { response: RLCResponse; m: RLCParameters; hideTransient: boolean }) {
  const slowRate = m.dampingRegime === 'overdamped' ? -m.eigenvalues[0].real : m.beta!;
  const cutoff = slowRate > 0 ? 5 / slowRate : Infinity;
  const start = hideTransient ? r.time.findIndex(t => t >= cutoff) : 0;
  const x = start < 0 ? [] : r.current.slice(start), y = start < 0 ? [] : r.capacitorVoltage.slice(start);
  const settled = r.time.findIndex(t => t >= cutoff), idx = Math.min(x.length - 2, Math.max(1, Math.floor(x.length * 0.22)));
  const arrowEnd = Math.min(x.length - 1, idx + Math.max(8, Math.floor(x.length / 40)));
  const data: Plotly.Data[] = [{ x, y, type: 'scatter', mode: 'lines', name: 'Траектория', line: { color: colors.total, width: 2 } }, { x: [r.current[0]], y: [r.capacitorVoltage[0]], type: 'scatter', mode: 'markers', name: 't = 0', marker: { color: colors.transient, size: 9 } }];
  if (settled >= 0) data.push({ x: r.current.slice(settled), y: r.capacitorVoltage.slice(settled), type: 'scatter', mode: 'lines', name: 'После 5 времён затухания', line: { color: colors.forced, width: 3 } });
  return <Plot data={data} xTitle="Ток I, А" yTitle="Напряжение U꜀, В" layout={{ annotations: idx > 0 ? [{ x: x[arrowEnd], y: y[arrowEnd], ax: x[idx], ay: y[idx], axref: 'x', ayref: 'y', xref: 'x', yref: 'y', text: '', showarrow: true, arrowhead: 3, arrowsize: 1.5, arrowwidth: 2, arrowcolor: colors.transient }] : [] }} />;
}
