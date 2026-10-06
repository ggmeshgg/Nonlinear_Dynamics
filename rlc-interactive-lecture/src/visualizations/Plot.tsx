import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-basic-dist-min';
import type { Data, Layout } from 'plotly.js';
const PlotlyComponent = createPlotlyComponent(Plotly);
export const colors = { total: '#174a60', transient: '#b66535', forced: '#3d8b7b', source: '#9d9b98' };
export function Plot({ data, xTitle, yTitle, layout = {} }: { data: Data[]; xTitle: string; yTitle: string; layout?: Partial<Layout> }) {
  return <PlotlyComponent data={data} layout={{ autosize: true, height: 390, margin: { l: 72, r: 30, t: 24, b: 100 }, paper_bgcolor: 'transparent', plot_bgcolor: '#fff', font: { family: 'system-ui, sans-serif', size: 13, color: '#334b55' }, xaxis: { title: { text: xTitle }, gridcolor: '#e8ecee', zerolinecolor: '#ccd7dc' }, yaxis: { title: { text: yTitle }, gridcolor: '#e8ecee', zerolinecolor: '#ccd7dc' }, legend: { orientation: 'h', y: -0.23, x: 0 }, hovermode: 'closest', ...layout }} config={{ responsive: true, displaylogo: false, scrollZoom: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'], toImageButtonOptions: { format: 'svg', filename: 'rlc-plot' } }} useResizeHandler style={{ width: '100%', height: '100%' }} />;
}
