// Phase Plane Lab: the mathematics, kept apart from the page so it can be tested in Node.
// index.html draws and handles input; everything here is a function of the current system and parameters.
// The system is module state, set with use(model) after every rebuild; the sliders write into P.
import { ComputeEngine } from '@cortex-js/compute-engine';

const ce = new ComputeEngine();
export const P = {};                     // live parameter values passed to compiled fns
let model = null;                        // { f, g, E, used: [names], vars, ... }, from buildModel
export const use = m => { model = m; };

// ---------- expressions: LaTeX → MathJSON → plain JS function ----------

const GREEK = 'alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi rho sigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Sigma Phi Psi Omega'.split(' ');
const symTex = n => GREEK.includes(n) ? '\\' + n : n.replace(/_(\w+)/, '_{$1}');
const symHtml = n => {
  const G = { alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ϵ',varepsilon:'ε',zeta:'ζ',eta:'η',theta:'θ',vartheta:'ϑ',iota:'ι',kappa:'κ',lambda:'λ',mu:'μ',nu:'ν',xi:'ξ',rho:'ρ',sigma:'σ',tau:'τ',upsilon:'υ',phi:'ϕ',varphi:'φ',chi:'χ',psi:'ψ',omega:'ω',Gamma:'Γ',Delta:'Δ',Theta:'Θ',Lambda:'Λ',Xi:'Ξ',Sigma:'Σ',Phi:'Φ',Psi:'Ψ',Omega:'Ω' };
  const m = n.match(/^([^_]+)(?:_(.+))?$/);
  return (G[m[1]] ?? m[1]) + (m[2] ? `<sub>${m[2]}</sub>` : '');
};
// a user symbol written like a function, e.g. μ(1−x²), means multiplication
const isUserSym = h => h.length === 1 || GREEK.includes(h) || h.includes('_');

const FN1 = { Sin:'Math.sin', Cos:'Math.cos', Tan:'Math.tan', Arcsin:'Math.asin', Arccos:'Math.acos', Arctan:'Math.atan',
  Sinh:'Math.sinh', Cosh:'Math.cosh', Tanh:'Math.tanh', Arsinh:'Math.asinh', Arcosh:'Math.acosh', Artanh:'Math.atanh',
  Exp:'Math.exp', Ln:'Math.log', Sqrt:'Math.sqrt', Abs:'Math.abs', Sign:'Math.sign', Floor:'Math.floor', Ceil:'Math.ceil', Round:'Math.round' };
const CONST = { Pi:'Math.PI', ExponentialE:'Math.E', Half:'0.5', PositiveInfinity:'Infinity', NegativeInfinity:'-Infinity', NaN:'NaN' };

function toJS(e, sym) {
  if (typeof e === 'number') return `(${e})`;
  if (typeof e === 'string') return CONST[e] ?? sym(e);
  if (!Array.isArray(e)) {
    if (e && 'num' in e) return `(${parseFloat(e.num)})`;
    if (e && 'sym' in e) return toJS(e.sym, sym);
    if (e && 'fn' in e) return toJS(e.fn, sym);
    throw new Error('cannot read expression');
  }
  const [h, ...args] = e;
  const A = args.map(a => toJS(a, sym));
  switch (h) {
    case 'Add': return `(${A.join('+')})`;
    case 'Subtract': return `(${A[0]}-${A[1]})`;
    case 'Multiply': return `(${A.join('*')})`;
    case 'Negate': return `(-${A[0]})`;
    case 'Divide': case 'Rational': return `(${A[0]}/${A[1]})`;
    case 'Power': return args[0] === 'ExponentialE' ? `Math.exp(${A[1]})` : `Math.pow(${A[0]},${A[1]})`;
    case 'Square': return `Math.pow(${A[0]},2)`;
    case 'Root': return `_root(${A[0]},${A[1]})`;
    case 'Log': return A.length > 1 ? `(Math.log(${A[0]})/Math.log(${A[1]}))` : `Math.log10(${A[0]})`;
    case 'Sec': return `(1/Math.cos(${A[0]}))`;
    case 'Csc': return `(1/Math.sin(${A[0]}))`;
    case 'Cot': return `(1/Math.tan(${A[0]}))`;
    case 'Max': return `Math.max(${A.join(',')})`;
    case 'Min': return `Math.min(${A.join(',')})`;
    case 'Delimiter': return A[0];
    case 'Error': throw new Error('incomplete expression');
  }
  if (FN1[h]) return `${FN1[h]}(${A[0]})`;
  if (typeof h === 'string' && isUserSym(h)) return `(${sym(h)}*${A.join('*')})`;
  throw new Error(`unsupported: ${h}`);
}
const _root = (x, n) => (x < 0 && n % 2 === 1) ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n);

function compileLatex(latex, vars) {
  const rhs = latex.split('=').pop().trim();
  if (!rhs) return null;
  // CE infers and remembers symbol types (x(a−y) would make x a function), so isolate each parse
  ce.pushScope();
  let ex;
  try {
    for (const v of vars) ce.declare(v, 'real');
    ex = ce.parse(rhs);
    if (!ex.isValid) throw new Error('incomplete expression');
    ex = ex.json;
  } finally { ce.popScope(); }
  const params = new Set();
  const sym = n => {
    if (n === vars[0]) return 'x';
    if (n === vars[1]) return 'y';
    params.add(n);
    return `P[${JSON.stringify(n)}]`;
  };
  const code = toJS(ex, sym);
  const fn = new Function('_root', `return (x,y,P) => ${code};`)(_root);
  let poly = null, polyErr = null;
  try { poly = collect(polyOf(ex, vars)); }
  catch (e) { if (!(e instanceof NotPoly)) throw e; polyErr = e.message; }
  return { fn, params: [...params], poly, polyErr, json: ex };
}

// ---------- polynomial form, for the mass-action reaction network ----------
// a monomial is n · Π factor^pow · x^a · y^b, where factors are variable-free (parameters, or opaque subexpressions)

class NotPoly extends Error {}
const hasVar = (e, vars) => typeof e === 'string' ? vars.includes(e)
  : Array.isArray(e) ? e.some((a, i) => (i > 0 || typeof a === 'string') && hasVar(a, vars)) : false;
const numVal = e => typeof e === 'number' ? e
  : e && !Array.isArray(e) && typeof e === 'object' && 'num' in e ? parseFloat(e.num)
  : Array.isArray(e) && e[0] === 'Rational' ? numVal(e[1]) / numVal(e[2])
  : Array.isArray(e) && e[0] === 'Negate' ? -numVal(e[1]) : NaN;
