'use strict';
// Exact flow on the population simplex. Kept separate for mathematical checks.
function flow(x0,y0,r,t){const s0=x0+y0,z0=Math.max(0,1-s0),e=Math.exp(-r*t),q=s0+z0*e;return [x0/q,y0/q,z0*e/q];}
if(typeof module!=='undefined')module.exports={flow};
if(typeof document!=='undefined'){
const $=id=>document.getElementById(id),fmt=(v,n=1)=>v.toLocaleString('ru-RU',{minimumFractionDigits:n,maximumFractionDigits:n}),pct=v=>fmt(100*v)+'%';
const state={r:1,z:.7,p:2/3,t:0,playing:false,last:0};
const colors={x:'#ad5835',y:'#5276a6',z:'#277c70',ink:'#21383e'};
const svgLine=(x1,y1,x2,y2,color,width=1,extra='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const text=(x,y,value,extra='')=>`<text x="${x}" y="${y}" ${extra}>${value}</text>`;
const xy=(x,y)=>[65+400*x,410-350*y];
const circle=(x,y,r,fill,stroke='none',width=1)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
function initial(){return [(1-state.z)*state.p,(1-state.z)*(1-state.p)];}
function arrow(x,y,dx,dy,color){const k=Math.hypot(dx,dy);if(k<1e-10)return '';const ux=dx/k,uy=dy/k;const ax=x-ux*7,ay=y-uy*7,bx=x+ux*7,by=y+uy*7;return svgLine(ax,ay,bx,by,color,1.3)+`<path d="M ${bx-ux*4-uy*3} ${by-uy*4+ux*3} L${bx} ${by} L${bx-ux*4+uy*3} ${by-uy*4-ux*3}" fill="none" stroke="${color}" stroke-width="1.3"/>`;}
function drawPhase(){
 const [x0,y0]=initial(),[x,y]=flow(x0,y0,state.r,state.t);let s='<title>Фазовый портрет: x — правые, y — левые</title>';
 s+='<path d="M65 410L465 410L65 60Z" fill="'+(state.r===0&&$('null').checked?'#dcece1':'#f0f0e7')+'" stroke="#d6dbd1"/>';
 for(let i=1;i<5;i++){const v=i/5,[a,b]=xy(v,0),[c,d]=xy(0,v);s+=svgLine(a,b,a,xy(v,1-v)[1],'#d9ded3',1,'stroke-dasharray="3 4"')+svgLine(c,d,xy(1-v,v)[0],d,'#d9ded3',1,'stroke-dasharray="3 4"');s+=text(a,432,fmt(v), 'text-anchor="middle" font-size="11" fill="#657270"')+text(52,d+4,fmt(v),'text-anchor="end" font-size="11" fill="#657270"');}
 if($('rays').checked&&state.r!==0){for(let p=.1;p<1;p+=.1){const [ex,ey]=xy(p,1-p);s+=svgLine(65,410,ex,ey,'#c2cbc1',1.1);for(const frac of [.28,.6,.84]){const [ax,ay]=xy(p*frac,(1-p)*frac);s+=arrow(ax,ay,Math.sign(state.r)*p*400,-Math.sign(state.r)*(1-p)*350,'#a5b4a9');}}}
 if($('field').checked&&state.r!==0){for(let i=0;i<=10;i++)for(let j=0;j<=10-i;j++){const a=i/10,b=j/10,z=1-a-b;if(z<.05||a+b<.05)continue;const [px,py]=xy(a,b);s+=arrow(px,py,state.r*a*z*400,-state.r*b*z*350,'#829990');}}
 s+=svgLine(65,410,486,410,'#82918a',1)+svgLine(65,410,65,38,'#82918a',1);
 if($('null').checked){s+=svgLine(65,410,65,60,colors.x,3)+svgLine(65,410,465,410,colors.y,3)+svgLine(65,60,465,410,colors.z,4);}
 if(state.r===0){s+=text(170,280,'r = 0: всюду равновесие','font-size="14" fill="#277c70"');}
 const s0=x0+y0;let endpoint=[x0,y0];if(s0>0&&state.z>0&&state.r!==0)endpoint=state.r>0?[state.p,1-state.p]:[0,0];
 if(s0>0&&state.r!==0){const [epx,epy]=xy(...endpoint),[ix,iy]=xy(x0,y0);s+=svgLine(ix,iy,epx,epy,colors.ink,1.5,'stroke-dasharray="5 5"');}
 const [ix,iy]=xy(x0,y0),[cx,cy]=xy(x,y),[ex,ey]=xy(...endpoint);s+=svgLine(ix,iy,cx,cy,colors.ink,3.5);s+=circle(65,410,4,colors.ink);s+=circle(ex,ey,8,'#fffef9',colors.ink,2);
 s+=`<path d="M${ix} ${iy-7}l7 7l-7 7l-7 -7Z" fill="#fffef9" stroke="${colors.ink}" stroke-width="1.5"/>`+circle(cx,cy,6,colors.x,'#fffef9',2);
 s+=text(62,26,'y · левые','font-size="13" fill="#21383e"')+text(390,459,'x · правые','font-size="13" fill="#21383e"')+text(49,431,'0','font-size="11"')+text(465,431,'1','font-size="11" text-anchor="middle"')+text(51,64,'1','font-size="11" text-anchor="end"');
 s+=text(248,93,'L: x + y = 1','font-size="14" fill="#277c70"')+text(248,114,'центристов нет','font-size="11" fill="#657270"');
 $('phase').innerHTML=s;
 $('regime').textContent=state.r>0?'r > 0 · к границе':state.r<0?'r < 0 · к началу':'r = 0 · покой';
}
function drawTimeline(){const [x0,y0]=initial();let s='<title>Доли населения от t = 0 до t = 20</title>';const width=Math.max(440,Math.round($('timeline').clientWidth)),right=width-30,px=t=>50+t*(right-50)/20,py=v=>202-v*175;$('timeline').setAttribute('viewBox',`0 0 ${width} 245`);
 for(let i=0;i<=4;i++){const v=i/4,y=py(v);s+=svgLine(50,y,right,y,'#58706f',.7)+text(40,y+4,`${Math.round(100*v)}%`,'text-anchor="end" fill="#d2ded8" font-size="13"');}
 for(let t=0;t<=20;t+=5)s+=text(px(t),225,t,'text-anchor="middle" fill="#d2ded8" font-size="13"');
 for(let j=0;j<3;j++){let points=[];for(let i=0;i<=400;i++){const t=i/20;points.push(px(t)+','+py(flow(x0,y0,state.r,t)[j]));}const color=['#efa674','#93b9ec','#78cfad'][j];s+=`<polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" ${j===1?'stroke-dasharray="7 3"':j===2?'stroke-dasharray="3 2"':''}/>`;s+=text(50+j*(width-70)/3,15,['x · правые','y · левые','z · центристы'][j],`fill="${color}" font-size="14"`);}
 s+=svgLine(px(state.t),25,px(state.t),205,'#fff7df',1,'stroke-dasharray="4 4"');const vals=flow(x0,y0,state.r,state.t);for(let j=0;j<3;j++)s+=circle(px(state.t),py(vals[j]),4,['#efa674','#93b9ec','#78cfad'][j],'#21383e',1);s+=text(width-10,225,'t','fill="#d2ded8" font-size="13"');$('timeline').innerHTML=s;
}
function outcome(){const [x0,y0]=initial();let str;if(state.r===0)str='<b>Движения нет.</b> При r = 0 начальный состав сохраняется: все состояния — равновесия.';else if(state.z===1)str='<b>Все остаются центристами.</b> Крайних групп нет, поэтому взаимодействовать с центром некому. '+(state.r>0?'Равновесие неустойчиво: добавление малой крайней группы изменит исход.':'Это устойчивое центристское состояние.');else if(state.z===0)str='<b>Движения нет: центристов изначально нет.</b> Точка лежит на L. '+(state.r<0?'Добавление даже малой доли центристов изменит долгосрочный исход.':'Это одно из равновесий притягивающего отрезка.');else if(state.r>0)str=`<b>Предел:</b> правые ${pct(state.p)}, левые ${pct(1-state.p)}, центристы 0%. `+(state.p===0||state.p===1?'Отсутствующая крайняя группа не возникает. Остаётся одна сторона спектра.':'Обе крайние группы растут, а их начальная пропорция сохраняется.');else str='<b>Предел:</b> правые 0%, левые 0%, центристы 100%. Любая положительная начальная доля центра здесь приводит к центристскому исходу.';
 $('outcome').innerHTML=str;
}
function render(full=true){const [x0,y0]=initial(),vals=flow(x0,y0,state.r,state.t);$('r-val').textContent='r = '+fmt(state.r);$('z-val').textContent=pct(state.z);$('p-val').textContent=state.z===1?'не определено':pct(state.p);$('p').disabled=state.z===1;$('initial').textContent=`Начало: x₀ = ${fmt(x0,3)} · y₀ = ${fmt(y0,3)} · z₀ = ${fmt(state.z,3)}`;$('time-val').textContent=fmt(state.t,2);$('time').value=state.t;['mx','my','mz'].forEach((id,i)=>$(id).textContent=pct(vals[i]));$('sum').textContent=fmt(vals.reduce((a,b)=>a+b,0),3);document.querySelectorAll('[data-r]').forEach(b=>{const on=Math.sign(Number(b.dataset.r))===Math.sign(state.r);b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});drawPhase();drawTimeline();if(full)outcome();}
function stop(){state.playing=false;$('play').textContent=state.t>=20?'↺ Повторить':'▶ Запустить';}
function reset(){stop();state.t=0;$('play').textContent='▶ Запустить';render();}
function sync(){['r','z0','p'].forEach((id,i)=>$(id).value=[state.r,state.z,state.p][i]);}
['r','z0','p'].forEach(id=>$(id).addEventListener('input',()=>{state[id==='z0'?'z':id]=Number($(id).value);if(id!=='r')$('preset').value='custom';reset();}));
document.querySelectorAll('[data-r]').forEach(b=>b.addEventListener('click',()=>{state.r=Number(b.dataset.r);sync();reset();}));
['field','rays','null'].forEach(id=>$(id).addEventListener('change',drawPhase));
const presets={default:[.7,2/3],symmetric:[.6,.5],'no-center':[0,.6],'all-center':[1,.5],'one-side':[.7,1]};
$('preset').addEventListener('change',()=>{[state.z,state.p]=presets[$('preset').value];sync();reset();});
$('phase').addEventListener('click',e=>{const pt=$('phase').createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const p=pt.matrixTransform($('phase').getScreenCTM().inverse());let x=(p.x-65)/400,y=(410-p.y)/350;if(x<-.01||y<-.01||x+y>1.01)return;x=Math.max(0,x);y=Math.max(0,y);if(x+y>1){const sum=x+y;x/=sum;y/=sum;}state.z=Math.max(0,1-x-y);state.p=x+y>0?x/(x+y):.5;$('preset').value='custom';sync();reset();});
$('time').addEventListener('input',()=>{stop();state.t=Number($('time').value);render(false);});$('reset').addEventListener('click',reset);
function tick(now){if(!state.playing)return;if(state.last)state.t=Math.min(20,state.t+(now-state.last)/1000*1.5);state.last=now;render(false);if(state.t>=20)stop();else requestAnimationFrame(tick);}
$('play').addEventListener('click',()=>{if(state.playing){stop();return;}if(state.t>=20)state.t=0;state.playing=true;state.last=0;$('play').textContent='Ⅱ Пауза';requestAnimationFrame(tick);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('resize',drawTimeline);
$('print').addEventListener('click',()=>{stop();const open=[];document.querySelectorAll('details:not(#source-image)').forEach(d=>{if(!d.open){d.open=true;open.push(d);}});window.addEventListener('afterprint',()=>open.forEach(d=>d.open=false),{once:true});window.print();});
document.querySelectorAll('.quiz').forEach(q=>q.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{q.querySelectorAll('button').forEach(c=>{c.classList.remove('correct','wrong');c.setAttribute('aria-pressed','false');});b.classList.add(b.dataset.choice===q.dataset.answer?'correct':'wrong');b.setAttribute('aria-pressed','true');const f=q.querySelector('.feedback');f.hidden=false;f.setAttribute('role','status');})));
const nav=[...document.querySelectorAll('.sidebar nav a')];const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){nav.forEach(a=>{const match=a.hash==='#'+e.target.id;a.classList.toggle('active',match);if(match)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}});},{rootMargin:'-15% 0px -65% 0px'});document.querySelectorAll('section[id]').forEach(s=>observer.observe(s));sync();render();
}
