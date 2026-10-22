/* Pure model, shared by the browser and numerical checks. No dependencies. */
(function (root) {
  'use strict';
  const defaults = Object.freeze({ p0: .6, q0: .8, alpha: 1, beta: 1, a: 1, b: 9, epsilon: 0, mu: 0, horizon: 45 });
  const clamp = (x, lo=0, hi=1) => Math.min(hi, Math.max(lo, x));
  function rhs(p,q,s=defaults) {
    return [s.alpha*p*(1-p)*((s.a+s.b)*q-s.b)+s.mu*(1-2*p),
      s.beta*q*(1-q)*(p+s.epsilon*(1-p))];
  }
  function step(p,q,h,s) {
    const a=rhs(p,q,s),b=rhs(p+h*a[0]/2,q+h*a[1]/2,s),c=rhs(p+h*b[0]/2,q+h*b[1]/2,s),d=rhs(p+h*c[0],q+h*c[1],s);
    return [clamp(p+h*(a[0]+2*b[0]+2*c[0]+d[0])/6),clamp(q+h*(a[1]+2*b[1]+2*c[1]+d[1])/6)];
  }
  const threshold=s=>s.b/(s.a+s.b);
  const isBase=s=>s.epsilon===0&&s.mu===0;
  const logF=(q,s)=>s.b*Math.log(q)+s.a*Math.log1p(-q);
  function separatrix(q,s=defaults) {
    if(q<=0) return 1;
    if(q>=threshold(s)) return 0;
    return -Math.expm1(s.alpha/s.beta*(logF(q,s)-logF(threshold(s),s)));
  }
  function invariant(p,q,s=defaults) {return Math.log1p(-p)-s.alpha/s.beta*logF(q,s);}
  function classify(s) {
    const {p0:p,q0:q}=s, qs=threshold(s);
    if(!isBase(s))return {kind:'extended',title:'Расширенная модель',text:'Показан численный сценарий до выбранного времени. Формула сепаратрисы исходной модели здесь не применяется.'};
    if(p===0)return {kind:'fixed',title:'Доверие отсутствует',p:0,q,text:'Вся левая сторона неподвижна: исчезнувшая стратегия сама не возникает. Это верно даже выше порога честности.'};
    if(p===1&&q===0)return {kind:'fixed',title:'Неустойчивый угол',p:1,q:0,text:'Точно в (1, 0) движение отсутствует. Но малое появление честных покупателей меняет дальнейшее движение.'};
    if(q===0)return {kind:'loss',title:'Доверие исчезнет',p:0,q:0,text:'Честная стратегия изначально отсутствует. Контроль вытесняет доверие, а q остаётся нулём.'};
    if(p===1||q>=qs)return {kind:'trust',title:'К полному доверию',p:1,q:1,text:q>=qs?'Честность уже достигла порога. При положительном доверии система стремится к (1, 1).':'На правой стороне p = 1: честность растёт к единице по логистическому закону.'};
    const ps=separatrix(q,s),distance=p-ps;
    if(Math.abs(distance)<1e-10)return {kind:'critical',title:'На границе исходов',p:0,q:qs,ps,text:'Траектория приближается к пороговой точке (0, q*). Сходимость медленная; конечный кадр ещё не является пределом.'};
    if(distance>0)return {kind:'trust',title:'Доверие восстановится',p:1,q:1,ps,min:1-Math.exp(invariant(p,q,s)+s.alpha/s.beta*logF(qs,s)),text:'Сначала доверие падает. Покупатели успевают перейти порог честности, и доверие начинает расти.'};
    const k=invariant(p,q,s),r=s.alpha/s.beta;
    let lo=q,hi=qs;
    for(let i=0;i<80;i++){const mid=(lo+hi)/2;if(-r*logF(mid,s)>k)lo=mid;else hi=mid;}
    return {kind:'loss',title:'Ловушка недоверия',p:0,q:(lo+hi)/2,ps,text:'Доверие затухает прежде, чем честность достигает порога. Честность немного растёт, затем её изменение останавливается.'};
  }
  function simulate(s=defaults,{samples=1800,stepScale=1}={}) {
    const dt=s.horizon/samples,maxStep=.012*stepScale/Math.max(1,s.alpha*(s.a+s.b)/10,s.beta/2);
    const sub=Math.max(1,Math.ceil(dt/maxStep)),h=dt/sub;
    let p=s.p0,q=s.q0;const data=[{t:0,p,q}];
    for(let i=1;i<=samples;i++){for(let j=0;j<sub;j++)[p,q]=step(p,q,h,s);data.push({t:i*dt,p,q});}
    return data;
  }
  const api={defaults,clamp,rhs,step,threshold,isBase,logF,separatrix,invariant,classify,simulate};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TrustModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