const mono = (n, a = 0, b = 0, f = {}) => [{ n, a, b, f }];
const scale = (P, k) => P.map(m => ({ ...m, n: m.n * k }));
function mul(P, Q) {
  const out = [];
  for (const p of P) for (const q of Q) {
    const f = { ...p.f };
    for (const [k, w] of Object.entries(q.f)) { f[k] = (f[k] || 0) + w; if (!f[k]) delete f[k]; }
    out.push({ n: p.n * q.n, a: p.a + q.a, b: p.b + q.b, f });
  }
  return out;
}
const fkey = f => Object.keys(f).sort().map(k => `${k}^${f[k]}`).join('*');
function collect(P) {
  const m = new Map();
  for (const t of P) {
    const k = `${t.a}|${t.b}|${fkey(t.f)}`;
    if (m.has(k)) m.get(k).n += t.n; else m.set(k, { ...t, key: fkey(t.f) });
  }
  return [...m.values()].filter(t => Math.abs(t.n) > 1e-12);
}
function inv(e, vars) {
  const v = numVal(e);
  if (isFinite(v)) return mono(1 / v);
  if (Array.isArray(e) && e[0] === 'Multiply') return e.slice(1).map(a => inv(a, vars)).reduce(mul);
  if (Array.isArray(e) && e[0] === 'Power' && typeof e[1] === 'string' && isFinite(numVal(e[2]))) return mono(1, 0, 0, { [JSON.stringify(e[1])]: -numVal(e[2]) });
  return mono(1, 0, 0, { [JSON.stringify(e)]: -1 });
}
function polyOf(e, vars) {
  const v = numVal(e);
  if (isFinite(v)) return mono(v);
  if (typeof e === 'string') {
    if (e === vars[0]) return mono(1, 1, 0);
    if (e === vars[1]) return mono(1, 0, 1);
    if (e === 'Pi') return mono(Math.PI);
    if (e === 'ExponentialE') return mono(Math.E);
    return mono(1, 0, 0, { [JSON.stringify(e)]: 1 });
  }
  if (!Array.isArray(e)) throw new NotPoly('unreadable expression');
  const [h, ...A] = e;
  switch (h) {
    case 'Add': return A.flatMap(a => polyOf(a, vars));
    case 'Subtract': return [...polyOf(A[0], vars), ...scale(polyOf(A[1], vars), -1)];
    case 'Negate': return scale(polyOf(A[0], vars), -1);
    case 'Multiply': return A.map(a => polyOf(a, vars)).reduce(mul);
    case 'Delimiter': return polyOf(A[0], vars);
    case 'Divide': if (!hasVar(A[1], vars)) return mul(polyOf(A[0], vars), inv(A[1], vars)); break;
    case 'Power': {
      const p = numVal(A[1]);
      if (hasVar(A[0], vars)) {
        if (Number.isInteger(p) && p >= 0 && p <= 12) { let r = mono(1); const base = polyOf(A[0], vars); for (let k = 0; k < p; k++) r = mul(r, base); return r; }
        throw new NotPoly(p < 0 ? 'a variable appears in a denominator' : 'a variable has a non-integer power');
      }
      if (typeof A[0] === 'string' && !CONST[A[0]] && isFinite(p)) return mono(1, 0, 0, { [JSON.stringify(A[0])]: p });
      break;
    }
  }
  if (typeof h === 'string' && isUserSym(h) && !FN1[h]) return [polyOf(h, vars), ...A.map(a => polyOf(a, vars))].reduce(mul);
  if (!hasVar(e, vars)) return mono(1, 0, 0, { [JSON.stringify(e)]: 1 });
  throw new NotPoly(h === 'Divide' ? 'a variable appears in a denominator' : `${h} of a variable is not polynomial`);
}

const factorFns = {}, factorTexs = {};
const factorVal = k => (factorFns[k] ??= new Function('_root', `return P => ${toJS(JSON.parse(k), n => `P[${JSON.stringify(n)}]`)};`)(_root))(P);
function factorTex(k) {
  if (factorTexs[k]) return factorTexs[k];
  const j = JSON.parse(k);
  let t;
  if (typeof j === 'string') t = symTex(j);
  else { ce.pushScope(); try { t = ce.box(j).latex; } finally { ce.popScope(); } if (/[+\-]/.test(t.replace(/^-/, ''))) t = `\\left(${t}\\right)`; }
  return (factorTexs[k] = t);
}

// ṙ, θ̇ → ẋ = ṙ cos θ − r θ̇ sin θ, ẏ = ṙ sin θ + r θ̇ cos θ
const polarCart = (R, T) => [
  (x, y, P) => { const r = Math.hypot(x, y), t = Math.atan2(y, x); return R(r, t, P) * Math.cos(t) - r * T(r, t, P) * Math.sin(t); },
  (x, y, P) => { const r = Math.hypot(x, y), t = Math.atan2(y, x); return R(r, t, P) * Math.sin(t) + r * T(r, t, P) * Math.cos(t); },
];
const polarScalar = E => (x, y, P) => E(Math.hypot(x, y), Math.atan2(y, x), P);

// a system from right-hand sides compiled by compileLatex (E may be null); polar ones become ẋ, ẏ
function buildModel(f, g, E, vars, polar) {
  const used = new Set([...f.params, ...g.params, ...(E ? E.params : [])]);
  const m = { f: f.fn, g: g.fn, E: E ? E.fn : null, used: [...used], vars,
    polyF: f.poly, polyG: g.poly, crnErr: f.polyErr || g.polyErr, jsonF: f.json, jsonG: g.json };
  if (polar) {
    [m.f, m.g] = polarCart(f.fn, g.fn);
    m.polar = true; m.R = f.fn; m.T = g.fn;
    if (m.E) m.E = polarScalar(m.E);
  }
  return m;
}

// ---------- numerics ----------

const fx = (x, y) => model.f(x, y, P);
const gy = (x, y) => model.g(x, y, P);

function jac(x, y) {
  const h = 1e-6 * (1 + Math.abs(x) + Math.abs(y));
  return [
    (fx(x + h, y) - fx(x - h, y)) / (2 * h), (fx(x, y + h) - fx(x, y - h)) / (2 * h),
    (gy(x + h, y) - gy(x - h, y)) / (2 * h), (gy(x, y + h) - gy(x, y - h)) / (2 * h),
  ];
}

