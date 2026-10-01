import type { RLCParameters } from '../math/rlcParameters';
import { Plot, colors } from './Plot';
export function ResonancePlot({ curve, m, angular }: { curve: { frequency: number[]; amplitude: (number | null)[] }; m: RLCParameters; angular: boolean }) {
  const convert = (f: number) => angular ? 2 * Math.PI * f : f / 1000;
  const markers = [{ f: m.frequencyHz, label: 'f', color: colors.transient }, { f: m.f0!, label: 'f₀', color: colors.total }, ...(m.fRes === null ? [] : [{ f: m.fRes, label: 'fᵣₑₛ', color: colors.forced }])];
  return <Plot data={[{ x: curve.frequency.map(convert), y: curve.amplitude, type: 'scatter', mode: 'lines', name: 'Амплитуда U꜀ₘ', connectgaps: false, line: { color: colors.total, width: 2 } }]} xTitle={angular ? 'Угловая частота ω, рад/с' : 'Частота f, кГц'} yTitle="Амплитуда U꜀ₘ, В" layout={{ shapes: markers.map(({ f, color }) => ({ type: 'line', x0: convert(f), x1: convert(f), y0: 0, y1: 1, yref: 'paper', line: { color, width: 1.5, dash: 'dot' } })), annotations: markers.map(({ f, label, color }, i) => ({ x: convert(f), y: 1 - i * 0.09, yref: 'paper', text: label, font: { color }, showarrow: false, xanchor: 'left' })) }} />;
}
