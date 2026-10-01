export type FixedPointType = 'седло' | 'устойчивый узел' | 'неустойчивый узел' | 'устойчивая спираль' | 'неустойчивая спираль' | 'центр' | 'вырожденный устойчивый узел' | 'вырожденный неустойчивый узел' | 'негиперболический случай';
export function classifyFixedPoint(tau: number, delta: number, critical = false): FixedPointType {
  if (delta < 0) return 'седло';
  if (delta === 0) return 'негиперболический случай';
  const D = tau * tau - 4 * delta;
  if (critical || Math.abs(D) / Math.max(tau * tau, 4 * delta) < 1e-12) return tau < 0 ? 'вырожденный устойчивый узел' : tau > 0 ? 'вырожденный неустойчивый узел' : 'негиперболический случай';
  if (D > 0) return tau < 0 ? 'устойчивый узел' : 'неустойчивый узел';
  return tau < 0 ? 'устойчивая спираль' : tau > 0 ? 'неустойчивая спираль' : 'центр';
}
