(function (root) {
  "use strict";
  const response = (q, k) => k * q * Math.exp(-q);
  const derivative = (q, k) => k * Math.exp(-q) * (1 - q);
  const early = { as: 1.2, ar: 1, k: 15 };
  const forgetting = { as: 0, ar: 0, k: 0 };

  function field(r, s, p) {
    return [-r + p.as + response(s, p.k), -s + p.ar + response(r, p.k)];
  }

  function step(r, s, dt, p) {
    const a = field(r, s, p);
    const b = field(r + dt * a[0] / 2, s + dt * a[1] / 2, p);
    const c = field(r + dt * b[0] / 2, s + dt * b[1] / 2, p);
    const d = field(r + dt * c[0], s + dt * c[1], p);
    return [
      r + dt * (a[0] + 2 * b[0] + 2 * c[0] + d[0]) / 6,
      s + dt * (a[1] + 2 * b[1] + 2 * c[1] + d[1]) / 6
    ];
  }

  function bisect(fn, a, b) {
    let sign = Math.sign(fn(a));
    for (let i = 0; i < 45; i++) {
      const m = (a + b) / 2;
      const v = fn(m);
      if (v === 0) return m;
      if (Math.sign(v) === sign) a = m;
      else b = m;
    }
    return (a + b) / 2;
  }

  function equilibria(p) {
    if (p.k === 0) return [{ r: p.as, s: p.ar, product: 0, type: "node" }];
    const sOf = r => p.ar + response(r, p.k);
    const residual = r => p.as + response(sOf(r), p.k) - r;
    const slope = r => derivative(r, p.k) * derivative(sOf(r), p.k) - 1;
    const lo = p.as, hi = p.as + p.k / Math.E;
    // Split at stationary points so close pairs can be resolved near a fold.
    const edges = [lo];
    let previous = lo;
    for (let i = 1; i <= 2048; i++) {
      const r = lo + (hi - lo) * i / 2048;
      if (slope(previous) * slope(r) < 0) edges.push(bisect(slope, previous, r));
      previous = r;
    }
    edges.push(hi);
    const roots = [];
    for (let i = 0; i < edges.length; i++) {
      const a = edges[i];
      if (Math.abs(residual(a)) < 1e-10) roots.push(a);
      if (i + 1 < edges.length && residual(a) * residual(edges[i + 1]) < 0) {
        roots.push(bisect(residual, a, edges[i + 1]));
      }
    }
    return roots.filter((r, i) => i === 0 || r - roots[i - 1] > 1e-7).map(r => {
      const s = sOf(r), product = derivative(r, p.k) * derivative(s, p.k);
      const type = Math.abs(product - 1) < 1e-6 ? "critical" :
        product > 1 ? "saddle" : product < 0 ? "focus" : "node";
      return { r, s, type, product };
    });
  }

  function simulate(p, start, end = 20, story = null) {
    let [r, s] = start;
    const rows = [{ t: 0, r, s }];
    const phases = story ? [
      { start: 0, end: story.cut, p, name: "До разлуки" },
      { start: story.cut, end: story.cut + story.pause, p: forgetting, name: "Разлука" },
      { start: story.cut + story.pause, end, p: { ...p, ar: story.arLate }, name: "После войны" }
    ] : [{ start: 0, end, p, name: "Постоянные параметры" }];
    for (const phase of phases) {
      const count = Math.ceil((phase.end - phase.start) / .02);
      if (!count) continue;
      const dt = (phase.end - phase.start) / count;
      for (let i = 1; i <= count; i++) {
        [r, s] = step(r, s, dt, phase.p);
        rows.push({ t: phase.start + i * dt, r, s });
      }
    }
    return { rows, phases, end };
  }

  function pointAt(run, t) {
    let a = 0, b = run.rows.length - 1;
    while (b - a > 1) {
      const m = (a + b) >> 1;
      if (run.rows[m].t <= t) a = m;
      else b = m;
    }
    const left = run.rows[a], right = run.rows[b];
    const f = Math.max(0, Math.min(1, (t - left.t) / (right.t - left.t)));
    return { t, r: left.r + f * (right.r - left.r), s: left.s + f * (right.s - left.s) };
  }

  function separatrix(point, p, limit) {
    const a = derivative(point.s, p.k), eigen = -Math.sqrt(point.product);
    const norm = Math.hypot(a, eigen);
    return [-1, 1].map(sign => {
      let r = point.r + sign * 1e-5 * a / norm;
      let s = point.s + sign * 1e-5 * eigen / norm;
      const result = [{ r: point.r, s: point.s }];
      for (let i = 0; i < 1600 && r >= 0 && s >= 0 && r <= limit && s <= limit; i++) {
        result.push({ r, s });
        [r, s] = step(r, s, -.0125, p);
      }
      return result;
    });
  }

  const api = { early, response, field, equilibria, simulate, pointAt, separatrix };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WindModel = api;
})(typeof window === "undefined" ? globalThis : window);
