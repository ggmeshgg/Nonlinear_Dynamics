// Known answers for the Phase Plane Lab mathematics. Every expected value here comes from the analysis of the
// system (Strogatz, or a line of algebra in the comment), not from what the code happened to print.
// Run: npm test (in phase-plane/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  P, use, compileLatex, buildModel, fx, gy, jac, trajectory, symbolicDiv, detectStructure, equilibria, fpTable,
  buildCRN, bifSweep, findCycles, polarCycleFn,
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
