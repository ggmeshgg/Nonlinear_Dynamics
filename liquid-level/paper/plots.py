"""Reproducible vector figures for the Russian Typst handout."""
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
from scipy.linalg import expm

OUT = Path(__file__).parent / 'figures'
OUT.mkdir(exist_ok=True)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,
 'axes.spines.right':False,'axes.labelcolor':'#233546','text.color':'#233546',
 'xtick.color':'#506171','ytick.color':'#506171','axes.edgecolor':'#a7b4bb',
 'svg.fonttype':'path','savefig.facecolor':'white'})
BLUE='#146A86'; RED='#AC4739'; INK='#233546'; PURPLE='#745199'
cases=[('A','Устойчивый узел',2.7,1,BLUE),('B','Устойчивая спираль',0,1,BLUE),
       ('C','Неустойчивая спираль',-.6,1,RED),('D','Неустойчивый узел',-3,1,RED)]
def matrix(kp,ki):return np.array([[-(kp+.3),ki],[-1,0]])
def save(fig,name):
 fig.savefig(OUT/name,bbox_inches='tight',pad_inches=.12,dpi=180)
 plt.close(fig)

# Exact local classification for KI > 0; zero integral gain is excluded.
fig,ax=plt.subplots(figsize=(7.0,4.6),layout='constrained')
kp=np.linspace(-3.6,3.1,800);ki=np.linspace(.001,2.5,450)
X,Y=np.meshgrid(kp,ki);tr=-(X+.3);disc=(X+.3)**2-4*Y
reg=np.where(tr<0,np.where(disc>=0,0,1),np.where(disc>=0,3,2))
ax.pcolormesh(X,Y,reg,cmap=ListedColormap(['#dceaf1','#e9f3f6','#fff0df','#f6ded9']),shading='auto',rasterized=True)
curve=(kp+.3)**2/4
ax.plot(kp,curve,color=INK,lw=1.7,label='Граница узла и спирали')
ax.axvline(-.3,color=PURPLE,lw=1.7,ls='--',label='Нулевой след: кандидат на Хопфа')
ax.set(xlim=(-3.6,3.1),ylim=(.0,2.5),xlabel='Пропорциональное усиление $K_P$',ylabel='Интегральное усиление $K_I$')
ax.text(1.0,1.9,'Устойчивая\nспираль',color=BLUE,ha='center',fontsize=12)
ax.text(2.4,.26,'Устойчивый\nузел',color=BLUE,ha='center',fontsize=11)
ax.text(-1.5,1.9,'Неустойчивая\nспираль',color=RED,ha='center',fontsize=12)
ax.text(-2.75,.28,'Неустойчивый\nузел',color=RED,ha='center',fontsize=11)
for label,_,a,b,col in cases:
 ax.plot(a,b,'o',color=col,ms=6,mec='white',mew=1)
 ax.annotate(label,(a,b),xytext=(7,9),textcoords='offset points',weight='bold',fontsize=11)
ax.set_xticks([-3,-2,-1,-.3,0,1,2,3],labels=['−3','−2','−1','−0,3','0','1','2','3'])
ax.tick_params(axis='x',labelsize=8)
ax.legend(loc='upper center',bbox_to_anchor=(.5,-.17),frameon=False,fontsize=9)
save(fig,'regime-map.svg')

fig,axs=plt.subplots(2,2,figsize=(7,6.5),layout='constrained')
for ax,(label,name,kp,ki,col) in zip(axs.flat,cases):
 J=matrix(kp,ki);grid=np.linspace(-.115,.115,13);xx,yy=np.meshgrid(grid,grid)
 u=J[0,0]*xx+J[0,1]*yy;v=-xx;norm=np.hypot(u,v);norm[norm==0]=1
 ax.quiver(xx,yy,u/norm,v/norm,color='#a8b6bf',alpha=.85,angles='xy',scale_units='xy',scale=100,width=.003)
 for seed in [[.085,.045],[-.045,.085],[-.085,-.045],[.045,-.085]]:
  initial=np.array(seed)*(.1 if kp<-.3 else 1)
  times=np.linspace(0,32,2400);pts=np.array([expm(J*t)@initial for t in times])
  outside=np.flatnonzero(np.max(np.abs(pts),axis=1)>.12)
  if len(outside):pts=pts[:outside[0]+1]
  ax.plot(pts[:,0],pts[:,1],color=col,lw=1.2)
  ax.plot(*initial,'o',color=col,ms=3)
 ax.plot(0,0,'o',mec=INK,mfc='white',ms=5,zorder=5)
 ax.axhline(0,color='#bdc8cd',lw=.5);ax.axvline(0,color='#bdc8cd',lw=.5)
 ax.set(xlim=(-.12,.12),ylim=(-.12,.12),xlabel='$x = h-1$',ylabel=r'$y = z-z^\star$',aspect='equal')
 ax.set_xticks([-.1,0,.1]);ax.set_yticks([-.1,0,.1]);ax.tick_params(labelsize=9)
 ax.set_title(f'{label}  {name}\n$K_P={kp:g}, K_I={ki:g}$',fontsize=10,pad=10)
save(fig,'portraits.svg')

fig,ax=plt.subplots(figsize=(7,3.1),layout='constrained')
t=np.linspace(0,12,600)
for kp,name,col,ls in [(2.7,'A · узел: $K_P=2.7$',BLUE,'--'),(0,'B · внутрь: $K_P=0$',BLUE,'-'),(-.6,'C · наружу: $K_P=-0.6$',RED,'-')]:
 pts=np.array([expm(matrix(kp,1)*tt)@np.array([.03,0]) for tt in t])
 ax.plot(t,pts[:,0],label=name,color=col,ls=ls,lw=1.8)
ax.axhline(0,color='#9aaab4',lw=.7);ax.grid(alpha=.15)
ax.set(xlabel='Время $t$ · нормированные единицы',ylabel='Отклонение уровня $x$',xlim=(0,12))
ax.legend(frameon=False,fontsize=9,loc='upper left')
save(fig,'time-traces.svg')

fig,ax=plt.subplots(figsize=(7,2.3),layout='constrained')
ax.set_xlim(-3.3,3.2);ax.set_ylim(0,1);ax.set_yticks([])
for left,right,col,label in [(-3.3,-2.3,'#f6ded9','Неуст.\nузел'),(-2.3,-.3,'#fff0df','Неустойчивая\nспираль'),(-.3,1.7,'#e9f3f6','Устойчивая\nспираль'),(1.7,3.2,'#dceaf1','Устойчивый\nузел')]:
 ax.axvspan(left,right,color=col);ax.text((left+right)/2,.5,label,ha='center',va='center',fontsize=10)
for a in [-2.3,-.3,1.7]:ax.axvline(a,color=PURPLE if a==-.3 else INK,ls='--' if a==-.3 else '-',lw=1.3)
ax.set_xticks([-2.3,-.3,1.7],labels=['−2,3','−0,3','1,7']);ax.set_xlabel('Срез карты при $K_I=1$: пропорциональное усиление $K_P$')
save(fig,'parameter-cut.svg')

for label,name,kp,ki,_ in cases:
 print(label,name,np.linalg.eigvals(matrix(kp,ki)))