function findFixedPoints(b, n = 18, extraSeeds = []) {
  const span = Math.max(b.x1 - b.x0, b.y1 - b.y0);
  const pad = 0.25 * span, found = [];
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  // seeds: nullcline crossings first, then a jittered grid (a regular one can sit exactly on singular lines of J), nearest to the centre first
  const seeds = extraSeeds.slice();
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) seeds.push([
    b.x0 - pad + (b.x1 - b.x0 + 2 * pad) * (i + 0.5 + 0.1 * Math.sin(1.7 * j)) / (n + 1),
    b.y0 - pad + (b.y1 - b.y0 + 2 * pad) * (j + 0.5 + 0.1 * Math.cos(2.3 * i)) / (n + 1)]);
  seeds.sort((p, q) => Math.hypot(p[0] - cx, p[1] - cy) - Math.hypot(q[0] - cx, q[1] - cy));
  for (const seed of seeds) {
    if (found.length >= 200) break;
    let [x, y] = seed;
    let F0 = fx(x, y), G0 = gy(x, y), r0 = Math.hypot(F0, G0), ok = false;
    // run to the step floor rather than a residual: at a degenerate root the residual is ~x², so stopping at 1e-12 leaves x ≈ 1e-6 and a fake Δ
    for (let it = 0; it < 80 && isFinite(r0); it++) {
      if (r0 === 0) { ok = true; break; }
      const [a, bb, c, d] = jac(x, y), det = a * d - bb * c;
      if (!isFinite(det) || Math.abs(det) < 1e-300) { ok = r0 < 1e-10; break; }
      let dx = (d * F0 - bb * G0) / det, dy = (-c * F0 + a * G0) / det, lam = 1, nx, ny, F1, G1, r1;
      for (let k = 0; k < 8; k++, lam /= 2) {
        nx = x - lam * dx; ny = y - lam * dy; F1 = fx(nx, ny); G1 = gy(nx, ny); r1 = Math.hypot(F1, G1);
        if (r1 < r0) break;
      }
      const stepLen = lam * Math.hypot(dx, dy);
      x = nx; y = ny; F0 = F1; G0 = G1; r0 = r1;
      if (stepLen < 1e-13 * (1 + Math.abs(x) + Math.abs(y))) { ok = r0 < 1e-8; break; }
    }
    if (!ok && isFinite(r0) && r0 < 1e-10) ok = true;   // slow (linear) convergence at a multiple root, close enough
    if (!ok || !isFinite(x) || !isFinite(y)) continue;
    if (x < b.x0 - pad || x > b.x1 + pad || y < b.y0 - pad || y > b.y1 + pad) continue;
    if (found.some(p => Math.hypot(p.x - x, p.y - y) < 1e-5 * span)) continue;
    found.push({ x, y, inView: x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 });
  }
  const fps = found.map(classify);
  if (model.polar) for (const p of fps) if (Math.hypot(p.x, p.y) < 1e-6 * span) polarOrigin(p, span);
  return fps;
}

// a polar system whose θ̇ depends on θ is not C¹ at the origin, so the Jacobian there means nothing;
// the sign of ṙ on a small circle still says whether the origin attracts or repels
function polarOrigin(p, span) {
  const r = 1e-3 * span, R = model.R, T = model.T;
  let tMin = Infinity, tMax = -Infinity, rMin = Infinity, rMax = -Infinity;
  for (let q = 0; q < 64; q++) {
    const th = q * Math.PI / 32, tv = T(r, th, P), rv = R(r, th, P);
    tMin = Math.min(tMin, tv); tMax = Math.max(tMax, tv); rMin = Math.min(rMin, rv); rMax = Math.max(rMax, rv);
  }
  if (!isFinite(tMin) || !isFinite(tMax) || tMax - tMin <= 1e-9 * (1 + Math.abs(tMax))) return;
  p.tau = p.det = p.disc = NaN; p.eig = null; p.vecs = null;
  if (rMin > 0) { p.type = 'repeller (non-smooth)'; p.stab = 'unstable'; }
  else if (rMax < 0) { p.type = 'attractor (non-smooth)'; p.stab = 'stable'; }
  else { p.type = 'degenerate'; p.stab = 'degen'; }
  p.note = 'θ̇ depends on θ: the field is not C¹ at the origin, so there is no linearization; classified by the sign of ṙ near r = 0';
}

function classify({ x, y, inView = true }) {
  const J = jac(x, y), [a, b, c, d] = J;
  const tau = a + d, det = a * d - b * c, disc = tau * tau - 4 * det;
  const sc = Math.abs(a) + Math.abs(b) + Math.abs(c) + Math.abs(d) + 1e-12;
  const p = { x, y, J, tau, det, disc, inView };
  const zero = v => Math.abs(v) < 1e-7 * sc;
  if (Math.abs(det) < 1e-7 * sc * sc) { p.type = 'degenerate'; p.stab = 'degen'; p.note = 'Δ = 0: linearization inconclusive'; }
  else if (det < 0) { p.type = 'saddle'; p.stab = 'saddle'; }
  else if (zero(tau)) { p.type = 'linear center'; p.stab = 'center'; p.note = 'τ = 0: nonlinear terms decide'; }
  else {
    const st = tau < 0 ? 'stable' : 'unstable';
    p.stab = st;
    p.type = Math.abs(disc) < 1e-7 * sc * sc ? `degenerate ${st} node` : disc > 0 ? `${st} node` : `${st} spiral`;
  }
  if (disc >= 0) {
    const s = Math.sqrt(disc);
    p.eig = [(tau - s) / 2, (tau + s) / 2];
    p.vecs = p.eig.map(l => {
      let v = Math.abs(b) > Math.abs(c) ? [b, l - a] : [l - d, c];
      if (Math.hypot(...v) < 1e-14) v = Math.abs(l - a) < 1e-12 ? [1, 0] : [0, 1];
      const n = Math.hypot(...v); return [v[0] / n, v[1] / n];
    });
  } else {
    const im = Math.sqrt(-disc) / 2;
    p.eig = [[tau / 2, -im], [tau / 2, im]];
  }
  return p;
}

