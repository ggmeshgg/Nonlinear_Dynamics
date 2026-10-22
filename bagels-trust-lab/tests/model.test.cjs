const assert=require('node:assert/strict');
const M=require('../model.js');
let checks=0;
function near(x,y,tol=1e-8){assert.ok(Math.abs(x-y)<tol,`${x} vs ${y}; tolerance ${tol}`);checks++;}
function ok(value,message){assert.ok(value,message);checks++;}
near(M.separatrix(.8),.3071211677707627,1e-12);
near(M.classify({...M.defaults,p0:.3}).q,.8858898993160496,1e-12);
near(M.classify(M.defaults).min,.42269848436117186,1e-12);
ok(M.classify({...M.defaults,p0:.2}).kind==='loss');
ok(M.classify({...M.defaults,p0:.32}).kind==='trust');
ok(M.classify({...M.defaults,p0:M.separatrix(.8)}).kind==='critical');
ok(M.classify({...M.defaults,p0:0,q0:.95}).kind==='fixed');
ok(M.classify({...M.defaults,p0:1,q0:0}).kind==='fixed');
for(const [p,q] of [[0,0],[0,1],[1,0],[1,1]]){
 const tr=M.simulate({...M.defaults,p0:p,q0:q,horizon:20});near(tr.at(-1).p,p);near(tr.at(-1).q,q);
}
for(const s of [M.defaults,{...M.defaults,alpha:.25,p0:.2},{...M.defaults,alpha:2,beta:.7,a:2,b:4,p0:.7,q0:.75}]){
 const setting={...s,horizon:8},tr=M.simulate(setting),finer=M.simulate(setting,{stepScale:.5}),k=M.invariant(setting.p0,setting.q0,setting);
 let error=0,drift=0;
 for(let i=0;i<tr.length;i++){
   const v=tr[i];ok(v.p>=0&&v.p<=1&&v.q>=0&&v.q<=1,'square invariant');
   if(i)ok(v.q>=tr[i-1].q,'honesty monotone');
   // K is singular at p=q=1; avoid subtracting nearly equal machine numbers.
   if(v.p<1-1e-6&&v.q<1-1e-6)drift=Math.max(drift,Math.abs(M.invariant(v.p,v.q,setting)-k));
   error=Math.max(error,Math.abs(v.p-finer[i].p),Math.abs(v.q-finer[i].q));
 }
 ok(drift<1e-6,'first integral conserved');ok(error<1e-7,'step convergence');
}
for(const params of [{p0:1,q0:.2},{q0:1,p0:.2},{q0:0,p0:.8}]){
 const s={...M.defaults,...params,horizon:2},tr=M.simulate(s);
 const initial=params.p0===1?s.q0:s.p0,exponent=params.q0===0?9:-1;
 near(params.p0===1?tr.at(-1).q:tr.at(-1).p,1/(1+(1-initial)/initial*Math.exp(exponent*2)),1e-8);
}
const extended={...M.defaults,p0:0,q0:.7,epsilon:.08,mu:.003,horizon:80};
ok(M.classify(extended).kind==='extended');
ok(M.rhs(0,.7,extended)[0]>0,'mutation leaves zero trust');
ok(M.rhs(1,.7,extended)[0]<0,'mutation inward at full trust');
const tr=M.simulate(extended);ok(tr.at(-1).p>0);ok(tr.at(-1).q>.7);
ok(M.separatrix(.8,{...M.defaults,alpha:.25})<M.separatrix(.8));
ok(M.separatrix(.8,{...M.defaults,alpha:4})>M.separatrix(.8));
console.log(`PASS: ${checks} mathematical checks (thresholds, exact solutions, boundary invariance, first integral, convergence, extensions).`);
