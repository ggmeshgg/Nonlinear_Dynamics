export interface RLCParams { R: number; L: number; C: number; frequencyHz: number; sourceAmplitude: number }
export interface UIParams { R: number; LmH: number; CuF: number; frequencyKHz: number; sourceAmplitude: number }
export const toSI = (p: UIParams): RLCParams => ({ R: p.R, L: p.LmH * 1e-3, C: p.CuF * 1e-6, frequencyHz: p.frequencyKHz * 1e3, sourceAmplitude: p.sourceAmplitude });
export const fromSI = (p: RLCParams): UIParams => ({ R: p.R, LmH: p.L * 1e3, CuF: p.C * 1e6, frequencyKHz: p.frequencyHz / 1e3, sourceAmplitude: p.sourceAmplitude });