// Dormand–Prince 5(4) with a cap on spatial step so curves stay smooth on screen
function integrateDP(x, y, dir, opt) {
  const { box, maxSteps, maxDist, tol, stopSpeed } = opt;
  const pts = [x, y], sx = x, sy = y;
  let h = 0.01, t = 0, left = false;
  if (opt.times) opt.times.push(0);
  for (let n = 0, tries = 0; n < maxSteps && tries < maxSteps * 3; tries++) {
    const k1x = dir * fx(x, y), k1y = dir * gy(x, y), sp = Math.hypot(k1x, k1y);
    if (!(sp > stopSpeed)) break;
    h = Math.min(h, maxDist / sp);
    const k2x = dir * fx(x + h * k1x / 5, y + h * k1y / 5), k2y = dir * gy(x + h * k1x / 5, y + h * k1y / 5);
    const x3 = x + h * (3 * k1x + 9 * k2x) / 40, y3 = y + h * (3 * k1y + 9 * k2y) / 40;
    const k3x = dir * fx(x3, y3), k3y = dir * gy(x3, y3);
    const x4 = x + h * (44 / 45 * k1x - 56 / 15 * k2x + 32 / 9 * k3x), y4 = y + h * (44 / 45 * k1y - 56 / 15 * k2y + 32 / 9 * k3y);
    const k4x = dir * fx(x4, y4), k4y = dir * gy(x4, y4);
    const x5 = x + h * (19372 / 6561 * k1x - 25360 / 2187 * k2x + 64448 / 6561 * k3x - 212 / 729 * k4x);
    const y5 = y + h * (19372 / 6561 * k1y - 25360 / 2187 * k2y + 64448 / 6561 * k3y - 212 / 729 * k4y);
    const k5x = dir * fx(x5, y5), k5y = dir * gy(x5, y5);
    const x6 = x + h * (9017 / 3168 * k1x - 355 / 33 * k2x + 46732 / 5247 * k3x + 49 / 176 * k4x - 5103 / 18656 * k5x);
    const y6 = y + h * (9017 / 3168 * k1y - 355 / 33 * k2y + 46732 / 5247 * k3y + 49 / 176 * k4y - 5103 / 18656 * k5y);
    const k6x = dir * fx(x6, y6), k6y = dir * gy(x6, y6);
    const nx = x + h * (35 / 384 * k1x + 500 / 1113 * k3x + 125 / 192 * k4x - 2187 / 6784 * k5x + 11 / 84 * k6x);
    const ny = y + h * (35 / 384 * k1y + 500 / 1113 * k3y + 125 / 192 * k4y - 2187 / 6784 * k5y + 11 / 84 * k6y);
    const k7x = dir * fx(nx, ny), k7y = dir * gy(nx, ny);
    const ex = h * (71 / 57600 * k1x - 71 / 16695 * k3x + 71 / 1920 * k4x - 17253 / 339200 * k5x + 22 / 525 * k6x - 1 / 40 * k7x);
    const ey = h * (71 / 57600 * k1y - 71 / 16695 * k3y + 71 / 1920 * k4y - 17253 / 339200 * k5y + 22 / 525 * k6y - 1 / 40 * k7y);
    const err = Math.hypot(ex, ey);
    if (!isFinite(err)) { h /= 4; if (h < 1e-12) break; continue; }
    if (err <= tol || h < 1e-10) {
      x = nx; y = ny; t += h; n++;
      pts.push(x, y);
      if (opt.times) opt.times.push(t);
      if (x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1) break;
      if (opt.stop && opt.stop(x, y, t)) break;
      if (!opt.noClose && closes(x, y, sx, sy, maxDist, () => left = true, left)) { pts.push(sx, sy); break; }
    }
    h *= Math.min(5, Math.max(0.2, 0.9 * Math.pow(tol / (err || 1e-300), 0.2)));
  }
  return pts;
}

// implicit midpoint: symplectic, so orbits of Hamiltonian systems stay closed
function integrateIM(x, y, dir, opt) {
  const { box, maxSteps, maxDist, stopSpeed } = opt;
  const pts = [x, y], sx = x, sy = y;
  let left = false;
  for (let n = 0; n < maxSteps; n++) {
    const F = fx(x, y), G = gy(x, y), sp = Math.hypot(F, G);
    if (!(sp > stopSpeed)) break;
    const J = jac(x, y), Jn = Math.abs(J[0]) + Math.abs(J[1]) + Math.abs(J[2]) + Math.abs(J[3]);
    const h = dir * Math.min(1, 0.25 / (Jn + 1e-12), Math.max(1e-5, maxDist / sp));
    let X = x + h * F, Y = y + h * G;
    for (let k = 0; k < 8; k++) {
      const mx = (x + X) / 2, my = (y + Y) / 2;
      X = x + h * fx(mx, my); Y = y + h * gy(mx, my);
    }
    if (!isFinite(X) || !isFinite(Y)) break;
    x = X; y = Y; pts.push(x, y);
    if (x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1) break;
    if (closes(x, y, sx, sy, maxDist, () => left = true, left)) { pts.push(sx, sy); break; }
  }
  return pts;
}

// a trajectory for display in the window b, where one screen pixel is `px` world units.
// `closed`: orbits are known to be closed curves (Hamiltonian, or E conserved), so a returning trajectory is snapped
// shut; that is only honest for level sets, a slow spiral would be drawn as a closed loop.
// `symplectic`: the system is Hamiltonian, so use the implicit midpoint rule.
function trajectory(x, y, dir, maxSteps, b, px, { closed = false, symplectic = false } = {}) {
  const span = Math.max(b.x1 - b.x0, b.y1 - b.y0);
  const opt = {
    box: { x0: b.x0 - span, x1: b.x1 + span, y0: b.y0 - span, y1: b.y1 + span },
    maxSteps, maxDist: 2.5 * px, tol: 1e-6 * span, stopSpeed: 1e-7 * span, noClose: !closed,
  };
  return (symplectic ? integrateIM : integrateDP)(x, y, dir, opt);
}

function closes(x, y, sx, sy, maxDist, markLeft, left) {
  const d = Math.hypot(x - sx, y - sy);
  if (!left) { if (d > 6 * maxDist) markLeft(); return false; }
  return d < 0.8 * maxDist;
}

// ---------- grids & contours ----------

// nx × ny samples of fn over the window b (fn null: an empty grid to fill)
function sampleGrid(fn, b, nx, ny) {
  const xs = new Float64Array(nx), ys = new Float64Array(ny), v = new Float64Array(nx * ny);
  for (let i = 0; i < nx; i++) xs[i] = b.x0 + (b.x1 - b.x0) * i / (nx - 1);
  for (let j = 0; j < ny; j++) ys[j] = b.y0 + (b.y1 - b.y0) * j / (ny - 1);
  if (fn) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = fn(xs[i], ys[j]);
  return { nx, ny, xs, ys, v };
}

// marching squares; `fn` (optional) rejects false crossings at poles/discontinuities
function contour(G, level, fn) {
  const { nx, ny, xs, ys, v } = G, segs = [];
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const c = [v[j * nx + i] - level, v[j * nx + i + 1] - level, v[(j + 1) * nx + i + 1] - level, v[(j + 1) * nx + i] - level];
    if (!(isFinite(c[0]) && isFinite(c[1]) && isFinite(c[2]) && isFinite(c[3]))) continue;
    const s = c.map(q => q > 0);
    if (s[0] === s[1] && s[1] === s[2] && s[2] === s[3]) continue;
    const P4 = [[xs[i], ys[j]], [xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]], [xs[i], ys[j + 1]]];
    const pts = [];
    for (let e = 0; e < 4; e++) {
      const a = e, b = (e + 1) % 4;
      if (s[a] !== s[b]) {
        const t = c[a] / (c[a] - c[b]);
        pts[e] = [P4[a][0] + t * (P4[b][0] - P4[a][0]), P4[a][1] + t * (P4[b][1] - P4[a][1])];
      }
    }
    const e = pts.map((p, k) => p ? k : -1).filter(k => k >= 0);
    let pairs;
    if (e.length === 2) pairs = [[e[0], e[1]]];
    else {
      const center = (c[0] + c[1] + c[2] + c[3]) / 4 > 0;
      pairs = center === s[0] ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]];
    }
    const mag = Math.max(...c.map(Math.abs));
    for (const [p, q] of pairs) {
      const A = pts[p], B = pts[q];
      if (fn) {
        const mid = fn((A[0] + B[0]) / 2, (A[1] + B[1]) / 2) - level;
        if (!(Math.abs(mid) <= 0.5 * mag)) continue;
      }
      segs.push(A[0], A[1], B[0], B[1]);
    }
  }
  return segs;
}

