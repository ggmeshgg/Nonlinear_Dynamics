const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./model.js');
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} differs from ${b}`);

test('nominal integral equilibrium stays fixed',()=>{
  const r=M.simulate({enabled:false});for(const s of r.data){near(s.h,1);near(s.z,.6);near(s.u,s.q);}
});
test('fixed inflow approaches the independently known hydraulic balance',()=>{
  const r=M.simulate({controller:'manual',c1:.9,t1:2,t2:60,T:70});
  near(r.at(59).h,(.6/.9)**2,1e-6);near(r.at(59).z,.6);
});
test('high-demand windup follows its saturated asymptote and survives closing',()=>{
  const r=M.simulate({});near(r.at(27).h,(1/1.4)**2,1e-6);
  near(r.at(27).dz,1-(1/1.4)**2,1e-6);
  assert.ok(r.close.z>10);assert.ok(r.crossing>28&&r.crossing<31);
  assert.ok(r.at(r.crossing).uc>1);assert.ok(r.saturation>10);
  assert.ok(r.peak.h>2.4&&r.peak.h<2.6);
});
test('switch changes flow immediately, without a discontinuous state',()=>{
  const r=M.simulate({});const a=r.at(28-1e-8),b=r.at(28);
  near(a.h,b.h,1e-7);near(a.z,b.z,1e-7);near(a.q/b.q,1.4/.6,1e-6);
});
test('RK4 refinement leaves the displayed recovery unchanged',()=>{
  const a=M.simulate({},.01),b=M.simulate({},.005);
  near(a.peak.h,b.peak.h,2e-5);near(a.close.z,b.close.z,2e-5);
  near(a.at(45).h,b.at(45).h,1e-4);
});
test('dry tank remains nonnegative, then can refill',()=>{
  const dry=M.simulate({controller:'manual',u0:0,h0:.05,enabled:false});
  assert.ok(dry.data.every(s=>s.h>=0&&Number.isFinite(s.h)));assert.ok(dry.data.at(-1).h<1e-3);
  const fill=M.simulate({controller:'manual',u0:.6,h0:0,enabled:false});assert.ok(fill.at(5).h>0);
});
test('custom formulas reproduce integral control',()=>{
  const a=M.simulate({}),b=M.simulate({controller:'custom',command:'KI * z',memory:'e'});
  near(a.peak.h,b.peak.h);near(a.close.z,b.close.z);
});
test('formula parser honors precedence and rejects code or invalid values',()=>{
  near(M.compile('-2^2 + 3 * 4')({}),8);near(M.compile('2^3^2')({}),512);
  near(M.compile('h > 0 ? sqrt(h) : 0')({h:4}),2);
  near(M.compile('clamp(-2, 0, 1)')({}),0);
  assert.throws(()=>M.compile('window.location = 1'));
  assert.throws(()=>M.compile('constructor(1)'));
  assert.throws(()=>M.compile('u + 1'));
  assert.throws(()=>M.compile('1/0')({}));
  assert.throws(()=>M.compile('sqrt(-1)')({}));
});
test('compensated center preserves its small unsaturated orbit',()=>{
  const r=M.simulate({controller:'custom',command:'c * sqrt(h) + z - 0.6',memory:'e',enabled:false,h0:1.03,z0:.6});
  for(const s of r.data){near((s.h-1)**2+(s.z-.6)**2,.03**2,1e-8);assert.ok(s.uc>0&&s.uc<1);}
});
