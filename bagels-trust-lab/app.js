(function(){
'use strict';
const M=window.TrustModel,$=id=>document.getElementById(id);
const fmt=(x,n=2)=>Number(x).toLocaleString('ru-RU',{minimumFractionDigits:n,maximumFractionDigits:n});
const pct=x=>fmt(100*x,2)+'%';
const palette={ink:'#233b3d',grid:'#dce1d6',muted:'#708077',p:'#ad5835',q:'#287d70',gold:'#ad7e25',blue:'#557caa',reference:'#81748e'};
let state={...M.defaults},data=[],outcome,reference=null,index=0,playing=false,animation=0,lastTime=0,playPosition=0,calcFrame=0;
const presets={
 recovery:{values:{p0:.6,q0:.8},note:'Предположите: сможет ли доверие восстановиться после первоначального падения?'},
 trap:{values:{p0:.2,q0:.8},note:'Те же 80% честных покупателей. Но теперь продавцы начинают лишь с 20% доверия. Что изменится?'},
 edge:{values:{p0:M.separatrix(.8),q0:.8,horizon:80},note:'Старт задан точно на сепаратрисе, без округления. Увеличьте время: движение замедляется, но не останавливается.'},
 fast:{values:{p0:.2,q0:.8,alpha:.25},note:'Теперь продавцы меняются в четыре раза медленнее покупателей. Хватит ли 20% начального доверия?'},
 absent:{values:{p0:0,q0:.95},note:'95% покупателей честны, но доверяющая стратегия исчезла. Нажмите → на графике: что даст её малое появление?'},
 explore:{values:{p0:0,q0:.7,epsilon:.08,mu:.003,horizon:80},note:'Расширение: честность имеет небольшое преимущество при контроле, а продавцы пробуют другую стратегию. Обратите внимание: исходная сепаратриса здесь неприменима.'}
};
const fields=[
 {key:'p0',group:'initial-controls',label:'Доверие p₀',min:0,max:1,step:.001,help:'Доля доверяющих продавцов'},
 {key:'q0',group:'initial-controls',label:'Честность q₀',min:0,max:1,step:.001,help:'Доля честных покупателей'},
 {key:'alpha',group:'speed-controls',label:'Продавцы · α',min:.1,max:4,step:.05,help:'Быстрее реагируют на свою выгоду'},
 {key:'beta',group:'speed-controls',label:'Покупатели · β',min:.1,max:4,step:.05,help:'Быстрее перенимают успешную стратегию'},
 {key:'a',group:'payoff-controls',label:'Выгода доверия · a',min:.2,max:4,step:.1,help:'При честном покупателе'},
 {key:'b',group:'payoff-controls',label:'Потеря при обмане · b',min:1,max:15,step:.1,help:'При нечестном покупателе'},
 {key:'epsilon',group:'extension-controls',label:'Бонус честности · ε',min:0,max:.5,step:.01,help:'Дополнительная полезность G при контроле'},
 {key:'mu',group:'extension-controls',label:'Новые попытки · μ',min:0,max:.03,step:.001,help:'Симметричные пробные переходы продавцов'}
];
fields.forEach(f=>{
 const div=document.createElement('div');div.className='control-field';
 div.innerHTML=`<div class="control-line"><label for="${f.key}">${f.label}</label><input id="${f.key}-number" type="number" min="${f.min}" max="${f.max}" step="any" aria-label="${f.label}, точное значение"></div><input id="${f.key}" type="range" min="${f.min}" max="${f.max}" step="${f.step}" aria-label="${f.label}"><small>${f.help}</small>`;
 $(f.group).appendChild(div);
 $(f.key).addEventListener('input',e=>changeField(f,Number(e.target.value)));
 $(f.key+'-number').addEventListener('change',e=>{
   const value=e.target.value===''?NaN:Number(e.target.value);
   if(!Number.isFinite(value)){syncInputs();$('lab-status').textContent='Введите число в допустимом диапазоне.';return;}
   if(value<f.min||value>f.max)$('lab-status').textContent=`Допустимый диапазон: ${fmt(f.min,3)}–${fmt(f.max,3)}.`;
   changeField(f,M.clamp(value,f.min,f.max));
 });
});
function syncInputs(){
 fields.forEach(f=>{$(f.key).value=state[f.key];$(f.key+'-number').value=Number(state[f.key].toFixed(f.key==='p0'||f.key==='q0'?6:3));});
 $('horizon').value=state.horizon;
}
function clearPreset(){document.querySelectorAll('[data-preset]').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed','false');});$('experiment-note').textContent='Ваш эксперимент. Найдите границу между восстановлением доверия и его исчезновением.';}
function changeField(f,value){state[f.key]=value;syncInputs();clearPreset();schedule();}
function schedule(){pause();cancelAnimationFrame(calcFrame);calcFrame=requestAnimationFrame(recompute);}
function applyPreset(name){const preset=presets[name];state={...M.defaults,...preset.values};syncInputs();document.querySelectorAll('[data-preset]').forEach(b=>{const yes=b.dataset.preset===name;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));});$('experiment-note').textContent=preset.note;$('extension-details').open=name==='explore';$('lab-status').textContent='';pause();recompute();}
function math(element,source,display=true){try{katex.render(source,element,{displayMode:display,throwOnError:true,strict:'warn',trust:false,output:'htmlAndMathml'});}catch(error){element.textContent=source;element.classList.add('formula-error');console.error(error);}}
document.querySelectorAll('.math').forEach(el=>math(el,el.textContent,el.classList.contains('display')));
function drawText(x,y,text,size=13,fill=palette.muted,anchor='start',extra=''){return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" ${extra}>${text}</text>`;}
function path(points,color,width=2,extra=''){return `<path d="${points.map((p,i)=>(i?'L':'M')+p.map(v=>v.toFixed(3)).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;}
const phaseBox={x:65,y:31,size:480};
const X=p=>phaseBox.x+p*phaseBox.size,Y=q=>phaseBox.y+(1-q)*phaseBox.size;
function phaseBase(){
 const base=M.isBase(state),qs=M.threshold(state);let svg=`<title>Фазовый портрет доверия и честности</title><desc>Начальное состояние p=${state.p0}, q=${state.q0}. ${outcome.title}. ${outcome.text}</desc><defs><clipPath id="phase-clip"><rect x="65" y="31" width="480" height="480"/></clipPath></defs><rect x="65" y="31" width="480" height="480" fill="#f5f6f0"/>`;
 if(base&&$('show-basins').checked){
   const points=[[X(0),Y(0)],[X(1),Y(0)],...Array.from({length:401},(_,i)=>{const q=qs*i/400;return[X(M.separatrix(q,state)),Y(q)];})];
   svg+=`<rect x="65" y="31" width="480" height="480" fill="#e4efe6"/><polygon points="${points.map(p=>p.join(',')).join(' ')}" fill="#f6e8dd"/>`;
 }
 for(let i=0;i<=5;i++){const z=i/5;svg+=`<path d="M${X(z)} 31V511 M65 ${Y(z)}H545" stroke="${palette.grid}" stroke-width="1"/>`+drawText(X(z),535,fmt(z,1),13,palette.muted,'middle')+drawText(52,Y(z)+4,fmt(z,1),13,palette.muted,'end');}
 svg+=drawText(65,17,'q · честность покупателей',14,palette.ink)+drawText(305,561,'p · доверие продавцов',14,palette.ink,'middle');
 if($('show-field').checked){let lines='';for(let i=1;i<=17;i++)for(let j=1;j<=17;j++){
   const p=i/18,q=j/18,[u,v]=M.rhs(p,q,state),n=Math.hypot(u,v);if(n<1e-14)continue;
   const dx=10*u/n,dy=-10*v/n,x=X(p)-dx/2,y=Y(q)-dy/2,ang=Math.atan2(dy,dx);
   lines+=`M${x},${y}l${dx},${dy}m${-3*Math.cos(ang-.5)},${-3*Math.sin(ang-.5)}L${x+dx},${y+dy}l${-3*Math.cos(ang+.5)},${-3*Math.sin(ang+.5)}`;
 }svg+=`<path d="${lines}" fill="none" stroke="#aab7af" stroke-width=".85"/>`;}
 // With mutation q* only cancels the payoff contribution, not the whole p derivative.
 if(state.mu===0)svg+=`<path d="M65 ${Y(qs)}H545" stroke="${palette.blue}" stroke-width="1.3" stroke-dasharray="5 5"/>`+drawText(553,Y(qs)+4,'q*',13,palette.blue);
 if(base&&$('show-separator').checked)svg+=path(Array.from({length:501},(_,i)=>{const q=qs*i/500;return[X(M.separatrix(q,state)),Y(q)];}),palette.gold,2.5);
 if(base)svg+=`<path d="M65 511V${Y(qs)}" stroke="${palette.p}" stroke-width="3.5"/><path d="M65 ${Y(qs)}V31" stroke="${palette.p}" stroke-width="1.4" stroke-dasharray="4 4"/><circle cx="65" cy="${Y(qs)}" r="4.5" fill="${palette.gold}" stroke="#fffef9" stroke-width="1.4"/><circle cx="545" cy="31" r="5" fill="${palette.q}" stroke="#fffef9" stroke-width="1.4"/><circle cx="545" cy="511" r="4" fill="#fffef9" stroke="${palette.ink}"/>`;
 svg+='<g clip-path="url(#phase-clip)">';
 if(reference)svg+=path(reference.data.filter((_,i)=>i%2===0).map(v=>[X(v.p),Y(v.q)]),palette.reference,2.2,'stroke-dasharray="6 5" opacity=".85"');
 svg+=path(data.filter((_,i)=>i%2===0).map(v=>[X(v.p),Y(v.q)]),palette.q,2.8);
 const markIndices=[90,350,800];
 for(const i of markIndices){const a=data[i],b=data[i+8],dx=X(b.p)-X(a.p),dy=Y(b.q)-Y(a.q),n=Math.hypot(dx,dy);if(n>.7){const x=X(a.p),y=Y(a.q),ang=Math.atan2(dy,dx);svg+=path([[x-7*Math.cos(ang-.5),y-7*Math.sin(ang-.5)],[x,y],[x-7*Math.cos(ang+.5),y-7*Math.sin(ang+.5)]],palette.q,2.3);}}
 svg+='</g>';
 svg+=`<circle cx="${X(state.p0)}" cy="${Y(state.q0)}" r="5.5" fill="#fffef9" stroke="${palette.q}" stroke-width="2"/>`;
 svg+=drawText(Math.min(515,Math.max(85,X(state.p0)+10)),Math.max(48,Math.min(494,Y(state.q0)-12)),'старт',12,palette.q);
 svg+=`<circle id="phase-halo" r="10" fill="${palette.p}" opacity=".12"/><circle id="phase-dot" r="5.5" fill="${palette.p}" stroke="#fffef9" stroke-width="2"/>`;
 if(!base)svg+=drawText(305,492,'Расширение · аналитическая граница скрыта',12,palette.muted,'middle');
 $('phase').innerHTML=svg;
}
const TX=t=>56+t/state.horizon*510,TY=v=>185-v*156;
function timelineBase(){
 let svg='<title>Доверие и честность во времени</title>';
 for(const v of [0,.5,1])svg+=`<path d="M56 ${TY(v)}H566" stroke="${palette.grid}" stroke-width="1"/>`+drawText(45,TY(v)+4,fmt(v,1),12,palette.muted,'end');
 for(let i=0;i<=4;i++){const t=state.horizon*i/4;svg+=`<path d="M${TX(t)} 29V185" stroke="${palette.grid}" stroke-width=".6"/>`+drawText(TX(t),208,fmt(t,t%1?1:0),12,palette.muted,'middle');}
 svg+=drawText(309,230,'Условное время t',12,palette.muted,'middle');
 if(state.mu===0)svg+=`<path d="M56 ${TY(M.threshold(state))}H566" stroke="${palette.blue}" stroke-width="1" stroke-dasharray="4 4"/>`;
 if(reference){for(const key of ['p','q'])svg+=path(reference.data.filter((v,i)=>i%2===0&&v.t<=state.horizon).map(v=>[TX(v.t),TY(v[key])]),palette.reference,1.7,'stroke-dasharray="5 5" opacity=".65"');}
 for(const key of ['p','q'])svg+=path(data.filter((_,i)=>i%2===0).map(v=>[TX(v.t),TY(v[key])]),palette[key],2.5);
 svg+='<path id="time-cursor" stroke="#384c46" stroke-width="1" stroke-dasharray="3 3"/><circle id="time-p" r="4.5" fill="#ad5835" stroke="#fffef9"/><circle id="time-q" r="4.5" fill="#287d70" stroke="#fffef9"/>';
 $('timeline').innerHTML=svg;
}
function readouts(){
 const qs=M.threshold(state),base=M.isBase(state),slope=M.rhs(state.p0,state.q0,state);
 $('outcome-title').textContent=outcome.title;
 $('outcome-detail').textContent=base?`Точный предел: p → ${fmt(outcome.p,3)}, q → ${fmt(outcome.q,3)}.`:`На t = ${fmt(state.horizon,0)}: p ≈ ${fmt(data.at(-1).p,3)}, q ≈ ${fmt(data.at(-1).q,3)}. Это срез, не доказанный предел.`;
 $('q-threshold').textContent=pct(qs);
 $('q-threshold').nextElementSibling.textContent=state.mu===0?'Где выгода доверия продавца меняет знак.':'Порог только разности выигрышей. При μ > 0 он уже не нульклина p.';
 if(!base){$('p-threshold').textContent='Не применяется';$('threshold-caption').textContent='При ε или μ > 0 прежний первый интеграл не сохраняется.';}
 else if(state.q0===0){$('p-threshold').textContent='Нет успешного старта';$('threshold-caption').textContent='Без честной стратегии она не возникает. Даже p₀ = 1 даёт неподвижный угол.';}
 else if(state.q0>=qs){$('p-threshold').textContent='Любое p₀ > 0';$('threshold-caption').textContent='Точно нулевое доверие — отдельный неподвижный случай.';}
 else{$('p-threshold').textContent=pct(M.separatrix(state.q0,state));$('threshold-caption').textContent='Для восстановления нужно быть строго выше. Равенство — критическая траектория.';}
 let description=outcome.text;
 if(outcome.min!==undefined)description+=` Минимум доверия на пути: ${pct(outcome.min)} при q = ${pct(qs)}.`;
 if(base&&state.p0>0&&state.q0>0&&state.q0<qs)description+=` Начальный запас относительно границы: ${fmt(100*(state.p0-M.separatrix(state.q0,state)),3)} п. п.`;
 if(!base)description+=' Честность по-прежнему не убывает, но исчезают некоторые равновесия исходной модели. Сравнивайте именно правила динамики, а не только цвет конечной точки.';
 $('diagnosis').textContent=description;
 $('live-payoffs').textContent=`Текущая матрица продавца: T = (${fmt(19+state.a,1)}; ${fmt(10-state.b,1)}), C = (19; 10). Матрица покупателя: T = (4; 3), C = (${fmt(1+state.epsilon,2)}; 1).`;
 const n=x=>Number(x.toFixed(3)).toString();
 math($('live-equations'),String.raw`\begin{aligned}\dot p&=${n(state.alpha)}\,p(1-p)\,[${n(state.a+state.b)}q-${n(state.b)}]+${n(state.mu)}(1-2p),\\\dot q&=${n(state.beta)}\,q(1-q)\,[p+${n(state.epsilon)}(1-p)].\end{aligned}`);
 $('show-basins').disabled=!base;$('show-separator').disabled=!base;
}
function setFrame(i){
 index=M.clamp(Math.round(i),0,data.length-1);const v=data[index];$('scrub').value=index;$('clock').textContent='t = '+fmt(v.t,2);
 for(const id of ['phase-dot','phase-halo']){const e=$(id);if(e){e.setAttribute('cx',X(v.p));e.setAttribute('cy',Y(v.q));}}
 $('time-cursor').setAttribute('d',`M${TX(v.t)} 25V189`);
 for(const key of ['p','q']){$('time-'+key).setAttribute('cx',TX(v.t));$('time-'+key).setAttribute('cy',TY(v[key]));}
 $('current-values').textContent=`p ${fmt(v.p,3)} · q ${fmt(v.q,3)}`;
 const [dp,dq]=M.rhs(v.p,v.q,state),sign=x=>Math.abs(x)<1e-7?'почти не меняется':x>0?'растёт':'падает';
 $('current-direction').textContent=`Доверие ${sign(dp)}, честность ${sign(dq)}. t = ${fmt(v.t,2)}.`;
}
function recompute(){data=M.simulate(state);outcome=M.classify(state);readouts();phaseBase();timelineBase();setFrame(0);}
function pause(){playing=false;cancelAnimationFrame(animation);$('play').textContent='▶ Проиграть';$('play').setAttribute('aria-pressed','false');}
function tick(now){if(!playing)return;const elapsed=Math.min(.1,(now-lastTime)/1000);lastTime=now;playPosition+=elapsed*Number($('play-speed').value)*(data.length-1)/16;setFrame(playPosition);if(playPosition>=data.length-1){pause();return;}animation=requestAnimationFrame(tick);}
$('play').addEventListener('click',()=>{if(playing){pause();return;}if(index===data.length-1)setFrame(0);playing=true;playPosition=index;lastTime=performance.now();$('play').textContent='Ⅱ Пауза';$('play').setAttribute('aria-pressed','true');animation=requestAnimationFrame(tick);});
$('rewind').addEventListener('click',()=>{pause();setFrame(0);});$('scrub').addEventListener('input',e=>{pause();setFrame(Number(e.target.value));});
$('reset').addEventListener('click',()=>applyPreset('recovery'));
$('horizon').addEventListener('change',e=>{state.horizon=Number(e.target.value);schedule();});
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.preset)));
for(const id of ['show-field','show-basins','show-separator'])$(id).addEventListener('change',()=>{phaseBase();setFrame(index);});
function choosePoint(p,q){state.p0=M.clamp(p);state.q0=M.clamp(q);clearPreset();syncInputs();schedule();}
$('phase').addEventListener('pointerdown',e=>{const pt=$('phase').createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const pos=pt.matrixTransform($('phase').getScreenCTM().inverse());if(pos.x<X(0)-2||pos.x>X(1)+2||pos.y<Y(1)-2||pos.y>Y(0)+2)return;choosePoint((pos.x-X(0))/480,1-(pos.y-Y(1))/480);$('phase').focus({preventScroll:true});});
$('phase').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const d=e.shiftKey?.05:.01;choosePoint(state.p0+(e.key==='ArrowRight'?d:e.key==='ArrowLeft'?-d:0),state.q0+(e.key==='ArrowUp'?d:e.key==='ArrowDown'?-d:0));});
$('save-reference').addEventListener('click',()=>{reference={state:{...state},data:data.map(v=>({...v}))};$('clear-reference').hidden=false;$('reference-note').textContent=`Пунктир: p₀ = ${fmt(state.p0,3)}, q₀ = ${fmt(state.q0,3)}, α = ${fmt(state.alpha)}, β = ${fmt(state.beta)}, a = ${fmt(state.a)}, b = ${fmt(state.b)}, ε = ${fmt(state.epsilon)}, μ = ${fmt(state.mu,3)}; T = ${state.horizon}. Пунктир рассчитан со своими параметрами; поле и заливка относятся к текущему сценарию.`;phaseBase();timelineBase();setFrame(index);$('lab-status').textContent='Сценарий сохранён для сравнения. Теперь измените начальное состояние или параметры.';});
$('clear-reference').addEventListener('click',()=>{reference=null;$('clear-reference').hidden=true;$('reference-note').textContent='Сохраните сценарий, затем измените параметры: прежняя траектория останется пунктирной.';phaseBase();timelineBase();setFrame(index);$('lab-status').textContent='Сравнение убрано.';});
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
$('export-csv').addEventListener('click',()=>{const keys=['p0','q0','alpha','beta','a','b','epsilon','mu','horizon'];const rows=['t,p,q,'+keys.join(','),...data.map(v=>[v.t,v.p,v.q,...keys.map(k=>state[k])].map(n=>Number(n).toPrecision(12)).join(','))];download('\uFEFF'+rows.join('\r\n'),'bagels-trust-trajectory.csv','text/csv;charset=utf-8');$('lab-status').textContent='CSV подготовлен: 1801 строка траектории с параметрами. Десятичный разделитель — точка.';});
$('export-svg').addEventListener('click',()=>{const cloned=$('phase').cloneNode(true);cloned.setAttribute('xmlns','http://www.w3.org/2000/svg');cloned.setAttribute('viewBox','0 0 620 615');cloned.setAttribute('width','900');cloned.setAttribute('height','893');cloned.setAttribute('font-family','Arial, sans-serif');cloned.removeAttribute('tabindex');cloned.removeAttribute('role');const bg=document.createElementNS('http://www.w3.org/2000/svg','rect');bg.setAttribute('width','620');bg.setAttribute('height','615');bg.setAttribute('fill','#fffef9');cloned.insertBefore(bg,cloned.firstChild);const label=document.createElementNS('http://www.w3.org/2000/svg','text');label.setAttribute('x','65');label.setAttribute('y','590');label.setAttribute('font-size','10');label.setAttribute('fill',palette.muted);label.textContent=`p0=${state.p0.toFixed(3)}; q0=${state.q0.toFixed(3)}; α=${state.alpha}; β=${state.beta}; a=${state.a}; b=${state.b}; ε=${state.epsilon}; μ=${state.mu}; T=${state.horizon}`;cloned.appendChild(label);download(new XMLSerializer().serializeToString(cloned),'bagels-trust-phase.svg','image/svg+xml');$('lab-status').textContent='Векторный фазовый портрет подготовлен для сохранения.';});
document.querySelectorAll('[data-try]').forEach(b=>b.addEventListener('click',()=>{state={...M.defaults,p0:Number(b.dataset.try),q0:.8,horizon:80};syncInputs();clearPreset();pause();recompute();$('lab').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}));
document.querySelectorAll('.quiz').forEach(quiz=>quiz.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{quiz.querySelectorAll('button').forEach(b=>{b.classList.remove('correct','incorrect');b.setAttribute('aria-pressed','false');});const correct=button.dataset.choice===quiz.dataset.correct;button.classList.add(correct?'correct':'incorrect');button.setAttribute('aria-pressed','true');const feedback=quiz.querySelector('.feedback');feedback.hidden=false;feedback.setAttribute('role','status');})));
const navLinks=[...document.querySelectorAll('.sidebar nav a')];
const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){navLinks.forEach(a=>{const active=a.hash==='#'+entry.target.id;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}}},{rootMargin:'-12% 0px -65% 0px',threshold:0});
document.querySelectorAll('section[id]').forEach(s=>observer.observe(s));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
syncInputs();applyPreset('recovery');
// A read-only snapshot makes numerical state inspectable without coupling tests to markup.
window.TrustLab={snapshot:()=>({state:{...state},outcome:{...outcome},frame:{...data[index]},end:{...data.at(-1)},reference:reference?{...reference.state}:null,playing})};
})();