function interpGrid(G, x, y) {
  const { nx, ny, xs, ys, v } = G;
  const fi = (x - xs[0]) / (xs[nx - 1] - xs[0]) * (nx - 1), fj = (y - ys[0]) / (ys[ny - 1] - ys[0]) * (ny - 1);
  if (fi < 0 || fj < 0 || fi > nx - 1 || fj > ny - 1) return NaN;
  const i = Math.min(nx - 2, Math.floor(fi)), j = Math.min(ny - 2, Math.floor(fj)), a = fi - i, b = fj - j;
  return (1 - a) * (1 - b) * v[j * nx + i] + a * (1 - b) * v[j * nx + i + 1] + a * b * v[(j + 1) * nx + i + 1] + (1 - a) * b * v[(j + 1) * nx + i];
}

// intersections of two marching-squares segment sets built on the same grid (bucketed by cell)
function crossings(S1, S2, G) {
  const dx = G.xs[1] - G.xs[0], dy = G.ys[1] - G.ys[0], x0 = G.xs[0], y0 = G.ys[0];
  const key = (x, y) => Math.floor((x - x0) / dx) * 100003 + Math.floor((y - y0) / dy);
  const cells = new Map();
  for (let k = 0; k < S2.length; k += 4) {
    const kk = key((S2[k] + S2[k + 2]) / 2, (S2[k + 1] + S2[k + 3]) / 2);
    if (!cells.has(kk)) cells.set(kk, []);
    cells.get(kk).push(k);
  }
  const out = [];
  for (let k = 0; k < S1.length && out.length < 400; k += 4) {
    const list = cells.get(key((S1[k] + S1[k + 2]) / 2, (S1[k + 1] + S1[k + 3]) / 2));
    if (!list) continue;
    const ax = S1[k], ay = S1[k + 1], bx = S1[k + 2] - ax, by = S1[k + 3] - ay;
    for (const m of list) {
      const cx = S2[m], cy = S2[m + 1], ex = S2[m + 2] - cx, ey = S2[m + 3] - cy;
      const den = bx * ey - by * ex;
      if (Math.abs(den) < 1e-300) continue;
      const t = ((cx - ax) * ey - (cy - ay) * ex) / den, u = ((cx - ax) * by - (cy - ay) * bx) / den;
      if (t >= -0.05 && t <= 1.05 && u >= -0.05 && u <= 1.05) out.push([ax + t * bx, ay + t * by]);
    }
  }
  return out;
}

// H with ∂H/∂y = f, ∂H/∂x = −g, by trapezoid line integrals from the bottom-left corner
function hamiltonianGrid(G) {
  const { nx, ny, xs, ys, v } = G;
  const gRow = new Float64Array(nx);
  for (let i = 0; i < nx; i++) gRow[i] = gy(xs[i], ys[0]);
  for (let i = 1; i < nx; i++) v[i] = v[i - 1] - 0.5 * (xs[i] - xs[i - 1]) * (gRow[i - 1] + gRow[i]);
  for (let i = 0; i < nx; i++) {
    let prev = fx(xs[i], ys[0]);
    for (let j = 1; j < ny; j++) {
      const cur = fx(xs[i], ys[j]);
      v[j * nx + i] = v[(j - 1) * nx + i] + 0.5 * (ys[j] - ys[j - 1]) * (prev + cur);
      prev = cur;
    }
  }
  return G;
}

function samplePoints(b, n) {
  const out = [];
  let s = 12345;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < n; k++) out.push([b.x0 + (b.x1 - b.x0) * rnd(), b.y0 + (b.y1 - b.y0) * rnd()]);
  return out;
}

// div f as a closed form, differentiated by the Compute Engine; null when it cannot be formed
function symbolicDiv() {
  const vars = model.vars;
  try {
    let d;
    ce.pushScope();
    try {
      for (const v of vars) ce.declare(v, 'real');
      const F = ce.box(model.jsonF), G = ce.box(model.jsonG);
      // polar: div = (1/r) ∂(r ṙ)/∂r + ∂θ̇/∂θ  (the angular velocity component is r θ̇)
      d = model.polar
        ? ce.box(['Add', ['Divide', ['D', ['Multiply', vars[0], F], vars[0]], vars[0]], ['D', G, vars[1]]])
        : ce.box(['Add', ['D', F, vars[0]], ['D', G, vars[1]]]);
      d = d.evaluate().simplify();
      if (!d.isValid) return null;
      d = d.json;
    } finally { ce.popScope(); }
    if (d === 0 || (d && d.num === '0')) return { zero: true };
    const code = toJS(d, n => n === vars[0] ? 'x' : n === vars[1] ? 'y' : `P[${JSON.stringify(n)}]`);
    let fn = new Function('_root', `return (x,y,P) => ${code};`)(_root);
    if (model.polar) { const f0 = fn; fn = (x, y, P) => f0(Math.hypot(x, y), Math.atan2(y, x), P); }
    return { zero: false, fn };
  } catch { return null; }
}

