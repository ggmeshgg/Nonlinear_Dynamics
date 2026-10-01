/* Pure two-state dynamics and a bounded arithmetic-expression parser. No eval. */
(function (root) {
  'use strict';
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const functions = {sqrt: [Math.sqrt,1], abs:[Math.abs,1], sin:[Math.sin,1], cos:[Math.cos,1], exp:[Math.exp,1], tanh:[Math.tanh,1], min:[Math.min,2], max:[Math.max,2], clamp:[clamp,3]};
  const variables = new Set(['h','z','t','e','target','KI','KP','qstar','umax','c','u0','pi','uc','u']);
  function compile(source, allowActuator = false) {
    if (!source.trim() || source.length > 400) throw Error('Use a formula between 1 and 400 characters.');
    const tokens=[]; let pos=0;
    const pattern=/\s*(?:(\d*\.\d+|\d+\.?\d*)([eE][+-]?\d+)?|([A-Za-z_][A-Za-z_0-9]*)|(>=|<=|==|!=|[+\-*/^(),?:<>]))/y;
    while(pos<source.length) {
      if (!source.slice(pos).trim()) break;
      pattern.lastIndex=pos; const m=pattern.exec(source);
      if (!m) throw Error('Unrecognized character near “'+source.slice(pos,pos+12)+'”.');
      tokens.push(m[1] ? {type:'number',value:Number(m[1]+(m[2]||''))}: {type:m[3]?'name':'op',value:m[3]||m[4]}); pos=pattern.lastIndex;
    }
    let index=0; const peek=()=>tokens[index]?.value;
    const take=(v)=>{if(peek()!==v)throw Error('Expected “'+v+'”.');index++;};
    const precedence={'==':1,'!=':1,'<':1,'>':1,'<=':1,'>=':1,'+':2,'-':2,'*':3,'/':3,'^':5};
    function expression(min=0) {
      const token=tokens[index++]; if(!token)throw Error('Formula ends too early.');
      let node;
      if(token.type==='number') node={kind:'number',value:token.value};
      else if(token.value==='-'||token.value==='+') node={kind:'unary',op:token.value,arg:expression(4)};
      else if(token.value==='('){node=expression();take(')');}
      else if(token.type==='name') {
        if(peek()==='(') {
          if(!Object.hasOwn(functions,token.value))throw Error('Unknown function: '+token.value);
          index++;const args=[];if(peek()!==')'){args.push(expression());while(peek()===','){index++;args.push(expression());}}take(')');
          if(args.length!==functions[token.value][1])throw Error(token.value+' needs '+functions[token.value][1]+' arguments.');
          node={kind:'call',name:token.value,args};
        } else {
          if(!variables.has(token.value)||(!allowActuator&&['uc','u'].includes(token.value)))throw Error('Unknown or unavailable variable: '+token.value);
          node={kind:'variable',name:token.value};
        }
      } else throw Error('Unexpected token: '+token.value);
      while(Object.hasOwn(precedence,peek())&&precedence[peek()]>=min) {
        const op=tokens[index++].value;const right=expression(precedence[op]+(op==='^'?0:1));node={kind:'binary',op,left:node,right};
      }
      if(min===0&&peek()==='?'){index++;const yes=expression();take(':');const no=expression();node={kind:'conditional',test:node,yes,no};}
      return node;
    }
    const tree=expression();if(index!==tokens.length)throw Error('Unexpected token: '+peek());
    function evaluate(n,v) {
      if(n.kind==='number')return n.value;
      if(n.kind==='variable')return n.name==='pi'?Math.PI:v[n.name];
      if(n.kind==='unary')return(n.op==='-'?-1:1)*evaluate(n.arg,v);
      if(n.kind==='call')return functions[n.name][0](...n.args.map(a=>evaluate(a,v)));
      if(n.kind==='conditional')return evaluate(n.test,v)?evaluate(n.yes,v):evaluate(n.no,v);
      const a=evaluate(n.left,v),b=evaluate(n.right,v);
      switch(n.op){case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':return a/b;case '^':return a**b;case '<':return +(a<b);case '>':return +(a>b);case '<=':return +(a<=b);case '>=':return +(a>=b);case '==':return +(a===b);case '!=':return +(a!==b);}
    }
    return vars=>{const value=evaluate(tree,vars);if(!Number.isFinite(value))throw Error('Formula produced a non-finite result. Check division and square roots.');return value;};
  }
  const defaults={controller:'integral',KI:1,KP:1.4,u0:.6,umax:1,c0:.6,c1:1.4,target:1,t1:8,t2:28,T:70,h0:1,z0:.6,enabled:true,command:'KI * z',memory:'e'};
  function makeController(p) {
    if(p.controller==='custom') return {command:compile(p.command),memory:compile(p.memory,true)};
    if(p.controller==='manual')return {command:v=>v.u0,memory:()=>0};
    if(p.controller==='proportional')return {command:v=>v.qstar+v.KP*v.e,memory:()=>0};
    return {command:v=>v.KI*v.z,memory:v=>v.e};
  }
  function demand(p,t){return p.enabled&&t>=p.t1&&t<p.t2?p.c1:p.c0;}
  function evaluate(p,controller,t,h,z,cOverride) {
    h=Math.max(0,h);const c=cOverride??demand(p,t);
    const vars={h,z,t,e:p.target-h,target:p.target,KI:p.KI,KP:p.KP,qstar:p.c0*Math.sqrt(p.target),umax:p.umax,c,u0:p.u0};
    const uc=controller.command(vars),u=clamp(uc,0,p.umax),q=c*Math.sqrt(h),dz=controller.memory({...vars,uc,u});
    const dh=u-q;
    if(![uc,u,q,dz,dh].every(Number.isFinite))throw Error('Controller produced a non-finite state.');
    return {t,h,z,e:vars.e,uc,u,q,c,dh,dz,branch:c>p.c0+1e-8};
  }
  function simulate(parameters,dt=.01) {
    const p={...defaults,...parameters};
    if(!(p.KI>0&&p.umax>0&&p.c0>0&&p.c1>=p.c0&&p.target>0&&p.h0>=0&&p.t2>p.t1&&p.t1>=0&&p.T>p.t2&&dt>0))throw Error('Check the parameter ranges and branch opening / closing times.');
    const ctrl=makeController(p),data=[];let t=0,h=p.h0,z=p.z0,nextSample=0;
    data.push(evaluate(p,ctrl,t,h,z));
    while(t<p.T-1e-10) {
      // Split at switching times; all RK stages use the same side of a demand jump.
      const boundary=t<p.t1-1e-9?p.t1:t<p.t2-1e-9?p.t2:p.T;
      const step=Math.min(dt,boundary-t,p.T-t),c=demand(p,t+1e-8);
      const f=(tt,hh,zz)=>evaluate(p,ctrl,tt,Math.max(0,hh),zz,c);
      const a=f(t,h,z),b=f(t+step/2,h+a.dh*step/2,z+a.dz*step/2),d=f(t+step/2,h+b.dh*step/2,z+b.dz*step/2),e=f(t+step,h+d.dh*step,z+d.dz*step);
      h=Math.max(0,h+step*(a.dh+2*b.dh+2*d.dh+e.dh)/6);z+=step*(a.dz+2*b.dz+2*d.dz+e.dz)/6;t+=step;
      if(Math.abs(t-boundary)<1e-8)t=boundary;
      if(!Number.isFinite(h)||!Number.isFinite(z)||h>1e4||Math.abs(z)>1e5)throw Error('This controller leaves the supported plot range. Reduce its gains or change the formula.');
      if(t>=nextSample+.05-1e-9||Math.abs(t-boundary)<1e-8||t>=p.T-1e-9){data.push(evaluate(p,ctrl,t,h,z));nextSample=t;}
    }
    const at=time=>{
      const tt=clamp(time,0,p.T);let lo=0,hi=data.length-1;
      while(lo+1<hi){const m=(lo+hi)>>1;if(data[m].t<tt)lo=m;else hi=m;}
      const a=data[lo],b=data[hi],fraction=clamp((tt-a.t)/(b.t-a.t||1),0,1);
      return evaluate(p,ctrl,tt,a.h+(b.h-a.h)*fraction,a.z+(b.z-a.z)*fraction);
    };
    const after=data.filter(s=>s.t>=p.t2);const peak=after.reduce((a,b)=>b.h>a.h?b:a,after[0]);
    let crossing=null;
    for(let i=1;i<after.length;i++)if(after[i-1].h<p.target&&after[i].h>=p.target){const a=after[i-1],b=after[i];crossing=a.t+(p.target-a.h)/(b.h-a.h)*(b.t-a.t);break;}
    const close=at(p.t2);let saturation=0,censored=false;
    if(close.uc>=p.umax-1e-8){const leave=after.find(s=>s.uc<p.umax-1e-8);saturation=(leave?leave.t:p.T)-p.t2;censored=!leave;}
    return {p,ctrl,data,at,peak,crossing,close,saturation,censored};
  }
  const api={defaults,clamp,compile,makeController,demand,evaluate,simulate};root.DripModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
