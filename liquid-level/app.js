/* UI and SVG instruments. All physics lives in model.js. */
(() => {
  'use strict';
  const M=window.DripModel,$=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
  const C={cyan:'#7ed4ee',amber:'#eab073',purple:'#c7adf0',red:'#f5969c',grid:'#30414e',muted:'#a5b7c4',text:'#e7eff3'};
  const lessons=[
    {title:'A balance that only works once.',body:'The pump supplies exactly what the first branch drains. Then a second branch opens. A fixed pump cannot notice the falling level: the original plants get fewer drips.',predict:'If you never change the pump, does the tank empty completely—or find a lower balance?',controller:'manual',c1:.9,KI:1,time:0},
    {title:'React to the shortage.',body:'Proportional feedback turns the pump up when the level falls. It helps, but sustaining that extra pumping requires a persistent level error. Increase K_P and watch the offset shrink.',predict:'Can proportional feedback hold exactly h = 1 while the second branch stays open?',controller:'proportional',c1:.9,KI:1,time:0},
    {title:'Give the controller a memory.',body:'Integrating the level error lets the pump sustain a correction even after the error disappears. The target is feasible here. Watch the level recover—and watch memory keep the motion going.',predict:'At the first target crossing, has the controller’s memory returned to its original value?',controller:'integral',c1:.9,KI:.35,time:0},
    {title:'Ask for more than the pump can give.',body:'The second branch now raises total drainage to 1.4 at the target level, but the pump can supply only 1. The level falls. Above the saturation boundary, memory grows without producing any extra inflow.',predict:'What changes when you leave the second branch open longer: the water level, the memory, or both?',controller:'integral',c1:1.4,KI:1,time:18},
    {title:'The branch closes. The memory stays.',body:'The extra branch has just closed. Normal irrigation is feasible again, but the integrator is still wound up. Replay the recovery: the level crosses its target before the pump leaves maximum output.',predict:'Why is the pump still at full power when the level error reaches zero?',controller:'integral',c1:1.4,KI:1,time:28}
  ];
  const regimes=[
    {name:'Stable node',command:'KI * z + 2.7 * e',memory:'e',eigen:'λ ≈ −0.382, −2.618',body:'Strong proportional correction damps the return. Both local eigenvalues are real and negative: nearby trajectories approach equilibrium without spiraling.',predict:'Compare this direct return with the inward spiral.'},
    {name:'Stable spiral',command:'KI * z',memory:'e',eigen:'λ ≈ −0.150 ± 0.989i',body:'Ordinary integral feedback returns to equilibrium with shrinking oscillations. Hydraulic outflow supplies damping.',predict:'Watch successive loops contract toward the equilibrium marker.'},
    {name:'Center',command:'c * sqrt(h) + z - 0.6',memory:'e',eigen:'λ = ± i',body:'This deliberately idealized controller exactly cancels hydraulic outflow, leaving dh/dt = z − 0.6 and dz/dt = 1 − h. Small trajectories are closed orbits while the pump remains unsaturated.',predict:'There is neither decay nor growth. What changes if the command reaches a pump limit?'},
    {name:'Unstable spiral',command:'KI * z - 0.6 * e',memory:'e',eigen:'λ ≈ +0.150 ± 0.989i',body:'Reversed proportional feedback adds water when the level is already high. Small oscillations grow into an outward spiral. Pump limits change the motion once the trajectory leaves the unsaturated region.',predict:'Watch the early loops expand. The full-run graphs show what happens after saturation.'},
    {name:'Unstable node',command:'KI * z - 3 * e',memory:'e',eigen:'λ ≈ +2.257, +0.443',body:'Stronger positive feedback gives two real positive eigenvalues. Nearby trajectories move away without local spiraling; later the pump limits dominate.',predict:'Why does this trajectory escape directly instead of rotating around equilibrium?'},
    {name:'Saddle',command:'qstar - KI * (z - qstar / KI)',memory:'e',eigen:'λ ≈ +0.861, −1.161',body:'The integral command has the wrong sign. One local direction attracts and another repels. A generic small displacement eventually leaves along the unstable direction.',predict:'Inspect the arrows on either side of equilibrium: one direction points in, another points out.'}
  ];
  let step=0,activeRegime=null,p={...M.defaults},run,time=0,playing=false,lastFrame=0,lastPaint=0,chartViews=[],phaseView=null,fieldKey='',pending=false;
  const visibleFlows=new Set(['uc','u','q']);
  const fmt=(n,d=2)=>Number(n).toFixed(d);
  function el(tag,attrs={},parent){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(parent)parent.appendChild(n);return n;}
  function text(parent,x,y,value,attrs={}){const n=el('text',{x,y,...attrs},parent);n.textContent=value;return n;}
  function line(parent,x1,y1,x2,y2,attrs={}){return el('line',{x1,y1,x2,y2,...attrs},parent);}
  function path(parent,d,attrs={}){return el('path',{d,fill:'none',...attrs},parent);}
  function extent(values,refs=[]){let lo=Math.min(...values,...refs),hi=Math.max(...values,...refs);const pad=Math.max((hi-lo)*.12,.08);return[lo-pad,hi+pad];}
  function scale(domain,a,b){const f=v=>a+(v-domain[0])/(domain[1]-domain[0])*(b-a);f.invert=v=>domain[0]+(v-a)/(b-a)*(domain[1]-domain[0]);return f;}
  function tickFormat(v){return Math.abs(v)>=100?fmt(v,0):Math.abs(v)>=10?fmt(v,1):fmt(v,2).replace(/0$/,'').replace(/\.0$/,'');}
  function axes(svg,w,h,xd,yd,xLabel,yLabel){
    const box={l:59,r:w-16,t:21,b:h-40};const x=scale(xd,box.l,box.r),y=scale(yd,box.b,box.t);
    for(let i=0;i<=4;i++){const v=yd[0]+i*(yd[1]-yd[0])/4;line(svg,box.l,y(v),box.r,y(v),{stroke:C.grid,'stroke-width':.7});text(svg,box.l-9,y(v)+4,tickFormat(v),{'text-anchor':'end'});}
    const ticks=w<450?3:5;
    for(let i=0;i<=ticks;i++){const v=xd[0]+i*(xd[1]-xd[0])/ticks;line(svg,x(v),box.t,x(v),box.b,{stroke:C.grid,'stroke-width':.5});text(svg,x(v),box.b+19,tickFormat(v),{'text-anchor':i===0?'start':i===ticks?'end':'middle'});}
    el('rect',{x:box.l,y:box.t,width:box.r-box.l,height:box.b-box.t,fill:'none',stroke:C.grid},svg);
    text(svg,(box.l+box.r)/2,h-3,xLabel,{'text-anchor':'middle',class:'axis-title'});
    text(svg,box.l,12,yLabel,{class:'axis-title'});
    return{x,y,box,w,h};
  }
  function pointsPath(data,key,x,y){return data.map((s,i)=>(i?'L':'M')+fmt(x(s.t),2)+','+fmt(y(s[key]),2)).join('');}
  function seriesWithJumps(){
    const out=[];
    for(const s of run.data){if(p.enabled&&(Math.abs(s.t-p.t1)<1e-7||Math.abs(s.t-p.t2)<1e-7)){out.push(M.evaluate(p,run.ctrl,s.t-1e-7,s.h,s.z));}out.push(s);}return out;
  }
  function drawChart(id,keys,label,references=[],errorArea=false){
    const svg=$(id),w=svg.getBoundingClientRect().width,h=svg.getBoundingClientRect().height;if(w<50)return;
    svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    const data=seriesWithJumps(),domain=extent(data.flatMap(s=>keys.map(k=>s[k.key])),references.map(r=>r.value).concat([0]));
    const view=axes(svg,w,h,[0,p.T],domain,'Time · normalized',label);const{x,y,box}=view;
    const defs=el('defs',{},svg),clip=el('clipPath',{id:id+'-clip'},defs);el('rect',{x:box.l,y:box.t,width:box.r-box.l,height:box.b-box.t},clip);
    const g=el('g',{'clip-path':`url(#${id}-clip)`},svg);
    if(p.enabled)el('rect',{x:x(p.t1),y:box.t,width:x(p.t2)-x(p.t1),height:box.b-box.t,fill:C.amber,opacity:.07},g);
    if(errorArea){for(const sign of [1,-1]){const d='M'+x(0)+','+y(0)+data.map(s=>'L'+x(s.t)+','+y(sign>0?Math.max(0,s.e):Math.min(0,s.e))).join('')+'L'+x(p.T)+','+y(0)+'Z';path(g,d,{fill:sign>0?C.amber:C.cyan,opacity:.19});}}
    for(const r of references){line(g,box.l,y(r.value),box.r,y(r.value),{stroke:r.color||C.muted,'stroke-dasharray':'4 5',opacity:.8});text(svg,box.r-3,y(r.value)-5,r.label,{'text-anchor':'end',style:'font-size:11px'});}
    for(const k of keys)path(g,pointsPath(data,k.key,x,y),{stroke:k.color,'stroke-width':k.key==='uc'?1.7:2,'stroke-dasharray':k.key==='uc'?'5 4':''});
    const cursor=line(g,x(time),box.t,x(time),box.b,{stroke:C.text,'stroke-width':1,opacity:.7});
    const dots=keys.map(k=>el('circle',{r:3.2,fill:k.color,stroke:'#15212b','stroke-width':1.5},g));
    chartViews.push({...view,svg,cursor,dots,keys});
  }
  function phaseDomains(){
    if($('local-phase').checked)return{xd:[.75,1.25],yd:[.35,.85]};
    const hs=run.data.map(s=>s.h),zs=run.data.map(s=>s.z);
    const xd=[0,Math.max(1.5,Math.max(...hs)*1.13)];
    const yd=extent(zs,p.controller==='integral'?[0,p.umax/p.KI]:[0]);
    if(yd[1]-yd[0]<1){yd[0]-=.35;yd[1]+=.35;}return{xd,yd};
  }
  function drawPhaseBase(){
    const svg=$('phase'),w=svg.getBoundingClientRect().width,h=svg.getBoundingClientRect().height;if(w<50)return;
    svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);const{xd,yd}=phaseDomains();
    const defs=el('defs',{},svg),clip=el('clipPath',{id:'phase-clip'},defs);
    const v=axes(svg,w,h,xd,yd,'Water level · h','Controller memory · z');
    el('rect',{x:v.box.l,y:v.box.t,width:v.box.r-v.box.l,height:v.box.b-v.box.t},clip);
    const layer=el('g',{'clip-path':'url(#phase-clip)'},svg),field=el('g',{},layer),trajectory=el('g',{},layer),past=el('g',{},layer);
    line(layer,v.x(1),v.box.t,v.x(1),v.box.b,{stroke:C.muted,'stroke-dasharray':'3 5',opacity:.7});
    text(svg,v.x(1)+5,v.box.t+14,'h★',{style:'font-size:11px'});
    if(p.controller==='integral'){
      const sat=p.umax/p.KI;line(layer,v.box.l,v.y(sat),v.box.r,v.y(sat),{stroke:C.amber,'stroke-dasharray':'5 4',opacity:.8});
      text(svg,v.box.r-4,v.y(sat)-7,'Pump ceiling · z = '+fmt(sat),{'text-anchor':'end',style:'font-size:11px'});
      if(yd[0]<0)line(layer,v.box.l,v.y(0),v.box.r,v.y(0),{stroke:C.muted,'stroke-dasharray':'3 4',opacity:.6});
    }
    function phasePaths(parent,data,opacity,width){
      let d='',lastColor=null;
      for(let i=0;i<data.length;i++){
        const s=data[i],color=p.enabled&&s.t>p.t1&&s.t<=p.t2?C.amber:C.cyan;
        if(color!==lastColor&&d){path(parent,d,{stroke:lastColor,'stroke-width':width,opacity});const prev=data[Math.max(0,i-1)];d='M'+v.x(prev.h)+','+v.y(prev.z);}
        d+=(d?'L':'M')+v.x(s.h)+','+v.y(s.z);lastColor=color;
      }if(d)path(parent,d,{stroke:lastColor,'stroke-width':width,opacity});
    }
    phasePaths(trajectory,run.data,.22,2);
    const marks=el('g',{},layer);
    if(activeRegime!==null){el('circle',{cx:v.x(1),cy:v.y(.6),r:4,fill:'none',stroke:C.text,'stroke-width':1.5},marks);}
    if(p.enabled)for(const[tt,label]of[[p.t1,'Open'],[p.t2,'Close']]){const s=run.at(tt);el('rect',{x:v.x(s.h)-3,y:v.y(s.z)-3,width:6,height:6,fill:C.amber},marks);text(marks,M.clamp(v.x(s.h)+8,v.box.l+4,v.box.r-40),M.clamp(v.y(s.z)-8,v.box.t+14,v.box.b-5),label,{style:'font-size:11px'});}
    const dot=el('circle',{r:5.5,fill:C.text,stroke:'#15212b','stroke-width':2},layer);
    phaseView={...v,xd,yd,svg,field,past,dot,phasePaths};fieldKey='';
  }
  function drawField(s){
    if(!phaseView)return;const key=p.controller==='custom'?`${s.c}:${fmt(s.t,1)}`:String(s.c);if(key===fieldKey)return;fieldKey=key;
    const{x,y,xd,yd,box,field}=phaseView;field.replaceChildren();const nx=16,ny=15;
    const value=(h,z)=>{try{return M.evaluate(p,run.ctrl,s.t,h,z,s.c);}catch{return null;}};
    if(p.controller==='integral'){
      const boundary=M.clamp(y(p.umax/p.KI),box.t,box.b);
      el('rect',{x:box.l,y:box.t,width:box.r-box.l,height:boundary-box.t,fill:C.amber,opacity:.055},field);
    }
    // Custom saturation regions and zero-contours are sampled from the actual formulas.
    for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
      const h0=xd[0]+i*(xd[1]-xd[0])/nx,h1=xd[0]+(i+1)*(xd[1]-xd[0])/nx,z0=yd[0]+j*(yd[1]-yd[0])/ny,z1=yd[0]+(j+1)*(yd[1]-yd[0])/ny;
      const mid=value((h0+h1)/2,(z0+z1)/2);if(!mid)continue;
      if(p.controller!=='integral'&&mid.uc>=p.umax)el('rect',{x:x(h0),y:y(z1),width:x(h1)-x(h0)+.2,height:y(z0)-y(z1)+.2,fill:C.amber,opacity:.055},field);
      const corners=[[h0,z0],[h1,z0],[h1,z1],[h0,z1]].map(([h,z])=>({h,z,v:value(h,z)?.dh}));const hits=[];
      for(let k=0;k<4;k++){const a=corners[k],b=corners[(k+1)%4];if(Number.isFinite(a.v)&&Number.isFinite(b.v)&&((a.v<0&&b.v>=0)||(a.v>=0&&b.v<0))){const f=a.v/(a.v-b.v);hits.push([x(a.h+f*(b.h-a.h)),y(a.z+f*(b.z-a.z))]);}}
      for(let k=0;k+1<hits.length;k+=2)line(field,...hits[k],...hits[k+1],{stroke:C.text,'stroke-width':1.2,'stroke-dasharray':'3 3',opacity:.75});
    }
    for(let i=0;i<11;i++)for(let j=0;j<11;j++){
      const h=xd[0]+(i+.5)*(xd[1]-xd[0])/11,z=yd[0]+(j+.5)*(yd[1]-yd[0])/11,a=value(h,z);if(!a)continue;
      const dx=a.dh*(box.r-box.l)/(xd[1]-xd[0]),dy=-a.dz*(box.b-box.t)/(yd[1]-yd[0]),norm=Math.hypot(dx,dy);if(norm<.001)continue;
      const length=10,ux=dx/norm,uy=dy/norm,cx=x(h),cy=y(z),ex=cx+ux*length/2,ey=cy+uy*length/2;
      path(field,`M${cx-ux*length/2},${cy-uy*length/2}L${ex},${ey}M${ex-ux*3-uy*2},${ey-uy*3+ux*2}L${ex},${ey}L${ex-ux*3+uy*2},${ey-uy*3-ux*2}`,{stroke:C.muted,'stroke-width':.8,opacity:.36});
    }
    $('field-label').textContent=s.branch?'Second-branch field':'Normal-demand field';
  }
  function drawAll(){
    chartViews=[];
    drawChart('level-chart',[{key:'h',color:C.cyan}],'Level · h',[{value:1,label:'target h★ = 1',color:C.amber}]);
    drawChart('memory-chart',[{key:'z',color:C.purple}],'Memory · z',p.controller==='integral'?[{value:p.umax/p.KI,label:'upper saturation',color:C.amber}]:[]);
    drawChart('flow-chart',[{key:'uc',color:C.purple},{key:'u',color:C.cyan},{key:'q',color:C.amber}].filter(k=>visibleFlows.has(k.key)),'Flow · normalized',[{value:p.umax,label:'pump capacity',color:C.muted}]);
    drawChart('error-chart',[{key:'e',color:C.text}],'Error · h★ − h',[{value:0,label:'zero error'}],true);
    drawPhaseBase();update();
  }
  function diagnosis(s){
    if(p.controller==='manual')return s.branch?['NO FEEDBACK',`The extra branch is draining water. The pump stays at ${fmt(s.u)}. With this fixed inflow, the level tends toward h = ${fmt((s.u/s.c)**2)} instead of the target.`]:Math.abs(s.e)<.015?['AT BALANCE','The pump matches the outlet. Open the second branch to disturb this balance; a constant pump will not respond.']:['RECOVERING WITHOUT MEMORY','With the second branch closed, the same fixed inflow brings the tank back toward its original balance. The memory coordinate is inactive.'];
    if(p.controller==='proportional')return s.uc>=p.umax?['PUMP AT CAPACITY','The proportional controller requests more than the pump can supply. This is actuator saturation, but there is no accumulating memory in this controller.']:s.branch?['CORRECTION NEEDS AN ERROR',`The pump adds K_P × error to its baseline inflow. As the error shrinks, that correction shrinks too. Holding the exact target would remove the extra inflow the second branch needs.`]:['PROPORTIONAL FEEDBACK','The pump responds directly to the current level error. The memory coordinate is inactive; compare this recovery with the integral-controller experiments.'];
    if(p.controller==='custom')return ['YOUR CONTROL LAW',`At this state, dh/dt = ${fmt(s.dh)} and dz/dt = ${fmt(s.dz)}. Requested flow is ${fmt(s.uc)}; delivered flow is ${fmt(s.u)}. ${s.uc>=p.umax?'The upper pump limit is active.':s.uc<=0?'The pump is off.':'The command is inside the pump limits.'}`];
    if(s.uc>p.umax+1e-4&&s.e>0&&s.branch)return ['WINDUP IN PROGRESS',`The pump is already at ${fmt(p.umax)}, yet the positive error keeps adding to z. Under maximum pumping, the level tends toward h = ${fmt((p.umax/s.c)**2)}. Memory can keep climbing even when the level hardly moves.`];
    if(s.uc>p.umax+1e-4&&!s.branch&&s.e>0)return ['THE BRANCH CLOSED. THE PUMP DIDN’T BACK OFF.',`Normal drainage is restored, but the command is still ${fmt(s.uc)} against a capacity of ${fmt(p.umax)}. The level is rising. Until it crosses h★, the integrator is still winding up.`];
    if(s.uc>=p.umax-1e-4&&s.e<=0)return ['ABOVE TARGET, STILL AT FULL POWER',`The error has turned negative, so memory is unwinding. But z must fall below ${fmt(p.umax/p.KI)} before the pump can leave its upper limit. Zero error did not erase earlier error.`];
    if(s.uc<=0)return ['THE LOWER LIMIT','The stored command has reached the pump’s lower limit. The pump cannot remove water; only the outlets can drain the tank. Ordinary integration continues.'];
    if(s.e<-.015)return ['MEMORY IS UNWINDING','The level is above target, so dz/dt is negative. The pump command declines as accumulated memory is removed. The instantaneous error and the remembered error are different quantities.'];
    if(Math.abs(s.e)<.015&&Math.abs(s.dh)<.015)return ['NEAR BALANCE','Inflow and outflow nearly match. The integrator holds the pump command needed to keep the level near its target.'];
    return ['ACCUMULATING THE SHORTAGE','The level is below target. Positive error increases z, which increases the pump command. Watch whether the target is crossed before this stored correction has unwound.'];
  }
  function update(){
    if(!run)return;time=M.clamp(Number.isFinite(time)?time:0,0,p.T);const s=run.at(time);$('timeline').value=time;$('clock').textContent='t = '+fmt(time);
    $('branch-state').textContent=s.branch?'Second branch open':'One branch open';
    $('branch-state').style.color=s.branch?C.amber:C.cyan;
    const maxH=Math.max(1.8,...run.data.map(a=>a.h))*1.1,waterY=252-M.clamp(s.h/maxH,0,1)*188,targetY=252-188/maxH;
    for(const id of ['water','water-texture']){$(id).setAttribute('y',waterY);$(id).setAttribute('height',252-waterY);}
    $('water-surface').setAttribute('y1',waterY);$('water-surface').setAttribute('y2',waterY);
    $('target-line').setAttribute('y1',targetY);$('target-line').setAttribute('y2',targetY);$('target-label').setAttribute('y',targetY+4);
    $('level-value').textContent=fmt(s.h);$('pump-value').textContent=fmt(s.u);
    $('inflow-line').style.opacity=s.u>1e-6?'1':'0';$('inflow-line').style.strokeDashoffset=String(-time*18);
    $('pump-rotor').style.transform=`rotate(${time*s.u*75}deg)`;
    const q1=p.c0*Math.sqrt(s.h),q2=Math.max(0,s.c-p.c0)*Math.sqrt(s.h);
    $('drip-one-label').textContent='Branch 1 · '+fmt(q1);$('drip-two-label').textContent=s.branch?'Branch 2 · '+fmt(q2):'Branch 2 · closed';
    $('branch-valve').setAttribute('class',s.branch?'valve-open':'valve-closed');
    // Sample timestamps need not be uniform at demand switches. Never index by t / dt.
    let lo=0,hi=run.data.length-1;
    while(lo+1<hi){const mid=(lo+hi)>>1;if(run.data[mid].t<=time)lo=mid;else hi=mid;}
    const a=run.data[lo],b=run.data[hi],fraction=M.clamp((time-a.t)/(b.t-a.t||1),0,1);
    const sample={drips1:a.drips1+(b.drips1-a.drips1)*fraction,drips2:a.drips2+(b.drips2-a.drips2)*fraction};
    for(const[id,q,cumulative,x]of[['drops-one',q1,sample.drips1,150],['drops-two',q2,sample.drips2,333]]){
      const group=$(id);group.style.opacity=q>1e-5?'1':'0';
      [...group.children].forEach((drop,j)=>{drop.setAttribute('cx',x);drop.setAttribute('cy',300+((cumulative*13+j*11)%31));});
    }
    const barMax=run.barMax;
    $('requested-bar').style.width=M.clamp(s.uc/barMax*100,0,100)+'%';$('actual-bar').style.width=M.clamp(s.u/barMax*100,0,100)+'%';
    document.querySelectorAll('.capacity-marker').forEach(n=>n.style.left=p.umax/barMax*100+'%');
    $('requested-value').textContent=fmt(s.uc);$('actual-value').textContent=fmt(s.u);$('capacity-note').textContent='Pump capacity: '+fmt(p.umax)+(s.uc>p.umax?' · command clipped':s.uc<0?' · negative command clipped to zero':'');
    for(const v of chartViews){v.cursor.setAttribute('x1',v.x(time));v.cursor.setAttribute('x2',v.x(time));v.dots.forEach((dot,i)=>{dot.setAttribute('cx',v.x(time));dot.setAttribute('cy',v.y(s[v.keys[i].key]));});}
    if(phaseView){drawField(s);const v=phaseView;v.dot.setAttribute('cx',v.x(s.h));v.dot.setAttribute('cy',v.y(s.z));v.past.replaceChildren();v.phasePaths(v.past,[...run.data.filter(a=>a.t<time),s],1,2);const outside=s.h<v.xd[0]||s.h>v.xd[1]||s.z<v.yd[0]||s.z>v.yd[1];$('phase-note').textContent=$('local-phase').checked?(outside?'The state has left this local view. Uncheck “Near equilibrium” to see the full trajectory.':'Local view around (1, 0.6). The faint path is the full run, clipped to this window. Arrows show direction.'):'Arrows show the current vector field. The dot is the current state; the faint path shows the full run.';}
    const[label,body]=diagnosis(s);if($('diagnosis-label').textContent!==label)$('diagnosis-label').textContent=label;if($('diagnosis-text').textContent!==body)$('diagnosis-text').textContent=body;
    $('trace-readout').textContent=`t ${fmt(time)}   ·   h ${fmt(s.h)}   ·   z ${fmt(s.z)}   ·   e ${fmt(s.e)}   ·   requested ${fmt(s.uc)}   ·   delivered ${fmt(s.u)}   ·   outlet ${fmt(s.q)}`;
  }
  function pause(){playing=false;$('play').textContent='▶ Play';}
  function seek(t){pause();if(!Number.isFinite(t))return;time=M.clamp(t,0,p.T);update();}
  function simulate(){
    pause();
    try{
      const next=M.simulate(p);run=next;$('error').hidden=true;
      if(activeRegime!==null){const r=regimes[activeRegime],matches=p.controller==='custom'&&p.command===r.command&&p.memory===r.memory&&p.KI===1&&p.umax>.6&&!p.enabled;$('regime-details').textContent=matches?r.eigen+' at (h, z) = (1, 0.6) · pump unsaturated · no branch disturbance':'Modified preset: the original eigenvalues and behavior description may no longer apply.';}
      let d1=0,d2=0;for(let i=0;i<run.data.length;i++){const s=run.data[i];if(i){const a=run.data[i-1],dt=s.t-a.t;d1+=p.c0*(Math.sqrt(a.h)+Math.sqrt(s.h))/2*dt;const coeff=M.demand(p,(a.t+s.t)/2)-p.c0;d2+=coeff*(Math.sqrt(a.h)+Math.sqrt(s.h))/2*dt;}s.drips1=d1;s.drips2=d2;}
      run.barMax=Math.max(p.umax*1.2,...run.data.map(s=>s.uc));time=Math.min(time,p.T);
      $('peak-metric').textContent=p.enabled?fmt(run.peak.h)+'  /  '+fmt(Math.max(0,run.peak.h-1)*100,1)+'% overshoot':'No disturbance';
      $('saturation-metric').textContent=p.enabled?(run.censored?'≥ ':'')+fmt(run.saturation)+' time units':'No disturbance';
      $('memory-metric').textContent=p.enabled?fmt(run.close.z):'No disturbance';
      const metricLabels=document.querySelectorAll('.readouts > div > span');
      const regimeMetrics=activeRegime!==null&&!p.enabled;
      ['Peak after branch closes','Continuous max-pump time after close','Memory at branch closing'].forEach((label,i)=>metricLabels[i].textContent=label);
      if(regimeMetrics){
        ['Largest level in this run','First pump limit reached','Final controller memory'].forEach((label,i)=>metricLabels[i].textContent=label);
        $('peak-metric').textContent=fmt(Math.max(...run.data.map(s=>s.h)));
        const hit=run.data.find(s=>s.uc>=p.umax||s.uc<=0);$('saturation-metric').textContent=hit?'t = '+fmt(hit.t):'Not reached';
        $('memory-metric').textContent=fmt(run.data.at(-1).z);
      }
      document.querySelector('[data-jump="crossing"]').disabled=!p.enabled||run.crossing===null;
      document.querySelector('[data-jump="peak"]').disabled=!p.enabled;
      for(const type of ['start','end'])document.querySelector(`[data-jump="${type}"]`).disabled=!p.enabled;
      $('play').disabled=false;drawAll();
    }catch(e){
      const attemptedCommand=p.command,attemptedMemory=p.memory;
      if(run){p={...run.p};controls();if(p.controller==='custom'){$('command-formula').value=attemptedCommand;$('memory-formula').value=attemptedMemory;}}
      $('error').textContent=e.message+' Last valid run and settings are retained.';$('error').hidden=false;$('play').disabled=!run;
    }
  }
  const specs={
    u0:['Fixed pump flow',0,2,.05,'u₀'],KI:['Integral gain',.1,3,.05,'K_I'],KP:['Proportional gain',0,5,.1,'K_P'],umax:['Pump capacity',.4,2,.05,'u_max'],
    c1:['Total discharge coefficient',.6,2,.05,'c₁'],t1:['Branch opens at',2,20,1,'time'],duration:['Open for',4,35,1,'time units']
  };
  function parameter(key,parent){const[label,min,max,increment,symbol]=specs[key],value=key==='duration'?p.t2-p.t1:p[key];
    const block=document.createElement('div');block.className='parameter';
    const row=document.createElement('label');row.className='parameter-label';row.htmlFor='param-'+key;
    const name=document.createElement('span');name.textContent=label;const out=document.createElement('output');out.id='value-'+key;out.textContent=fmt(value,key==='duration'||key==='t1'?0:2);row.append(name,out);
    const input=document.createElement('input');Object.assign(input,{type:'range',id:'param-'+key,min,max,step:increment,value});input.setAttribute('aria-label',label);
    input.addEventListener('input',()=>{const v=Number(input.value);out.textContent=fmt(v,key==='duration'||key==='t1'?0:2);if(key==='duration')p.t2=p.t1+v;else if(key==='t1'){const duration=p.t2-p.t1;p.t1=v;p.t2=v+duration;}else p[key]=v;if(key==='KI'&&p.controller==='integral'){p.z0=p.c0/p.KI;$('initial-z').value=fmt(p.z0,4);}renderFormula();schedule();});
    block.append(row,input);if(key==='c1'){const small=document.createElement('small');small.textContent='c₀ = 0.6 plus the second branch';block.append(small);}parent.append(block);
  }
  function renderFormula(){
    const formula={manual:'u_c = u₀\nż = 0',proportional:'u_c = 0.6 + K_P (1 − h)\nż = 0',integral:'u_c = K_I z\nż = 1 − h',custom:'u = clamp(u_c, 0, u_max)'};
    $('formula-display').textContent=formula[p.controller];$('custom-editor').hidden=p.controller!=='custom';
  }
  function controls(){
    $('controller').value=p.controller;renderFormula();$('parameters').replaceChildren();
    const keys=p.controller==='manual'?['u0','umax']:p.controller==='proportional'?['KP','umax']:p.controller==='integral'?['KI','umax']:['KI','KP','u0','umax'];keys.forEach(k=>parameter(k,$('parameters')));
    $('disturbance-parameters').replaceChildren();['c1','t1','duration'].forEach(k=>parameter(k,$('disturbance-parameters')));
    $('disturbance-enabled').checked=p.enabled;$('initial-h').value=p.h0;$('initial-z').value=fmt(p.z0,4);$('command-formula').value=p.command;$('memory-formula').value=p.memory;
  }
  function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;simulate();});}
  function selectStep(n){step=n;activeRegime=null;$('local-phase').checked=false;document.querySelectorAll('[data-regime]').forEach(b=>b.setAttribute('aria-pressed','false'));$('regime-details').textContent='Or follow the five irrigation experiments below.';$('reset').textContent='Restore this experiment';const l=lessons[n];p={...M.defaults,controller:l.controller,c1:l.c1,KI:l.KI,z0:.6/l.KI};time=l.time;
    document.querySelectorAll('[data-step]').forEach(b=>{if(Number(b.dataset.step)===n)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
    $('lesson-kicker').textContent='EXPERIMENT 0'+(n+1);$('lesson-title').textContent=l.title;$('lesson-body').textContent=l.body;$('prediction').textContent=l.predict;
    $('next-step').textContent=n===4?'Back to the first experiment ↶':'Next experiment →';controls();simulate();
  }
  function selectRegime(n){
    activeRegime=n;const r=regimes[n];p={...M.defaults,controller:'custom',enabled:false,h0:1.03,z0:.6,command:r.command,memory:r.memory};time=0;
    document.querySelectorAll('[data-step]').forEach(b=>b.removeAttribute('aria-current'));
    document.querySelectorAll('[data-regime]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.regime)===n)));
    $('local-phase').checked=true;$('lesson-kicker').textContent='QUALITATIVE REGIME';$('lesson-title').textContent=r.name;$('lesson-body').textContent=r.body;$('prediction').textContent=r.predict;
    $('regime-details').textContent=r.eigen+' at (h, z) = (1, 0.6) · preset values, pump unsaturated · no branch disturbance';
    $('next-step').textContent='Next behavior →';$('reset').textContent='Restore this behavior';controls();simulate();
  }
  regimes.forEach((r,n)=>{const b=document.createElement('button');b.type='button';b.dataset.regime=n;b.setAttribute('aria-pressed','false');b.textContent=r.name;b.addEventListener('click',()=>selectRegime(n));$('regime-buttons').append(b);});
  $('local-phase').addEventListener('change',()=>{drawPhaseBase();update();});
  document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>selectStep(Number(b.dataset.step))));
  $('next-step').addEventListener('click',()=>activeRegime===null?selectStep((step+1)%lessons.length):selectRegime((activeRegime+1)%regimes.length));$('reset').addEventListener('click',()=>activeRegime===null?selectStep(step):selectRegime(activeRegime));
  $('controller').addEventListener('change',()=>{p.controller=$('controller').value;if(p.controller==='integral')p.z0=p.c0/p.KI;controls();simulate();});
  $('apply-formulas').addEventListener('click',()=>{p.command=$('command-formula').value;p.memory=$('memory-formula').value;simulate();});
  $('disturbance-enabled').addEventListener('change',()=>{p.enabled=$('disturbance-enabled').checked;simulate();});
  for(const[key,id]of[['h0','initial-h'],['z0','initial-z']])$(id).addEventListener('change',()=>{const v=Number($(id).value);if(!Number.isFinite(v)||!$(id).checkValidity()){$(id).reportValidity();return;}p[key]=v;simulate();});
  $('equilibrium-start').addEventListener('click',()=>{p.h0=1;p.z0=.6/p.KI;p.u0=.6;controls();time=0;simulate();});
  $('play').addEventListener('click',()=>{if(playing){pause();return;}if(time>=p.T)time=0;playing=true;lastFrame=performance.now();$('play').textContent='Ⅱ Pause';});
  $('restart').addEventListener('click',()=>seek(0));$('timeline').addEventListener('input',()=>seek(Number($('timeline').value)));
  document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>{const t={start:p.t1,end:p.t2,crossing:run.crossing,peak:run.peak.t}[b.dataset.jump];if(t!==null)seek(t);}));
  document.querySelectorAll('[data-series]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.series;if(visibleFlows.has(key)){if(visibleFlows.size===1)return;visibleFlows.delete(key);}else visibleFlows.add(key);b.setAttribute('aria-pressed',String(visibleFlows.has(key)));drawAll();}));
  for(const id of ['level-chart','memory-chart','flow-chart','error-chart']){
    const svg=$(id);let dragging=false;
    const scrub=e=>{const v=chartViews.find(v=>v.svg===svg);if(v){const rect=svg.getBoundingClientRect();seek(v.x.invert(e.clientX-rect.left));}};
    svg.addEventListener('pointerdown',e=>{dragging=true;svg.setPointerCapture(e.pointerId);scrub(e);});svg.addEventListener('pointermove',e=>{if(dragging)scrub(e);});svg.addEventListener('pointerup',()=>dragging=false);svg.addEventListener('pointercancel',()=>dragging=false);
  }
  function frame(now){if(playing){const delta=M.clamp((now-lastFrame)/1000,0,.1);time=M.clamp(time+delta*Number($('speed').value),0,p.T);if(now-lastPaint>40){update();lastPaint=now;}if(time>=p.T){pause();update();}}lastFrame=now;requestAnimationFrame(frame);}
  let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(run)drawAll();},100);}).observe($('level-chart'));
  selectStep(0);requestAnimationFrame(frame);
  // Optional browser-native agent interface, using the same UI actions.
  if(document.modelContext?.registerTool){
    const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
    const tools=[
      {name:'read_irrigation_run',description:'Read the current two-state irrigation experiment and its recovery measurements.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({experiment:step+1,parameters:p,time,state:run.at(time),peak:run.peak.h,postCloseSaturation:run.saturation})},
      {name:'select_irrigation_experiment',description:'Select one of the five guided experiments and reset its controls.',inputSchema:{type:'object',properties:{experiment:{type:'integer',minimum:1,maximum:5}},required:['experiment'],additionalProperties:false},execute:input=>{if(!Number.isInteger(input.experiment)||input.experiment<1||input.experiment>5)throw Error('Choose experiment 1–5.');selectStep(input.experiment-1);return{experiment:step+1,title:lessons[step].title};}},
      {name:'seek_irrigation_replay',description:'Pause and move the replay cursor to a time within the current run.',inputSchema:{type:'object',properties:{time:{type:'number',minimum:0,maximum:70}},required:['time'],additionalProperties:false},execute:input=>{if(!Number.isFinite(input.time)||input.time<0||input.time>p.T)throw Error('Time must be between 0 and 70.');seek(input.time);return run.at(time);}}
    ];for(const tool of tools){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
  }
})();