function detectStructure(b) {
  const pts = samplePoints(b, 300);
  let divMax = 0, scMax = 0, rY = 0, rX = 0, finite = 0;
  for (const [x, y] of pts) {
    const J = jac(x, y);
    if (!J.every(isFinite)) continue;
    finite++;
    divMax = Math.max(divMax, Math.abs(J[0] + J[3]));
    scMax = Math.max(scMax, Math.abs(J[0]) + Math.abs(J[1]) + Math.abs(J[2]) + Math.abs(J[3]));
    const f = fx(x, y), g = gy(x, y), m = Math.abs(f) + Math.abs(g) + 1e-12;
    const a = (Math.abs(fx(x, -y) + f) + Math.abs(gy(x, -y) - g)) / m;
    const c = (Math.abs(fx(-x, y) - f) + Math.abs(gy(-x, y) + g)) / m;
    if (isFinite(a)) rY = Math.max(rY, a); else rY = Infinity;
    if (isFinite(c)) rX = Math.max(rX, c); else rX = Infinity;
  }
  // Hamiltonian ⇔ div f ≡ 0. Prefer the closed form: finite differences cannot tell weak damping from zero in a stiff system.
  const sd = symbolicDiv();
  let hamiltonian, divNote;
  if (sd && sd.zero) { hamiltonian = true; divNote = 'div f ≡ 0 identically'; }
  else if (sd) {
    let m = 0, cnt = 0;
    for (const [x, y] of pts) { const v = sd.fn(x, y, P); if (isFinite(v)) { m = Math.max(m, Math.abs(v)); cnt++; } }
    hamiltonian = cnt > 50 && m <= 1e-12 * (scMax + 1e-12);
    divNote = hamiltonian ? 'div f = 0 at these parameter values' : `max |div f| = ${fmt(m)} in view`;
  } else {
    hamiltonian = finite > 50 && divMax < 1e-8 * (scMax + 1e-12);
    divNote = hamiltonian ? '|div f| < 10⁻⁸ relative, by finite differences' : `max |div f| ≈ ${fmt(divMax)} in view (finite differences)`;
  }
  const res = { hamiltonian, divNote, revY: finite > 50 && rY < 1e-8, revX: finite > 50 && rX < 1e-8 };
  if (model.E) {
    const E = model.E;
    let worst = 0, pos = 0, neg = 0, n = 0;
    for (const [x, y] of pts) {
      const h = 1e-6 * (1 + Math.abs(x) + Math.abs(y));
      const Ex = (E(x + h, y, P) - E(x - h, y, P)) / (2 * h), Ey = (E(x, y + h, P) - E(x, y - h, P)) / (2 * h);
      const f = fx(x, y), g = gy(x, y), d = Ex * f + Ey * g;
      if (!isFinite(d)) continue;
      n++;
      const rel = Math.abs(d) / (Math.hypot(Ex, Ey) * Math.hypot(f, g) + 1e-12);
      worst = Math.max(worst, rel);
      if (rel > 1e-5) { if (d > 0) pos++; else neg++; }
    }
    res.E = { conserved: n > 20 && worst < 1e-5, pos, neg, n };
  }
  return res;
}

// why a linear center is a true center, from the structure st found by detectStructure; null if nothing justifies it
function centerReason(p, st, b) {
  const rad = Math.min(b.x1 - b.x0, b.y1 - b.y0) / 2;
  if (st.hamiltonian) return 'Hamiltonian (div = 0)';
  if (st.revY && Math.abs(p.y) < 1e-6 * rad) return 'reversible, on symmetry line';
  if (st.revX && Math.abs(p.x) < 1e-6 * rad) return 'reversible, on symmetry line';
  if (st.E && st.E.conserved) {
    const E = model.E, h = 1e-4 * (1 + Math.abs(p.x) + Math.abs(p.y)), e0 = E(p.x, p.y, P);
    const exx = (E(p.x + h, p.y, P) - 2 * e0 + E(p.x - h, p.y, P)) / (h * h);
    const eyy = (E(p.x, p.y + h, P) - 2 * e0 + E(p.x, p.y - h, P)) / (h * h);
    const exy = (E(p.x + h, p.y + h, P) - E(p.x + h, p.y - h, P) - E(p.x - h, p.y + h, P) + E(p.x - h, p.y - h, P)) / (4 * h * h);
    if (exx * eyy - exy * exy > 1e-9 * (exx * exx + eyy * eyy)) return 'E conserved, local extremum';
  }
  return null;
}

// fixed points in the window b, Newton seeded from the crossings of the nullclines sampled on an nx × ny grid
// (every fixed point in view is such a crossing); linear centers upgraded where the structure st justifies it
function equilibria(b, nx, ny, st) {
  const Gf = sampleGrid(fx, b, nx, ny), Gg = sampleGrid(gy, b, nx, ny);
  const ncf = contour(Gf, 0, fx), ncg = contour(Gg, 0, gy);
  const fps = findFixedPoints(b, 18, crossings(ncf, ncg, Gf));
  for (const p of fps) if (p.stab === 'center') {
    const why = centerReason(p, st, b);
    if (why) { p.type = 'nonlinear center'; p.note = why; }
  }
  return { fps, ncf, ncg };
}

// ---------- mass-action reaction network ----------
// Hárs–Tóth: a polynomial system is realizable iff every negative term in ẋ contains x (and likewise for y).
// Signs of parameter-dependent coefficients come from the current slider values.

function buildCRN() {
  if (model.polar) return { err: 'Reaction networks are read from the ẋ, ẏ form; switch the equation form to check one.' };
  if (model.crnErr) return { err: `Not a polynomial system: ${model.crnErr}.` };
  const groups = new Map();
  [model.polyF, model.polyG].forEach((poly, i) => {
    for (const m of poly) {
      const k = `${m.a}|${m.b}|${m.key}`;
      if (!groups.has(k)) groups.set(k, { a: m.a, b: m.b, f: m.f, c: [0, 0] });
      groups.get(k).c[i] += m.n;
    }
  });
  const rx = [], bad = [];
  for (const g of groups.values()) {
    const F = Object.entries(g.f).reduce((acc, [k, p]) => acc * Math.pow(factorVal(k), p), 1);
    if (!isFinite(F)) return { err: 'A coefficient is undefined at these parameter values.' };
    const v = g.c.map(c => c * F);
    if (Math.abs(v[0]) < 1e-12 && Math.abs(v[1]) < 1e-12) continue;
    const merged = mergeReaction(g, v);
    if (merged) { rx.push(merged); continue; }
    for (const i of [0, 1]) {
      if (Math.abs(v[i]) < 1e-12) continue;
      const r = [g.a, g.b], p = [g.a, g.b];
      p[i] += Math.sign(v[i]);
      if (p[i] < 0) { bad.push(i); continue; }
      rx.push({ r, p, num: g.c[i] / Math.sign(v[i]), f: g.f });
    }
  }
  if (bad.length) {
    const i = bad[0], n = symHtml(model.vars[i]);
    return { err: `No mass-action network: the ${n}&#775; equation has a negative term without ${n} (a negative cross-effect).` };
  }
  rx.sort((A, B) => (A.r[0] + A.r[1]) - (B.r[0] + B.r[1]) || B.r[0] - A.r[0]);
  return { rx };
}

