const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const M=require('../model.js'),p={...M.defaults};
const s=M.structure(p);
assert.equal(s.tc,.5);assert.ok(Math.abs(s.sn-.4)<1e-12);assert.ok(s.bistable);
assert.ok(Math.abs(s.roots[0]-.3048058984)<1e-9);assert.ok(Math.abs(s.roots[1]-.8201941016)<1e-9);
for(const u of [.1,.4,.75,.9]){const tr=M.trajectory(p,u,.05),e=M.destination(p,u,.05),last=tr.at(-1);assert.ok(Math.abs(last[1]-e.u)<1e-4);for(const row of tr){assert.ok(Math.min(...row.slice(1))>=-1e-12);assert.ok(Math.abs(row[1]+row[2]+row[3]-1)<1e-12);}}
const saddle=s.points.find(e=>e.name==='E+');const on=M.trajectory(p,saddle.u,.1);assert.ok(on.every(row=>Math.abs(row[1]-saddle.u)<1e-10));
for(const e of s.points){const [a,b]=M.rhs(e.u,e.c,p);assert.ok(Math.hypot(a,b)<1e-12);}
const recovery=M.structure({...p,sigma:.4});assert.equal(recovery.tc,s.tc);assert.equal(recovery.sn,s.sn);assert.ok(recovery.points.find(e=>e.name==='E−').d<s.points.find(e=>e.name==='E−').d);
assert.equal(M.structure({...p,rho:.42}).bistable,false);
const exact=M.trajectory({...p,lambda:.8},1,0).at(-1);assert.equal(exact[1],1);assert.equal(exact[2],0);
for(const pp of [{...p,lambda:1.2,mu:.6,kappa:.8,rho:.6,sigma:.6},{...p,lambda:.02,rho:.01,kappa:.01,mu:.01,sigma:.01},{...p,lambda:.4}])for(const start of [[0,0],[0,1],[1,0],[.1,.9]]){const tr=M.trajectory(pp,...start);assert.ok(tr.every(row=>row.every(Number.isFinite)&&Math.min(...row.slice(1))>=-1e-10));}
const loop=M.sweep(p);assert.ok(loop.flat().every(pt=>pt.every(Number.isFinite)&&pt[1]>=0&&pt[1]<=1.00000001));const nearUp=loop[0].reduce((a,b)=>Math.abs(a[0]-.45)<Math.abs(b[0]-.45)?a:b),nearDown=loop[1].reduce((a,b)=>Math.abs(a[0]-.45)<Math.abs(b[0]-.45)?a:b);assert.ok(nearUp[1]>.9);assert.ok(nearDown[1]<.5);
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');const katex=require('../vendor/katex/katex.min.js');let formulas=0;for(const m of html.matchAll(/data-tex="([^"]+)"/g)){katex.renderToString(m[1],{throwOnError:true,strict:'ignore'});formulas++;}assert.ok(formulas>=15);assert.ok(!/\.pdf|pdf[- ]?отч[её]т/i.test(html));for(const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)){if(!/^https?:/.test(m[1]))assert.ok(fs.existsSync(path.join(__dirname,'..',m[1])),m[1]);}
console.log(`PASS: equilibria, basins, invariant separatrix, conservation, boundary states, extreme rates, recovery, hysteresis and ${formulas} KaTeX formulas.`);
