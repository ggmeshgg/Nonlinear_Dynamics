// Known answers for the Phase Plane Lab mathematics. Every expected value here comes from the analysis of the
// system (Strogatz, or a line of algebra in the comment), not from what the code happened to print.
// Run: npm test (in phase-plane/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  P, use, compileLatex, buildModel, fx, gy, jac, trajectory, symbolicDiv, detectStructure, equilibria, fpTable,
  buildCRN, bifSweep, findCycles, polarCycleFn, circleIndex, enclosedIndex, checkIndices, fmt,
} from '../core.js';

// compile ẋ = f, ẏ = g (ṙ, θ̇ when polar) the way the page does, and make it the current system
function load(f, g, { E = '', vars = ['x', 'y'], polar = false, params = {} } = {}) {
  const v = polar ? ['r', 'theta'] : vars;
  const m = buildModel(compileLatex(f, v), compileLatex(g, v), E ? compileLatex(E, v) : null, v, polar);
  for (const n of Object.keys(P)) delete P[n];
  for (const n of m.used) P[n] = params[n] ?? 1;
  use(m);
  return m;
}
const win = (cx, cy, r) => ({ x0: cx - r, x1: cx + r, y0: cy - r, y1: cy + r });
// what the page sees: structure, then fixed points from a grid of ~4 px over a 800 px window
function analyze(b) {
  const st = detectStructure(b);
  return { st, ...equilibria(b, 201, 201, st) };
}
const near = (fps, x, y, tol = 1e-6) => fps.find(p => Math.hypot(p.x - x, p.y - y) < tol);
function sweep(name, min, max, b, opts) {
  const s = bifSweep(name, min, max, b, opts);
  for (let i = 0; i < s.d.N; i++) s.sample(i);
  s.finish();
  return s.d;
}
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (±${tol})`);

// ---------- expressions ----------

test('a parameter written like a function multiplies: μ(1−x²)y − x', () => {
  load('y', '\\mu(1-x^2)y-x', { params: { mu: 2 } });
  close(gy(0.5, 1), 2 * 0.75 * 1 - 0.5, 1e-12);
  close(fx(0.5, 1), 1, 0);
});

test('a power belongs to the bracket next to it: a(x−b)² is a·(x−b)², and (a(x−b))² is not', () => {
  const a = 2, b = 3, x = 4.5, y = 0.7, u = x - b;
  for (const [tex, want] of [
    ['a(x-b)^2', a * u ** 2],
    ['a\\left(x-b\\right)^2', a * u ** 2],
    ['a(x-b)^{2}', a * u ** 2],
    ['a(x-b)^3', a * u ** 3],
    ['2a(x-b)^2', 2 * a * u ** 2],
    ['-a(x-b)^2', -a * u ** 2],
    ['\\mu(x-b)^2', a * u ** 2],
    ['k_1(x-b)^2', a * u ** 2],
    ['a(x+1)^2(x-b)', a * (x + 1) ** 2 * u],
    ['a(x-b)(x+1)^2', a * u * (x + 1) ** 2],
    ['a(x-b)^2+a', a * u ** 2 + a],
    ['a+a(x-b)', a + a * u],
    ['\\frac{a(x-b)^2}{2}', a * u ** 2 / 2],
    ['\\frac{y^2}{2}+a(x-b)^2', y * y / 2 + a * u ** 2],
    ['e^{-a(x-b)^2}', Math.exp(-a * u ** 2)],
    ['a(b(x-1)^2)^2', a * (b * (x - 1) ** 2) ** 2],
    // brackets round the whole product do square the parameter; a power on the parameter stays on it
    ['(a(x-b))^2', (a * u) ** 2],
    ['a^2(x-b)', a * a * u],
    // the variables already worked this way
    ['x(x-b)^2', x * u ** 2],
    ['2(x-b)^2', 2 * u ** 2],
  ]) {
    load(tex, '0', { params: { a, b, mu: a, k_1: a } });
    close(fx(x, y), want, 1e-9 * Math.max(1, Math.abs(want)), tex);
  }
});

test('random expressions mean what they were built to mean', () => {
  // Each is built twice, as LaTeX and as a function of the values, so the parser never sees the expected answer.
  let s = 20261105;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const NAMES = [['a', 'a'], ['b', 'b'], ['k', 'k'], ['\\mu', 'mu'], ['k_1', 'k_1']];
  const param = () => { const [tex, n] = pick(NAMES); return { tex, val: e => e[n] }; };
  const atom = () => pick([
    param,
    () => { const n = pick(['x', 'y']); return { tex: n, val: e => e[n] }; },
    () => { const k = pick([2, 3, 5]); return { tex: String(k), val: () => k }; },
  ])();
  const outside = t => { let o = '', n = 0; for (const c of t) { if ('({'.includes(c)) n++; else if (')}'.includes(c)) n--; else if (!n) o += c; } return o; };
  const operand = w => /[+-]/.test(outside(w.tex)) ? `(${w.tex})` : w.tex;
  const sum = d => {
    const u = expr(d - 1), v = expr(d - 1), plus = rnd() < 0.5;
    return { tex: `${operand(u)}${plus ? '+' : '-'}${operand(v)}`, val: plus ? e => u.val(e) + v.val(e) : e => u.val(e) - v.val(e) };
  };
  const FORMS = [
    d => { const p = param(), u = sum(d), n = pick([2, 3]); return { tex: `${p.tex}(${u.tex})^${n}`, val: e => p.val(e) * u.val(e) ** n }; },
    d => { const p = param(), q = param(), u = sum(d); return { tex: `${p.tex} ${q.tex}(${u.tex})^2`, val: e => p.val(e) * q.val(e) * u.val(e) ** 2 }; },
    d => { const p = param(), u = sum(d), v = sum(d); return { tex: `${p.tex}(${u.tex})^2(${v.tex})`, val: e => p.val(e) * u.val(e) ** 2 * v.val(e) }; },
    d => { const p = param(), u = sum(d); return { tex: `(${p.tex}(${u.tex}))^2`, val: e => (p.val(e) * u.val(e)) ** 2 }; },
    d => { const p = param(), u = sum(d); return { tex: `${p.tex}^2(${u.tex})`, val: e => p.val(e) ** 2 * u.val(e) }; },
    d => { const p = param(), u = sum(d); return { tex: `${p.tex}(${u.tex})^2+${p.tex}`, val: e => p.val(e) * u.val(e) ** 2 + p.val(e) }; },
    d => { const p = param(), u = sum(d); return { tex: `${p.tex}(${u.tex})`, val: e => p.val(e) * u.val(e) }; },
    d => { const u = sum(d), v = sum(d); return { tex: `(${u.tex})(${v.tex})`, val: e => u.val(e) * v.val(e) }; },
    d => { const u = expr(d - 1), v = expr(d - 1); return { tex: `\\frac{${u.tex}}{${v.tex}}`, val: e => u.val(e) / v.val(e) }; },
    d => { const u = expr(d - 1); return { tex: `\\sin(${u.tex})`, val: e => Math.sin(u.val(e)) }; },
    d => { const u = expr(d - 1); return { tex: `e^{${u.tex}}`, val: e => Math.exp(u.val(e)) }; },
  ];
  const expr = d => d <= 0 || rnd() < 0.15 ? atom() : pick(FORMS)(d);
  let checked = 0;
  for (let i = 0; i < 600; i++) {
    const ex = pick(FORMS)(2), c = compileLatex(ex.tex, ['x', 'y']);
    for (let t = 0; t < 6; t++) {
      const e = { x: rnd() * 4 - 1.9, y: rnd() * 4 - 1.9 };
      for (const [, n] of NAMES) e[n] = 0.3 + rnd() * 3;
      const want = ex.val(e);
      if (!isFinite(want) || Math.abs(want) > 1e12) continue;
      checked++;
      close(c.fn(e.x, e.y, e), want, 1e-9 * Math.max(1, Math.abs(want)), ex.tex);
    }
  }
  assert.ok(checked > 2000, `only ${checked} values compared`);
});

test('U = a(x−b)²: energy is conserved for every a, b; a wrong E and damping are told apart', () => {
  const E = '\\frac{y^2}{2}+a(x-b)^2';
  for (const [a, b] of [[1, 1], [2, 3], [0.5, 2], [7, 0.3]]) {
    load('y', '-2a(x-b)', { E, params: { a, b } });
    const box = win(b, 0, 3 + b), { st, fps } = analyze(box);
    assert.equal(st.hamiltonian, true, `a=${a} b=${b}`);
    assert.equal(st.E.conserved, true, `a=${a} b=${b}`);
    assert.equal(fps.length, 1);
    close(fps[0].x, b, 1e-9);
    close(fps[0].y, 0, 1e-9);
    assert.equal(fps[0].type, 'nonlinear center');
  }
  // dE/dt = 2a·b·y for this E: both signs, and it must say so
  load('y', '-2a(x-b)', { E: '\\frac{y^2}{2}+ax^2', params: { a: 2, b: 3 } });
  let st = detectStructure(win(3, 0, 6));
  assert.equal(st.E.conserved, false);
  assert.ok(st.E.pos > 50 && st.E.neg > 50);
  // dE/dt = −c y² ≤ 0: not conserved, and never positive
  load('y', '-2a(x-b)-cy', { E, params: { a: 2, b: 3, c: 0.1 } });
  st = detectStructure(win(3, 0, 6));
  assert.equal(st.hamiltonian, false);
  assert.equal(st.E.conserved, false);
  assert.equal(st.E.pos, 0);
  assert.ok(st.E.neg > 50);
});

test('the divergence and the reaction network read a(x−b)² the same way', () => {
  // div = ∂/∂x a(x−b)² = 2a(x−b)
  load('a(x-b)^2', '0', { params: { a: 2, b: 3 } });
  const sd = symbolicDiv();
  assert.equal(sd.zero, false);
  close(sd.fn(4.5, 0, P), 2 * 2 * 1.5, 1e-9);
  // a(x−b)² = a x² − 2ab x + ab²
  const m = compileLatex('a(x-b)^2', ['x', 'y']);
  const coeff = (deg, key) => m.poly.filter(t => t.a === deg && t.b === 0 && t.key === key).reduce((s, t) => s + t.n, 0);
  close(coeff(2, '"a"^1'), 1, 1e-12);
  close(coeff(1, '"a"^1*"b"^1'), -2, 1e-12);
  close(coeff(0, '"a"^1*"b"^2'), 1, 1e-12);
});

test('polar ṙ, θ̇ become ẋ, ẏ', () => {
  load('r(1-r^2)', '1', { polar: true });
  // at (x, y) = (0.5, 0): ṙ = 0.5·0.75, θ̇ = 1 → ẋ = ṙ, ẏ = r θ̇
  close(fx(0.5, 0), 0.375, 1e-12);
  close(gy(0.5, 0), 0.5, 1e-12);
});

// ---------- structure: div f, reversibility, E ----------

test('Hamiltonian only when div f = 0', async t => {
  await t.test('pendulum without damping: div f = −b = 0 at b = 0', () => {
    load('v', '-\\sin\\theta-bv', { vars: ['theta', 'v'], params: { b: 0 } });
    const st = detectStructure(win(0, 0, 3.6));
    assert.equal(st.hamiltonian, true);
    assert.match(st.divNote, /at these parameter values/);
  });
  await t.test('pendulum with b = 0.002 is not', () => {
    load('v', '-\\sin\\theta-bv', { vars: ['theta', 'v'], params: { b: 0.002 } });
    assert.equal(detectStructure(win(0, 0, 3.6)).hamiltonian, false);
  });
  await t.test('stiff oscillator with weak damping: div f = −0.005', () => {
    load('y', '-10000x-0.005y');
    const st = detectStructure(win(0, 0, 3));
    assert.equal(st.hamiltonian, false);
    assert.match(st.divNote, /max \|div f\| = 0\.005 in view/);
  });
  await t.test('ẋ = y, ẏ = −x is identically divergence-free', () => {
    load('y', '-x');
    assert.match(detectStructure(win(0, 0, 2)).divNote, /≡ 0 identically/);
  });
});

test('polar divergence is (1/r) ∂(r ṙ)/∂r + ∂θ̇/∂θ', async t => {
  await t.test('rigid shear ṙ = 0, θ̇ = r is Hamiltonian', () => {
    load('0', 'r', { polar: true });
    assert.equal(detectStructure(win(0, 0, 1.6)).hamiltonian, true);
  });
  await t.test('ṙ = −cos θ, θ̇ = sin θ is not (div = cos θ − cos θ / r)', () => {
    load('-\\cos\\theta', '\\sin\\theta', { polar: true });
    assert.equal(detectStructure(win(0, 0, 1.6)).hamiltonian, false);
  });
  await t.test('closed form agrees with the trace of the Jacobian', () => {
    load('r(1-r^2)', '\\mu-\\sin\\theta', { polar: true, params: { mu: 0.5 } });
    const sd = symbolicDiv();
    assert.ok(sd && !sd.zero);
    for (const [x, y] of [[0.7, 0.2], [-0.4, 1.1], [1.3, -0.9], [-1.2, -0.3]]) {
      const J = jac(x, y);
      close(sd.fn(x, y, P), J[0] + J[3], 1e-6, `at (${x}, ${y})`);
    }
  });
});

test('reversible system ẋ = y − y³, ẏ = −x − y² is symmetric under t → −t, y → −y', () => {
  load('y-y^3', '-x-cy^2', { params: { c: 1 } });
  const st = detectStructure(win(-0.4, 0, 1.8));
  assert.equal(st.revY, true);
  assert.equal(st.hamiltonian, false);
});

test('predator–prey: E = x − b ln x + y − a ln y is conserved', () => {
  load('x(a-y)', 'y(x-b)', { E: 'x-b\\ln x+y-a\\ln y' });
  const st = detectStructure(win(1.3, 1.3, 1.6));
  assert.equal(st.E.conserved, true);
  assert.equal(st.hamiltonian, false);   // div f = a − b + x − y
});

// ---------- fixed points ----------

test('linear system: stable spiral, λ = −0.5 ± 2i', () => {
  load('ax+by', 'cx+dy', { params: { a: -0.5, b: 2, c: -2, d: -0.5 } });
  const { fps } = analyze(win(0, 0, 3));
  assert.equal(fps.length, 1);
  assert.equal(fps[0].type, 'stable spiral');
  close(fps[0].eig[1][0], -0.5, 1e-6); close(Math.abs(fps[0].eig[1][1]), 2, 1e-6);
});

test('rabbits vs sheep (Strogatz 6.4): (0,0) unstable node, (0,2) and (3,0) stable nodes, (1,1) saddle', () => {
  load('x(3-x-2y)', 'y(2-x-y)');
  const { fps } = analyze(win(1.5, 1.2, 1.9));
  assert.equal(fps.filter(p => p.inView).length, 4);
  assert.equal(near(fps, 0, 0).type, 'unstable node');
  assert.equal(near(fps, 0, 2).type, 'stable node');
  assert.equal(near(fps, 3, 0).type, 'stable node');
  assert.equal(near(fps, 1, 1).type, 'saddle');
});

test('ẋ = sin πx, ẏ = sin πy: every lattice point in view, typed by parity', () => {
  load('\\sin(\\pi x)', '\\sin(\\pi y)');
  const { fps } = analyze(win(1.5, 1.5, 2));   // x, y ∈ [−0.5, 3.5]: 4 × 4 points
  const seen = fps.filter(p => p.inView);
  assert.equal(seen.length, 16);
  assert.deepEqual([fpTable(fps).count, fpTable(fps).curve], ['16', 0]);   // isolated points are counted one by one
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const p = near(fps, i, j);
    assert.ok(p, `(${i}, ${j}) found`);
    // J = π diag(cos πi, cos πj)
    const want = i % 2 !== j % 2 ? 'saddle' : i % 2 === 0 ? 'unstable' : 'stable';
    assert.equal(p.stab, want, `(${i}, ${j})`);
  }
});

test('ẋ = x(1−x−y), ẏ = y(1−x−y): isolated origin plus the line x + y = 1 of degenerate points', () => {
  load('x(1-x-y)', 'y(1-x-y)');
  const { fps } = analyze(win(0.5, 0.5, 1.2));
  assert.equal(near(fps, 0, 0).stab, 'unstable');
  const line = fps.filter(p => p.inView && !(Math.abs(p.x) < 1e-6 && Math.abs(p.y) < 1e-6));
  assert.ok(line.length >= 6);
  for (const p of line) { assert.equal(p.stab, 'degen'); close(p.x + p.y, 1, 1e-6); }
  // the sidebar lists the origin and one curve, and counts them that way, not every sampled point of the line
  const t = fpTable(fps);
  assert.equal(t.rows.length, 1);
  assert.ok(near(t.rows.map(([p]) => p), 0, 0));
  assert.equal(t.curve, line.length);
  assert.equal(t.count, '1 + curve');
});

test('pendulum: nonlinear center at 0 because it is Hamiltonian, saddles at ±π', () => {
  load('v', '-\\sin\\theta-bv', { vars: ['theta', 'v'], params: { b: 0 } });
  const { fps } = analyze(win(0, 0, 3.6));
  const c = near(fps, 0, 0);
  assert.equal(c.type, 'nonlinear center');
  assert.match(c.note, /Hamiltonian/);
  assert.equal(near(fps, Math.PI, 0).type, 'saddle');
  assert.equal(near(fps, -Math.PI, 0).type, 'saddle');
});

test('reversible system: linear center on the symmetry axis is a true center', () => {
  load('y-y^3', '-x-cy^2', { params: { c: 1 } });
  const { fps } = analyze(win(-0.4, 0, 1.8));
  const c = near(fps, 0, 0);
  assert.equal(c.type, 'nonlinear center');
  assert.match(c.note, /reversible/);
});

test('saddle-node at μ = 0 is degenerate, not a node a hair away from 0', () => {
  load('\\mu-x^2', '-y', { params: { mu: 0 } });
  const { fps } = analyze(win(0, 0, 1.8));
  assert.equal(fps.length, 1);
  assert.equal(fps[0].stab, 'degen');
});

test('infinite-period system at μ = 0.5: non-smooth repeller at 0, node and saddle on r = 1 where sin θ = μ', () => {
  load('r(1-r^2)', '\\mu-\\sin\\theta', { polar: true, params: { mu: 0.5 } });
  const { fps } = analyze(win(0, 0, 1.6));
  assert.equal(near(fps, 0, 0).type, 'repeller (non-smooth)');
  // θ̇ = μ − sin θ: d/dθ = −cos θ < 0 at θ = π/6 (stable), > 0 at 5π/6; radially both attract
  assert.equal(near(fps, Math.cos(Math.PI / 6), 0.5).type, 'stable node');
  assert.equal(near(fps, -Math.cos(Math.PI / 6), 0.5).type, 'saddle');
});

// ---------- trajectories ----------

test('slow node ẋ = −0.001x, ẏ = −0.002y: the trajectory reaches the node', () => {
  load('-0.001x', '-0.002y');
  const b = win(0, 0, 3), pts = trajectory(2, 2, 1, 6000, b, 3 / 400);
  const X = pts[pts.length - 2], Y = pts[pts.length - 1];
  assert.ok(Math.hypot(X, Y) < 0.05, `ended at (${X}, ${Y})`);
});

test('slow center ẋ = 0.01y, ẏ = −0.01x: the orbit closes on the circle r = 2', () => {
  load('0.01y', '-0.01x');
  const pts = trajectory(2, 0, 1, 6000, win(0, 0, 3), 3 / 400, { closed: true, symplectic: true });
  let wind = 0;
  for (let k = 2; k < pts.length; k += 2) {
    close(Math.hypot(pts[k], pts[k + 1]), 2, 0.01);
    let d = Math.atan2(pts[k + 1], pts[k]) - Math.atan2(pts[k - 1], pts[k - 2]);
    if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    wind += d;
  }
  close(Math.abs(wind), 2 * Math.PI, 0.05, 'winds once');
  assert.deepEqual(pts.slice(-2), [2, 0]);
});

test('weakly damped pendulum (b = 0.002) spirals in: not snapped shut', () => {
  load('v', '-\\sin\\theta-bv', { vars: ['theta', 'v'], params: { b: 0.002 } });
  const pts = trajectory(1, 0, 1, 6000, win(0, 0, 3.6), 3.6 / 400);
  assert.notDeepEqual(pts.slice(-2), [1, 0]);
  // E = v²/2 − cos θ decreases along the orbit: dE/dt = −b v²
  const E = (t, v) => v * v / 2 - Math.cos(t);
  assert.ok(E(pts[pts.length - 2], pts[pts.length - 1]) < E(1, 0));
});

// ---------- limit cycles ----------

test('Van der Pol μ = 1: limit cycle with amplitude 2.01 and period 6.663', () => {
  load('y', '\\mu(1-x^2)y-x', { params: { mu: 1 } });
  const b = win(0, 0, 4), { fps } = analyze(b);
  const [c] = findCycles(b, fps, 'x');
  assert.ok(c, 'cycle found');
  close(c.hi, 2.0086, 0.01); close(c.lo, -2.0086, 0.01);
  close(c.period, 6.6633, 0.01);
  assert.ok(c.mult < 0.1);   // Floquet multiplier exp(∮ div f dt) is tiny for μ = 1
});

test('glycolytic oscillator a = 0.08, b = 0.6 has a stable limit cycle (Strogatz 7.3)', () => {
  load('-x+ay+x^2y', 'b-ay-x^2y', { params: { a: 0.08, b: 0.6 } });
  const b = { x0: -0.6, x1: 2.6, y0: -0.3, y1: 2.9 }, { fps } = analyze(b);
  assert.equal(fps.filter(p => p.inView)[0].stab, 'unstable');
  assert.equal(findCycles(b, fps, 'x').length, 1);
});

test('subcritical Hopf (polar) μ = −0.1: cycles at r² = (1 ± √(1+4μ))/2, outer stable, inner unstable', () => {
  load('\\mu r+r^3-r^5', '\\omega+br^2', { polar: true, params: { mu: -0.1, omega: 1, b: 0 } });
  const cyc = polarCycleFn('r')(win(0, 0, 1.4)).sort((p, q) => p.lo - q.lo);
  assert.equal(cyc.length, 2);
  close(cyc[0].lo, Math.sqrt((1 - Math.sqrt(0.6)) / 2), 1e-6); assert.equal(cyc[0].stable, false);
  close(cyc[1].lo, Math.sqrt((1 + Math.sqrt(0.6)) / 2), 1e-6); assert.equal(cyc[1].stable, true);
});

// ---------- bifurcation diagrams ----------

const marks = (d, kind) => d.marks.filter(m => m.kind === kind).map(m => m.mu);

test('saddle-node ẋ = μ − x²: one fold at μ = 0', () => {
  load('\\mu-x^2', '-y');
  const d = sweep('mu', -1, 1, win(0, 0, 1.8), { cycles: false });
  assert.deepEqual(marks(d, 'H'), []); assert.deepEqual(marks(d, 'BP'), []);
  const F = marks(d, 'F');
  assert.ok(F.length >= 1 && F.every(mu => Math.abs(mu) < 0.02), `F at ${F}`);
});

test('pitchfork ẋ = μx − x³ and transcritical ẋ = μx − x²: branch point at μ = 0, no fold', async t => {
  for (const f of ['\\mu x-x^3', '\\mu x-x^2']) await t.test(f, () => {
    load(f, '-y');
    const d = sweep('mu', -1, 1, win(0, 0, 1.6), { cycles: false });
    const BP = marks(d, 'BP');
    assert.ok(BP.length >= 1 && BP.every(mu => Math.abs(mu) < 0.02), `BP at ${BP}`);
    assert.deepEqual(marks(d, 'F'), []); assert.deepEqual(marks(d, 'H'), []);
  });
});

test('supercritical Hopf: H at μ = 0, cycle of radius √μ for μ > 0 only', () => {
  load('\\mu x-y-x(x^2+y^2)', 'x+\\mu y-y(x^2+y^2)');
  const d = sweep('mu', -1, 1, win(0, 0, 1.4));
  const H = marks(d, 'H');
  assert.equal(H.length, 1); close(H[0], 0, 0.01);
  for (let i = 0; i < d.N; i++) {
    const mu = d.mus[i];
    if (mu < 0) assert.deepEqual(d.cyc[i], [], `no cycle at μ = ${mu}`);
    if (mu > 0.1 && d.cyc[i].length) close(d.cyc[i][0].hi, Math.sqrt(mu), 0.02 * Math.sqrt(mu), `μ = ${mu}`);
  }
  assert.ok(d.mus.some((mu, i) => mu > 0.1 && d.cyc[i].length), 'cycles found');
});

test('ẍ = −x + μẋ − x²ẋ: Hopf exactly on a grid sample (μ = 0) is still marked', () => {
  load('y', '-x+\\mu y-x^2y');
  const d = sweep('mu', -1, 1, win(0, 0, 2));
  const H = marks(d, 'H');
  assert.equal(H.length, 1); close(H[0], 0, 0.01);
});

test('infinite-period bifurcation: invariant circle with fixed points for μ < 1, a cycle for μ > 1', () => {
  load('r(1-r^2)', '\\mu-\\sin\\theta', { polar: true });
  const d = sweep('mu', 0, 2, win(0, 0, 1.6), { coord: 'r' });
  for (let i = 0; i < d.N; i++) {
    if (d.mus[i] < 0.99) assert.deepEqual(d.cyc[i], [], `μ = ${d.mus[i]}`);
    if (d.mus[i] > 1.01) { assert.equal(d.cyc[i].length, 1); close(d.cyc[i][0].lo, 1, 1e-6); }
  }
  const F = marks(d, 'F');
  assert.ok(F.length >= 1 && F.every(mu => Math.abs(mu - 1) < 0.02), `F at ${F}`);
  assert.deepEqual(marks(d, 'H'), []);
});

test('no limit cycles or Hopf points in systems with a family of closed orbits', async t => {
  await t.test('predator–prey, sweeping a', () => {
    load('x(a-y)', 'y(x-b)');
    const d = sweep('a', 0.1, 3, win(1.3, 1.3, 1.6));
    assert.equal(d.cyc.flat().length, 0);
    assert.deepEqual(marks(d, 'H'), []);
  });
  await t.test('reversible ẋ = y − y³, ẏ = −x − cy², sweeping c', () => {
    load('y-y^3', '-x-cy^2');
    const d = sweep('c', 0.2, 2, win(-0.4, 0, 1.8));
    assert.equal(d.cyc.flat().length, 0);
    assert.deepEqual(marks(d, 'H'), []);
  });
});

// ---------- index of a closed curve ----------

test('index on a circle around one fixed point (Strogatz 6.8)', async t => {
  const cases = [
    ['stable node', '-x', '-y', 1],
    ['unstable node', 'x', 'y', 1],
    ['center', '-y', 'x', 1],
    ['stable spiral', '-x-y', 'x-y', 1],
    ['saddle', 'x', '-y', -1],
    // the field as z² and z³ turns twice and three times; as the conjugate z̄² it turns backwards
    ['z²', 'x^2-y^2', '2xy', 2],
    ['z³', 'x^3-3xy^2', '3x^2y-y^3', 3],
    ['conjugate of z²', 'x^2-y^2', '-2xy', -2],
  ];
  for (const [name, f, g, want] of cases) await t.test(name, () => {
    load(f, g);
    assert.equal(circleIndex(0, 0, 1).index, want);
    assert.equal(circleIndex(0.1, -0.2, 0.7).index, want);   // the circle need not be centred on the point
  });
});

test('index is 0 on a circle with no fixed point inside', () => {
  load('1', '0');
  assert.equal(circleIndex(0, 0, 1).index, 0);
  load('x', 'y');
  assert.equal(circleIndex(3, 0, 1).index, 0);
});

test('index on a circle adds up the fixed points inside', async t => {
  // rabbits vs sheep: (0,0), (0,2), (3,0) are nodes, (1,1) a saddle
  await t.test('rabbits vs sheep', () => {
    load('x(3-x-2y)', 'y(2-x-y)');
    assert.equal(circleIndex(1, 1, 0.5).index, -1);
    assert.equal(circleIndex(3, 0, 0.5).index, 1);
    const all = enclosedIndex(1.5, 1, 3);
    assert.equal(circleIndex(1.5, 1, 3).index, 2);
    assert.deepEqual([all.fps.length, all.sum, all.unknown], [4, 2, 0]);
  });
  // pitchfork: for μ = 1, a saddle between two nodes; for μ = −1, one node. The sum does not change.
  await t.test('pitchfork keeps the index across the bifurcation', () => {
    load('\\mu x-x^3', '-y', { params: { mu: 1 } });
    assert.equal(circleIndex(0, 0, 2).index, 1);
    assert.equal(enclosedIndex(0, 0, 2).sum, 1);
    assert.equal(circleIndex(0, 0, 0.5).index, -1);
    P.mu = -1;
    assert.equal(circleIndex(0, 0, 2).index, 1);
    assert.equal(enclosedIndex(0, 0, 2).fps.length, 1);
  });
  // saddle-node: node + saddle = 0 before, and the merged point at μ = 0 has index 0, which the Jacobian cannot tell
  await t.test('saddle-node', () => {
    load('\\mu-x^2', '-y', { params: { mu: 0.25 } });
    assert.equal(circleIndex(0, 0, 2).index, 0);
    assert.equal(circleIndex(0.5, 0, 0.3).index, 1);
    assert.equal(circleIndex(-0.5, 0, 0.3).index, -1);
    P.mu = 0;
    assert.equal(circleIndex(0, 0, 1).index, 0);
    const e = enclosedIndex(0, 0, 1);
    assert.deepEqual([e.fps.length, e.fps[0].stab, e.sum, e.unknown], [1, 'degen', 0, 0]);   // measured on a small circle
  });
});

test('a closed orbit has index +1', async t => {
  await t.test('on the limit cycle itself: ṙ = r(1 − r²), θ̇ = 1, r = 1', () => {
    load('r(1-r^2)', '1', { polar: true });
    assert.equal(circleIndex(0, 0, 1).index, 1);
  });
  await t.test('a θ̇ that depends on θ: the origin is not C¹, the winding still exists', () => {
    load('r(1-r^2)', '2-\\sin\\theta', { polar: true });
    assert.equal(circleIndex(0, 0, 0.5).index, 1);
  });
});

test('a circle through a fixed point has no index', async t => {
  await t.test('sampled exactly: ẋ = x, ẏ = y, the circle of radius 1 about (1, 0) passes through the origin', () => {
    load('x', 'y');
    const r = circleIndex(1, 0, 1);
    assert.equal(r.index, null);
    assert.equal(r.fail.kind, 'fixed');
    close(r.fail.x, 0, 1e-6); close(r.fail.y, 0, 1e-6);
  });
  await t.test('between samples: the same through (−1, −0.3), a point no sample lands on', () => {
    load('x+1', 'y+0.3');
    const r = circleIndex(0, 0, Math.hypot(1, 0.3));
    assert.equal(r.index, null);
    assert.equal(r.fail.kind, 'fixed');
    close(r.fail.x, -1, 1e-6); close(r.fail.y, -0.3, 1e-6);
  });
  // the field stays in the first quadrant, so the angle shows nothing; only |field| going to 0 gives it away
  await t.test('a zero of even order, where the direction does not change: ẋ = x², ẏ = y²', async t => {
    load('x^2', 'y^2');
    for (const [cx, cy, R] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0.6, 0.8, 1]]) {
      const r = circleIndex(cx, cy, R);
      assert.equal(r.index, null, `about (${cx}, ${cy})`);
      assert.equal(r.fail.kind, 'fixed');
      close(r.fail.x, 0, 1e-5); close(r.fail.y, 0, 1e-5);
    }
    load('(x+1)^2', '(y+0.3)^2');
    assert.equal(circleIndex(0, 0, Math.hypot(1, 0.3)).fail.kind, 'fixed');
    // and clear of it there is a number: inside or out, this field never turns
    load('x^2', 'y^2');
    assert.equal(circleIndex(1, 0, 0.99).index, 0);
    assert.equal(circleIndex(1, 0, 1.01).index, 0);
  });
  await t.test('a whole circle of fixed points: (x² + y² − 1)(x, y) on r = 1', () => {
    load('(x^2+y^2-1)x', '(x^2+y^2-1)y');
    const r = circleIndex(0, 0, 1);
    assert.equal(r.index, null);
    assert.equal(r.fail.kind, 'fixed');
  });
});

test('a fixed point just off the circle is on the right side of it', () => {
  load('x', 'y');
  assert.equal(circleIndex(1, 0, 1 - 1e-6).index, 0);
  assert.equal(circleIndex(1, 0, 1 + 1e-6).index, 1);
  assert.equal(circleIndex(1, 0.5, Math.hypot(1, 0.5) - 1e-7).index, 0);
  assert.equal(circleIndex(1, 0.5, Math.hypot(1, 0.5) + 1e-7).index, 1);
});

test('a field undefined or jumping on the circle has no index', async t => {
  const singular = (f, g, cx, cy, R) => {
    load(f, g);
    const r = circleIndex(cx, cy, R);
    assert.equal(r.index, null);
    assert.equal(r.fail.kind, 'singular');
    return r;
  };
  await t.test('a pole: ẋ = 1/x', () => { close(singular('\\frac{1}{x}', '1', 0, 0.2, 1).fail.x, 0, 1e-6); });
  await t.test('a jump: ẋ = sign x', () => { close(singular('\\operatorname{sign}(x)', '1', 0, 0.2, 1).fail.x, 0, 1e-6); });
  await t.test('a pole of even order, where the direction does not change: ẋ = ẏ = 1/x²', () => {
    close(singular('\\frac{1}{x^2}', '\\frac{1}{x^2}', 0, 0.2, 1).fail.x, 0, 1e-5);
  });
  await t.test('outside the domain: ẋ = ln x, for x < 0', () => { singular('\\ln x', 'y', 0, 0, 1.2); });
  await t.test('ln x is fine where it is defined: the point (1, 0) has index +1', () => {
    load('\\ln x', 'y');
    assert.equal(circleIndex(1, 0, 0.5).index, 1);
  });
});

test('a pole inside is not a fixed point, so the index and the sum disagree', () => {
  load('\\frac{x}{x^2+y^2}', '\\frac{y}{x^2+y^2}');
  assert.equal(circleIndex(0, 0, 1).index, 1);
  const e = enclosedIndex(0, 0, 1);
  assert.deepEqual([e.fps.length, e.sum], [0, 0]);
});

test('a field turning fast is followed or refused, never miscounted', async t => {
  // ṙ = cos mθ, θ̇ = sin(mθ)/r gives the field the angle (m + 1)θ, so index m + 1 on any circle about the origin
  const turning = m => { load(`\\cos(${m}\\theta)`, `\\frac{\\sin(${m}\\theta)}{r}`, { polar: true }); return circleIndex(0, 0, 1); };
  await t.test('61 turns', () => assert.equal(turning(60).index, 61));
  await t.test('300 turns', () => assert.equal(turning(299).index, 300));
  const refused = m => { const r = turning(m); assert.equal(r.index, null); assert.equal(r.fail.kind, 'fast'); };
  // exactly one turn per sample of the first pass: those samples all agree and see a constant field
  await t.test('720 turns, in step with the first pass', () => refused(719));
  // both passes alias, to −40 and −45 turns: each alone would give a wrong number
  await t.test('5000 turns, aliased in both passes', () => refused(4999));
  await t.test('more turns than the budget', () => refused(49999));
});

test('a circle of no radius has no index', () => {
  load('x', 'y');
  assert.deepEqual(circleIndex(1, 1, 0), { index: null, fail: null });
});

// ---------- labels must not depend on anything but the system ----------
// The answer for each system comes from algebra. It must hold wherever the window sits and however far it is zoomed,
// with the point at the origin or not: Newton stops at a different place for each, and that must not show.

const WINDOWS = [3, 1, 0.1, 0.015, 1e-3, 1e-5];
const OFFSETS = [[0.13, 0.07], [-0.21, 0.11], [0.05, -0.31], [-0.17, -0.09]];
const SHIFTS = [[0, 0], [0.3, -0.7]];

// the system translated to (a, b), so that exact arithmetic at the origin cannot flatter it
function loadAt(f, g, a, b) {
  const m = load(f, g), f0 = m.f, g0 = m.g;
  m.f = (x, y, P) => f0(x - a, y - b, P); m.g = (x, y, P) => g0(x - a, y - b, P);
  return m;
}
function labelsEverywhere(f, g, fn) {
  for (const [a, b] of SHIFTS) {
    loadAt(f, g, a, b);
    for (const r of WINDOWS) for (const [ox, oy] of OFFSETS) {
      const t = fpTable(equilibria(win(a + ox * r, b + oy * r, r), 101, 101, {}).fps);
      fn(t, t.rows.map(([p]) => p), `shift ${a},${b} r=${r} off ${ox},${oy}`);
    }
  }
}

test('a point with no usable linearization is one degenerate point, at every zoom', async t => {
  const cases = [
    ['z² (the spiral that was not)', 'x^2-y^2', '2xy', 2],
    ['z³', 'x^3-3xy^2', '3x^2y-y^3', 3],
    ['conjugate of z²', 'x^2-y^2', '-2xy', -2],
    ['ẋ = x², ẏ = y²', 'x^2', 'y^2', 0],
    ['saddle-node ẋ = x², ẏ = −y', 'x^2', '-y', 0],
    ['ẋ = x³, ẏ = −y: looks like a saddle', 'x^3', '-y', -1],
    ['ẋ = −x³, ẏ = −y: looks like a node', '-x^3', '-y', 1],
    ['ẋ = x³, ẏ = y³', 'x^3', 'y^3', 1],
    ['ẋ = x⁵, ẏ = y⁵', 'x^5', 'y^5', 1],
    ['ẋ = x⁹, ẏ = −y', 'x^9', '-y', -1],
    ['radial r²', 'x(x^2+y^2)', 'y(x^2+y^2)', 1],
    ['radial r, C¹ with J = 0', 'x\\sqrt{x^2+y^2}', 'y\\sqrt{x^2+y^2}', 1],
    ['rotation r²', '-y(x^2+y^2)', 'x(x^2+y^2)', 1],
  ];
  for (const [name, f, g, index] of cases) await t.test(name, () => {
    labelsEverywhere(f, g, (tb, rows, where) => {
      assert.equal(tb.curve, 0, where);
      assert.deepEqual(rows.map(p => p.type), ['degenerate'], where);
      assert.equal(rows[0].index, index, where);
      assert.match(rows[0].note, /inconclusive/, where);
    });
  });
});

test('a corner in the field has no linearization', async t => {
  for (const [f, g] of [['|x|+2x', 'y'], ['|x|+2x', '|y|+2y'], ['|x|', 'y']]) await t.test(`ẋ = ${f}, ẏ = ${g}`, () => {
    labelsEverywhere(f, g, (tb, rows, where) => assert.deepEqual(rows.map(p => p.type), ['degenerate'], where));
  });
});

test('a hyperbolic point keeps its label however small or lopsided the numbers', async t => {
  const cases = [
    ['stable node', '-x', '-2y', 'stable node'],
    ['unstable spiral', 'x-y', 'x+y', 'unstable spiral'],
    ['saddle', 'x', '-y', 'saddle'],
    ['center', '-y', 'x', 'linear center'],
    // the old tolerance called these degenerate: Δ is small against J, and known perfectly well
    ['stiff node, λ = −1, −10⁻⁸', '-x', '-0.00000001y', 'stable node'],
    ['stiff saddle, λ = 1, −10⁻⁸', 'x', '-0.00000001y', 'saddle'],
    ['weak damping, τ = −10⁻⁵', 'y', '-x-0.00001y', 'stable spiral'],
    // and absolute cutoffs called these nothing at all
    ['slow field, J ~ 10⁻⁹', '-0.000000001x', '-0.000000002y', 'stable node'],
    ['slow saddle, J ~ 10⁻¹⁴', '0.00000000000001x', '-0.00000000000001y', 'saddle'],
  ];
  for (const [name, f, g, want] of cases) await t.test(name, () => {
    labelsEverywhere(f, g, (tb, rows, where) => assert.deepEqual(rows.map(p => p.type), [want], where));
  });
});

test('a small residual is not a root', async t => {
  const none = (f, g) => labelsEverywhere(f, g, (tb, rows, where) => { assert.equal(tb.curve, 0, where); assert.deepEqual(rows, [], where); });
  await t.test('ẋ = e^(−x) dies away and never reaches 0', () => none('e^{-x}', 'y'));
  await t.test('a field of size 10⁻¹² with no zero', () => none('0.000000000001(2+\\sin x)', '0.000000000001'));
});

test('two real points close together stay two, with their own labels', () => {
  for (const mu of [1e-2, 1e-6, 1e-10, 1e-14]) {
    load('\\mu-x^2', '-y', { params: { mu } });
    const e = Math.sqrt(mu), fps = equilibria(win(0, 0, 3 * e), 101, 101, {}).fps.sort((p, q) => p.x - q.x);
    assert.deepEqual(fps.map(p => p.stab), ['saddle', 'stable'], `μ = ${mu}`);
    close(fps[0].x, -e, 1e-3 * e); close(fps[1].x, e, 1e-3 * e);
    assert.deepEqual(fps.map(p => p.index), [-1, 1]);
  }
});

test('a curve of fixed points is still a curve', () => {
  load('x(1-x-y)', 'y(1-x-y)');
  const tb = fpTable(equilibria(win(0.5, 0.5, 1.5), 101, 101, {}).fps);
  assert.ok(tb.curve >= 6, `${tb.curve} points`);
});

test('the Jacobian does not get the last word: a label that contradicts the index is demoted', () => {
  load('x^2-y^2', '2xy');   // index +2, and here is the label the Jacobian used to give it
  const p = { x: 0, y: 0, type: 'unstable spiral', stab: 'unstable', det: 1, note: '' };
  checkIndices([p], 1);
  assert.deepEqual([p.stab, p.type, p.index], ['degen', 'degenerate', 2]);
  assert.match(p.note, /index \+1/);
});

test('very small is not zero: the field on a circle far from its root', async t => {
  await t.test('ẋ = x⁹, ẏ = −y is 10⁻¹⁸ at (0.01, 0), and the index is that of the root inside', () => {
    load('x^9', '-y');
    for (const R of [1, 0.1, 0.01, 1e-3, 1e-5]) assert.deepEqual(circleIndex(0, 0, R), { index: -1, fail: null }, `R = ${R}`);
  });
  await t.test('ẋ = x³, ẏ = −y', () => {
    load('x^3', '-y');
    for (const R of [1, 0.01, 1e-5]) assert.deepEqual(circleIndex(0, 0, R), { index: -1, fail: null }, `R = ${R}`);
  });
  await t.test('and a real zero is still found: the circle through the root of x⁹, −y', () => {
    load('x^9', '-y');
    assert.equal(circleIndex(1, 0, 1).fail.kind, 'fixed');
  });
});

// a small deterministic generator, so that a failure can be reproduced
const random = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const useField = (f, g) => use({ f, g, E: null, used: [], vars: ['x', 'y'], polyF: [], polyG: [], crnErr: 'not symbolic', jsonF: 0, jsonG: 0 });

test('random fields whose linear part is known: the label is what algebra says', () => {
  const rnd = random(20261105), U = (a, b) => a + (b - a) * rnd();
  const terms = [(u, w) => [u * u, u * w], (u, w) => [Math.sin(u) * w, 1 - Math.cos(w)], (u, w) => [u * u * u - w * w, Math.exp(u * w) - 1], (u, w) => [u * w * Math.cos(u), (u + w) ** 2]];
  for (let i = 0; i < 200; i++) {
    const sc = 10 ** U(-3, 3), [a, b, c, d] = [U(-2, 2) * sc, U(-2, 2) * sc, U(-2, 2) * sc, U(-2, 2) * sc];
    const A = rnd() < 0.5 ? 0 : U(-2, 2), B = rnd() < 0.5 ? 0 : U(-2, 2), Q = terms[i % terms.length], q = U(-1, 1) * sc;
    useField((x, y) => a * (x - A) + b * (y - B) + q * Q(x - A, y - B)[0], (x, y) => c * (x - A) + d * (y - B) + q * Q(x - A, y - B)[1]);
    const r = 10 ** U(-4, 0.3), fps = equilibria(win(A + U(-0.4, 0.4) * r, B + U(-0.4, 0.4) * r, r), 81, 81, {}).fps;
    const p = fps.find(p => Math.hypot(p.x - A, p.y - B) < 1e-7 * (1 + r)), tau = a + d, det = a * d - b * c, disc = tau * tau - 4 * det;
    const want = det < 0 ? 'saddle' : `${tau < 0 ? 'stable' : 'unstable'} ${disc > 0 ? 'node' : 'spiral'}`;
    assert.ok(p, `case ${i}: not found`);
    assert.equal(p.type, want, `case ${i}: J = ${[a, b, c, d]}`);
  }
});

test('random degenerate points, turned and moved: never a hyperbolic label', () => {
  const rnd = random(4242), U = (a, b) => a + (b - a) * rnd();
  const forms = [(u, w) => [u * u - w * w, 2 * u * w], (u, w) => [u * u, w * w], (u, w) => [u * u * u, -w], (u, w) => [u * u, -w], (u, w) => [-w * (u * u + w * w), u * (u * u + w * w)], (u, w) => [u * w, u * u - w * w], (u, w) => [Math.sin(u) ** 2, 1 - Math.cos(w)]];
  for (let i = 0; i < 200; i++) {
    const th = U(0, 2 * Math.PI), C = Math.cos(th), S = Math.sin(th), sc = 10 ** U(-3, 3), A = rnd() < 0.3 ? 0 : U(-2, 2), B = rnd() < 0.3 ? 0 : U(-2, 2), Q = forms[i % forms.length];
    const uv = (x, y) => Q(C * (x - A) + S * (y - B), -S * (x - A) + C * (y - B));
    useField((x, y) => { const [e, h] = uv(x, y); return sc * (C * e - S * h); }, (x, y) => { const [e, h] = uv(x, y); return sc * (S * e + C * h); });
    const r = 10 ** U(-4, 0.3), tb = fpTable(equilibria(win(A + U(-0.4, 0.4) * r, B + U(-0.4, 0.4) * r, r), 81, 81, {}).fps);
    assert.equal(tb.curve, 0, `case ${i}`);
    assert.deepEqual(tb.rows.map(([p]) => p.type), ['degenerate'], `case ${i}, form ${i % forms.length}, r = ${r}`);
  }
});

test('"stable" and "unstable" agree with the flow, integrated with nothing from core.js', () => {
  const rnd = random(777), U = (a, b) => a + (b - a) * rnd();
  const rk4 = (f, g, x, y, dt, N) => {
    for (let i = 0; i < N; i++) {
      const a1 = f(x, y), b1 = g(x, y), a2 = f(x + dt * a1 / 2, y + dt * b1 / 2), b2 = g(x + dt * a1 / 2, y + dt * b1 / 2);
      const a3 = f(x + dt * a2 / 2, y + dt * b2 / 2), b3 = g(x + dt * a2 / 2, y + dt * b2 / 2), a4 = f(x + dt * a3, y + dt * b3), b4 = g(x + dt * a3, y + dt * b3);
      x += dt / 6 * (a1 + 2 * a2 + 2 * a3 + a4); y += dt / 6 * (b1 + 2 * b2 + 2 * b3 + b4);
    }
    return [x, y];
  };
  let checked = 0;
  for (let i = 0; i < 40; i++) {
    const [a, b, c, d, p2, p3] = [U(-2, 2), U(-2, 2), U(-2, 2), U(-2, 2), U(-1, 1), U(-1, 1)];
    const f = (x, y) => a * x + b * y + p2 * x * y + 0.3 * Math.sin(x * x), g = (x, y) => c * x + d * y + p3 * x * x - 0.2 * y * y * y;
    useField(f, g);
    for (const p of equilibria(win(0, 0, 2), 81, 81, {}).fps) {
      if (p.stab !== 'stable' && p.stab !== 'unstable') continue;
      const rate = Array.isArray(p.eig[0]) ? Math.abs(p.eig[0][0]) : Math.min(...p.eig.map(Math.abs));
      if (rate < 0.01) continue;
      const dir = p.stab === 'stable' ? 1 : -1, T = 12 / rate, N = Math.min(8000, Math.ceil(T / 0.005));
      const [X, Y] = rk4((x, y) => dir * f(x, y), (x, y) => dir * g(x, y), p.x + 1e-4, p.y + 5e-5, T / N, N);
      assert.ok(Math.hypot(X - p.x, Y - p.y) < Math.hypot(1e-4, 5e-5), `${p.type} at (${p.x}, ${p.y}), case ${i}`);
      checked++;
    }
  }
  assert.ok(checked > 10, `only ${checked} points checked`);
});

test('a number is small against its own scale, not against 1', () => {
  assert.equal(fmt(-2e-12, 2e-12), '-2e-12');
  assert.equal(fmt(3e-17, 1), '0');
  assert.equal(fmt(1.5), '1.5');
});

// ---------- reaction networks ----------

test('mass-action networks (Hárs–Tóth)', async t => {
  await t.test('rabbits vs sheep is realizable', () => {
    load('x(3-x-2y)', 'y(2-x-y)');
    const crn = buildCRN();
    assert.equal(crn.err, undefined);
    assert.ok(crn.rx.length > 0);
  });
  await t.test('ẋ = −y has a negative term without x: not realizable', () => {
    load('-y', 'x');
    assert.match(buildCRN().err, /negative cross-effect/);
  });
  await t.test('a polar system is not read as a network', () => {
    load('r', '1', { polar: true });
    assert.match(buildCRN().err, /ẋ, ẏ form/);
  });
});