// one reaction for a monomial shared by both equations, when the coefficients are in a small integer ratio
function mergeReaction(g, v) {
  if (Math.abs(v[0]) < 1e-12 || Math.abs(v[1]) < 1e-12) return null;
  const ratio = g.c[0] / g.c[1];
  for (let q = 1; q <= 6; q++) {
    const p = Math.round(ratio * q);
    if (!p || Math.abs(p) > 6 || Math.abs(p / q - ratio) > 1e-9 * Math.abs(ratio)) continue;
    const d = v[0] / p > 0 ? [p, q] : [-p, -q];
    const prod = [g.a + d[0], g.b + d[1]];
    if (prod[0] < 0 || prod[1] < 0) return null;
    return { r: [g.a, g.b], p: prod, num: g.c[0] / d[0], f: g.f };
  }
  return null;
}

const fmt = v => { if (!isFinite(v)) return String(v); if (Math.abs(v) < 1e-9) return '0'; return String(+v.toPrecision(3)); };

// ---------- bifurcation diagram ----------
// Sweep one parameter over a range. At each value: fixed points (Newton from a grid over the window), classified;
// branches are linked by nearest neighbour between consecutive values. Stable limit cycles: long forward
// integration, then a Poincaré return map. Polar systems with θ-independent ṙ get exact cycle radii (roots of ṙ).
// `coord` is the plotted coordinate: 'x', 'y' or 'r'.

const project = (coord, x, y) => coord === 'x' ? x : coord === 'y' ? y : Math.hypot(x, y);

// a sweep of `name` over [min, max] in the window box: sample(i) fills the i-th of N values, finish() links branches
function bifSweep(name, min, max, box, { N = 241, coord = 'x', cycles = true, conservative = false } = {}) {
  const span = Math.max(box.x1 - box.x0, box.y1 - box.y0);
  const padX = 0.05 * (box.x1 - box.x0), padY = 0.05 * (box.y1 - box.y0);
  const inBox = q => q.x > box.x0 - padX && q.x < box.x1 + padX && q.y > box.y0 - padY && q.y < box.y1 + padY;
  const polarCycles = cycles ? polarCycleFn(coord) : null;
  // closed orbits of a center's family are not limit cycles: with `conservative` set, do not go looking
  const d = { name, min, max, N, mus: [], fps: [], cyc: [], segs: null, marks: [], box, span, done: false, conservative };
  const sample = i => {
    const mu = min + (max - min) * i / (N - 1), saved = P[name];
    P[name] = mu;
    try {
      const fps = findFixedPoints(box, 12).filter(inBox);
      d.mus[i] = mu; d.fps[i] = fps;
      d.cyc[i] = !cycles || conservative ? [] : polarCycles ? polarCycles(box) : i % 2 === 0 ? findCycles(box, fps, coord) : [];
    } finally { P[name] = saved; }
  };
  const finish = () => { linkBranches(d, coord); d.done = true; };
  return { d, sample, finish };
}

function findCycles(box, fps, coord) {
  const span = Math.max(box.x1 - box.x0, box.y1 - box.y0), w = box.x1 - box.x0, h = box.y1 - box.y0;
  const seeds = fps.filter(q => q.stab === 'unstable').map(q => [q.x + 0.013 * span, q.y + 0.007 * span]);
  seeds.push([box.x0 + 0.27 * w, box.y0 + 0.71 * h], [box.x0 + 0.79 * w, box.y0 + 0.31 * h]);
  const opt = {
    box: { x0: box.x0 - span, x1: box.x1 + span, y0: box.y0 - span, y1: box.y1 + span },
    maxSteps: 2500, maxDist: 0.01 * span, tol: 1e-6 * span, stopSpeed: 1e-5 * span, noClose: true,
  };
  const out = [];
  for (const [sx, sy] of seeds) {
    const pts = integrateDP(sx, sy, 1, opt), n = pts.length / 2;
    if (n < 400) continue;
    const ex = pts[pts.length - 2], ey = pts[pts.length - 1];
    if (ex < opt.box.x0 || ex > opt.box.x1 || ey < opt.box.y0 || ey > opt.box.y1) continue;
    const range = (a, b) => {
      let lo = Infinity, hi = -Infinity;
      for (let k = a; k < b; k++) { const c = project(coord, pts[2 * k], pts[2 * k + 1]); if (c < lo) lo = c; if (c > hi) hi = c; }
      return [lo, hi];
    };
    const k0 = Math.floor(0.6 * n), k1 = Math.floor(0.8 * n), A = range(k0, k1), B = range(k1, n);
    const tol = 0.02 * (B[1] - B[0]) + 1e-4 * span;
    if (Math.abs(A[0] - B[0]) > tol || Math.abs(A[1] - B[1]) > tol) continue;   // still transient
    let xr = [Infinity, -Infinity], yr = [Infinity, -Infinity];
    for (let k = k1; k < n; k++) { const x = pts[2 * k], y = pts[2 * k + 1]; xr = [Math.min(xr[0], x), Math.max(xr[1], x)]; yr = [Math.min(yr[0], y), Math.max(yr[1], y)]; }
    const size = Math.max(xr[1] - xr[0], yr[1] - yr[0]);
    if (size < 2e-3 * span) continue;                                           // collapsed onto a point
    // one exact period from the tail's end, then the Poincaré return map on both sides of the orbit:
    // a point displaced by δ comes back displaced by δ' with |δ'/δ| = Floquet multiplier. A centre's family returns
    // to the same orbit (ratio 1); an attracting cycle pulls both sides in (ratio clearly below 1).
    const loop = returnLoop(ex, ey, opt, size);
    if (!loop) continue;
    const { p, t, sec } = loop, nx = -sec.vy, ny = sec.vx, del = 0.05 * size;
    let mult = 0;
    for (const sg of [1, -1]) {
      const r = returnLoop(ex + sg * del * nx, ey + sg * del * ny, opt, size, sec);
      if (!r) { mult = Infinity; break; }
      const X = r.p[r.p.length - 2], Y = r.p[r.p.length - 1];
      mult = Math.max(mult, ((X - ex) * nx + (Y - ey) * ny) / (sg * del));
    }
    if (!(mult < 0.9)) continue;                                                // not clearly attracting: a centre's family, or too close to a Hopf point
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < t.length; k++) { const c = project(coord, p[2 * k], p[2 * k + 1]); if (c < lo) lo = c; if (c > hi) hi = c; }
    if (!out.some(c => Math.abs(c.lo - lo) < tol && Math.abs(c.hi - hi) < tol)) out.push({ lo, hi, stable: true, period: t[t.length - 1], mult });
  }
  return out;
}

