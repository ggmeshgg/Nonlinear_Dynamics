'use strict';
(function(root){
const EPS=1e-10;
function spending(p,I){return p.g+(p.mode==='constant'?0:p.mode==='linear'?p.k*I:p.k*I*I);}
function slope(p,I){return p.mode==='constant'?0:p.mode==='linear'?p.k:2*p.k*I;}
function rhs(p,s){return [s[0]-p.a*s[1],p.b*(s[0]-s[1]-spending(p,s[0]))];}
function potential(p,I){return p.b*((p.a-1)*I*I/2-p.a*p.g*I-(p.mode==='constant'?0:p.mode==='linear'?p.a*p.k*I*I/2:p.a*p.k*I*I*I/3));}
function energy(p,s){return (s[0]-p.a*s[1])**2/2+potential(p,s[0]);}
function classify(p,I){const trace=1-p.b,delta=p.b*(p.a-1-p.a*slope(p,I)),disc=trace*trace-4*delta;let kind;
 if(Math.abs(delta)<EPS)kind=p.b===1?'Вырожденная точка (λ = 0, 0)':'Седло-узел (неустойчив)';
 else if(delta<0)kind='Седло';else if(p.b===1)kind='Центр';else if(Math.abs(disc)<EPS)kind='Вырожденный устойчивый узел';else kind=disc>0?'Устойчивый узел':'Устойчивый фокус';
 const eigs=disc>=0?[(trace+Math.sqrt(disc))/2,(trace-Math.sqrt(disc))/2]:null;
 return {I,C:I/p.a,trace,delta,disc,kind,eigs};}
function equilibria(p){const q=1-1/p.a;let roots=[],line=false;
 if(p.mode==='quadratic'){const d=q*q-4*p.k*p.g;if(d>-EPS){if(Math.abs(d)<EPS)roots=[q/(2*p.k)];else{const s=Math.sqrt(d);roots=[2*p.g/(q+s),(q+s)/(2*p.k)];}}}
 else{const den=q-(p.mode==='linear'?p.k:0);if(Math.abs(den)<EPS)line=p.g===0;else roots=[p.g/den];}
 return {q,critical:p.mode==='quadratic'?q*q/(4*p.k):q,line,points:roots.map(I=>classify(p,I))};}
function rk4(p,s,h){const a=rhs(p,s),b=rhs(p,[s[0]+h*a[0]/2,s[1]+h*a[1]/2]),c=rhs(p,[s[0]+h*b[0]/2,s[1]+h*b[1]/2]),d=rhs(p,[s[0]+h*c[0],s[1]+h*c[1]]);return s.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);}
function integrate(p,start,options={}){const T=options.T??30,dt=options.dt??.01/Math.max(1,p.b/3),stop=options.stopEconomic??true,limit=options.limit??200;let s=start.slice(),t=0,exit=null,reason='horizon';const points=[[0,...s]];
 if(s[0]<0||s[1]<0)exit={t:0,I:s[0],C:s[1]};
 if(exit&&stop)return {points,exit,reason:'boundary',dt};
 for(let n=0;n<100000&&t<T-1e-12;n++){const h=Math.min(dt,T-t),next=rk4(p,s,h);
  if(!next.every(Number.isFinite)){reason='limit';break;}
  if(!exit&&(next[0]<0||next[1]<0)){let lo=0,hi=h;for(let j=0;j<36;j++){const mid=(lo+hi)/2,v=rk4(p,s,mid);if(v[0]<0||v[1]<0)hi=mid;else lo=mid;}const crossing=rk4(p,s,(lo+hi)/2);exit={t:t+(lo+hi)/2,I:crossing[0],C:crossing[1]};if(stop){points.push([exit.t,exit.I,exit.C]);reason='boundary';break;}}
  s=next;t+=h;points.push([t,...s]);if(Math.max(...s.map(Math.abs))>limit){reason='limit';break;}
 }
 return {points,exit,reason,dt};}
function interpolate(data,t){const pts=data.points;if(t<=0)return pts[0];if(t>=pts[pts.length-1][0])return pts[pts.length-1];let l=0,r=pts.length-1;while(r-l>1){const m=(l+r)>>1;if(pts[m][0]<=t)l=m;else r=m;}const a=pts[l],b=pts[r],f=(t-a[0])/(b[0]-a[0]);return [t,a[1]+f*(b[1]-a[1]),a[2]+f*(b[2]-a[2])];}
function stableManifold(p,eq,M=6){if(!eq.eigs||eq.delta>=-EPS)return [];const lambda=Math.min(...eq.eigs),v=[p.a,1-lambda],norm=Math.hypot(...v);v[0]/=norm;v[1]/=norm;const eps=1e-5*Math.max(1,Math.abs(eq.I)),out=[];
 for(const sign of [-1,1]){let s=[eq.I+sign*eps*v[0],eq.C+sign*eps*v[1]],path=[s.slice()],left=false;const h=-.005/Math.max(1,p.b/3);for(let i=0;i<24000;i++){s=rk4(p,s,h);if(!s.every(Number.isFinite)||Math.abs(s[0])>M*3||Math.abs(s[1])>M*3)break;const d=Math.hypot(s[0]-eq.I,s[1]-eq.C);if(d>eps*100)left=true;if(i%5===0)path.push(s.slice());if(left&&d<eps*5)break;}out.push(path);}
 return out;}
const api={spending,slope,rhs,potential,energy,classify,equilibria,rk4,integrate,interpolate,stableManifold};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Economy=api;
})(typeof globalThis!=='undefined'?globalThis:this);
