import type { RLCResponse } from '../math/forcedSolution';
import { Plot, colors } from './Plot';
export function TimeResponsePlot({ response: r, capacitance, components, envelope }: { response: RLCResponse; capacitance: number; components: boolean; envelope: boolean }) {
  const x = r.time.map(t => t * 1000);
  const data: Plotly.Data[] = [{ x, y: r.capacitorVoltage, type: 'scatter', mode: 'lines', name: 'U꜀ — полное решение', line: { color: colors.total, width: 2 } }];
  if (components) data.push({ x, y: r.transientCharge.map(q => q / capacitance), type: 'scatter', mode: 'lines', name: 'Переходная часть', line: { color: colors.transient, dash: 'dot' } }, { x, y: r.forcedCharge.map(q => q / capacitance), type: 'scatter', mode: 'lines', name: 'Вынужденная часть', line: { color: colors.forced } }, { x, y: r.sourceVoltage, type: 'scatter', mode: 'lines', name: 'Источник U(t)', line: { color: colors.source, width: 1 } });
  if (envelope) for (const sign of [-1, 1]) data.push({ x, y: r.envelopeVoltage.map(v => sign * v), type: 'scatter', mode: 'lines', name: 'Огибающая переходной части', showlegend: sign === 1, line: { color: colors.transient, dash: 'dash', width: 1 } });
  return <Plot data={data} xTitle="Время t, мс" yTitle="Напряжение U꜀, В" />;
}