// integrate from (x, y) until the orbit first comes back through the transverse section `sec`
// (default: the section through (x, y) itself); returns points, times and the section
function returnLoop(x, y, opt, size, sec) {
  if (!sec) {
    const f0 = fx(x, y), g0 = gy(x, y), sp = Math.hypot(f0, g0);
    if (!(sp > 0)) return null;
    sec = { ox: x, oy: y, vx: f0 / sp, vy: g0 / sp };
  }
  const { ox, oy, vx, vy } = sec, times = [];
  let left = false, sPrev = 0, hit = false, frac = 1;
  const pts = integrateDP(x, y, 1, { ...opt, maxSteps: 3000, times, stop: (X, Y) => {
    const dx = X - ox, dy = Y - oy, s = dx * vx + dy * vy;
    if (!left) { if (Math.hypot(dx, dy) > 6 * opt.maxDist) left = true; sPrev = s; return false; }
    const cross = sPrev < 0 && s >= 0 && Math.abs(dy * vx - dx * vy) < 0.3 * size;
    if (cross) { hit = true; frac = sPrev / (sPrev - s); }   // where in the last step the section was crossed
    sPrev = s;
    return cross;
  } });
  if (!hit || times.length < 20) return null;
  // cut the last step at the crossing: an overshoot of one step adds div·Δt to the integral, enough to fake a multiplier
  const n = times.length, ax = pts[2 * n - 4], ay = pts[2 * n - 3];
  pts[2 * n - 2] = ax + frac * (pts[2 * n - 2] - ax); pts[2 * n - 1] = ay + frac * (pts[2 * n - 1] - ay);
  times[n - 1] = times[n - 2] + frac * (times[n - 1] - times[n - 2]);
  return { p: pts, t: times, sec };
}

function polarCycleFn(coord) {
  if (!model.polar) return null;
  const R = model.R;
  for (const r of [0.3, 0.7, 1.3]) {
    const a = R(r, 0, P);
    for (const t of [1, 2.5, 4]) if (!(Math.abs(R(r, t, P) - a) <= 1e-9 * (1 + Math.abs(a)))) return null;
  }
  return box => {
    const rmax = Math.max(...[[box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1]].map(([x, y]) => Math.hypot(x, y)));
    const out = [], n = 400;
    let r0 = rmax * 1e-3, v0 = R(r0, 0, P);
    for (let k = 1; k <= n; k++) {
      const r1 = rmax * k / n, v1 = R(r1, 0, P);
      if (isFinite(v0) && isFinite(v1) && v0 * v1 < 0) {
        let a = r0, b = r1, fa = v0;
        for (let it = 0; it < 50; it++) { const m = (a + b) / 2, fm = R(m, 0, P); if (fa * fm <= 0) b = m; else { a = m; fa = fm; } }
        const rs = (a + b) / 2, hh = 1e-6 * (1 + rs), slope = R(rs + hh, 0, P) - R(rs - hh, 0, P);
        // if θ̇ vanishes somewhere on the circle it carries fixed points: an invariant circle, not a limit cycle
        let sg = 0, rotates = true;
        for (let q = 0; q < 64 && rotates; q++) { const sq = Math.sign(model.T(rs, q * Math.PI / 32, P)); if (!sq || (sg && sq !== sg)) rotates = false; sg = sq; }
        if (rotates) out.push(coord === 'r' ? { lo: rs, hi: rs, stable: slope < 0 } : { lo: -rs, hi: rs, stable: slope < 0 });
      }
      r0 = r1; v0 = v1;
    }
    return out;
  };
}

function linkBranches(d, coord) {
  const segs = [], marks = [], tol = 0.05 * d.span, b = d.box;
  const inner = q => q.x > b.x0 + 0.03 * (b.x1 - b.x0) && q.x < b.x1 - 0.03 * (b.x1 - b.x0) && q.y > b.y0 + 0.03 * (b.y1 - b.y0) && q.y < b.y1 - 0.03 * (b.y1 - b.y0);
  const mark = (mu, q, kind) => marks.push({ mu, c: project(coord, q.x, q.y), kind });
  // signs with the classifier's tolerance: a centre has τ = 0, a degenerate point Δ = 0, whatever the rounding noise says
  const sDet = o => o.stab === 'degen' ? 0 : Math.sign(o.det) || 0;
  const sTau = o => o.stab === 'degen' || o.stab === 'center' ? 0 : Math.sign(o.tau) || 0;
  const near = (i, q) => i >= 0 && i < d.N ? d.fps[i].filter(p => Math.hypot(p.x - q.x, p.y - q.y) < tol) : [];
  // where a branch breaks between samples i−1 and i: count branches near it one sample clear of the break on each side
  // (a sample landing exactly on the bifurcation holds a single merged point). Nothing on one side → fold;
  // branches on both sides → they meet or cross: a branch point; one and one → a gap in the search, not a bifurcation.
  const endKind = (i, q) => {
    const nb = near(i - 2, q).length, na = near(i + 1, q).length;
    return nb === 0 || na === 0 ? 'F' : nb === 1 && na === 1 ? null : 'BP';
  };
  const next = new Map();
  for (let i = 1; i < d.N; i++) {
    const A = d.fps[i - 1], B = d.fps[i], used = new Set();
    for (const q of B) {
      let best = -1, bd = tol;
      A.forEach((p, k) => { const dd = Math.hypot(p.x - q.x, p.y - q.y); if (dd < bd && !used.has(k)) { bd = dd; best = k; } });
      if (best < 0) { const k = inner(q) && endKind(i, q); if (k) mark(d.mus[i], q, k); continue; }
      used.add(best);
      segs.push({ i, p: A[best], q });
      next.set(A[best], q);
    }
    A.forEach((p, k) => { if (!used.has(k) && inner(p)) { const kind = endKind(i, p); if (kind) mark(d.mus[i - 1], p, kind); } });
  }
  // Δ or τ changing sign along a branch, looking through one degenerate or centre sample in between
  for (const sgm of segs) {
    const p = sgm.p;
    let q = sgm.q;
    if ((sDet(q) === 0 || sTau(q) === 0) && next.has(q)) q = next.get(q);
    const mid = { x: (p.x + sgm.q.x) / 2, y: (p.y + sgm.q.y) / 2 }, mu = (d.mus[sgm.i - 1] + d.mus[sgm.i]) / 2;
    if (sDet(p) && sDet(q) && sDet(p) !== sDet(q)) mark(mu, mid, 'BP');
    else if (sDet(p) > 0 && sDet(q) > 0 && sTau(p) && sTau(q) && sTau(p) !== sTau(q)) mark(mu, mid, 'H');
  }
  d.segs = segs; d.marks = marks;
}

export {
  GREEK, symTex, symHtml, compileLatex, factorTex, buildModel, fmt,
  fx, gy, jac, findFixedPoints, classify, integrateDP, integrateIM, trajectory,
  sampleGrid, contour, interpGrid, crossings, hamiltonianGrid,
  symbolicDiv, detectStructure, centerReason, equilibria, buildCRN,
  project, bifSweep, findCycles, polarCycleFn, linkBranches,
};
