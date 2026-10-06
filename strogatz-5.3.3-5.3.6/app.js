(() => {
  const EPS = 0.045;
  const colors = ["#dd6d52", "#176b69", "#d5a329", "#596f9b", "#9a5d84", "#4f8e78"];
  const seeds = [[.6,.45],[-.7,.5],[.65,-.55],[-.55,-.7],[.15,.8],[-.82,-.1]];

  function matrix(problem, a, b) {
    if (problem === "533") return [0, a, b, 0];
    if (problem === "534") return [a, b, -b, -a];
    if (problem === "535") return [a, b, b, a];
    return [0, 0, a, b];
  }

  function classification(problem, a, b) {
    const eq = (x, y) => Math.abs(x - y) < EPS;
    if (problem === "533") {
      const p = a * b;
      if (p > EPS) return ["Седло", "saddle"];
      if (p < -EPS) return ["Центр", "center"];
      return ["Вырожденный случай", "stable"];
    }
    if (problem === "534") {
      if (eq(Math.abs(a), Math.abs(b))) return ["Вырождение · A² = 0", "stable"];
      return Math.abs(a) > Math.abs(b) ? ["Седло", "saddle"] : ["Центр", "center"];
    }
    if (problem === "535") {
      if (eq(Math.abs(a), Math.abs(b))) return ["Вырождение · λ = 0", "stable"];
      if (a < -Math.abs(b)) return ["Устойчивый узел", "stable"];
      if (a > Math.abs(b)) return ["Неустойчивый узел", "unstable"];
      return ["Седло", "saddle"];
    }
    if (Math.abs(b) < EPS) return ["Линейный дрейф · b = 0", "center"];
    return b < 0 ? ["Притяжение к линии равновесий", "stable"] : ["Отталкивание от линии равновесий", "unstable"];
  }

  function pretty(x) { return Math.abs(x) < EPS ? "0.0" : x.toFixed(1).replace("-", "−"); }

  function draw(section) {
    const problem = section.dataset.problem;
    const canvas = section.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth;
    const cssH = cssW * .75;
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = cssW, H = cssH, range = 3.2;
    const a = +section.querySelector(".param-a").value;
    const b = +section.querySelector(".param-b").value;
    const A = matrix(problem, a, b);
    const mode = classification(problem, a, b);
    section.querySelector(".mode-title").textContent = mode[0];
    const pill = section.querySelector(".mode-pill");
    pill.textContent = mode[1] === "saddle" ? "седло" : mode[1] === "center" ? "центр" : mode[1] === "stable" ? "устойчиво / особо" : "неустойчиво";
    pill.className = "mode-pill " + mode[1];
    section.querySelector(".out-a").textContent = pretty(a);
    section.querySelector(".out-b").textContent = pretty(b);

    const X = r => W / 2 + r * W / (2 * range);
    const Y = j => H / 2 - j * H / (2 * range);
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = "#f8f5ee"; ctx.fillRect(0,0,W,H);

    ctx.strokeStyle = "#ded9ce"; ctx.lineWidth = 1;
    for (let q=-3;q<=3;q++) {
      ctx.beginPath(); ctx.moveTo(X(q),0); ctx.lineTo(X(q),H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,Y(q)); ctx.lineTo(W,Y(q)); ctx.stroke();
    }
    ctx.strokeStyle = "#879294"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0,Y(0)); ctx.lineTo(W,Y(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(0),0); ctx.lineTo(X(0),H); ctx.stroke();
    ctx.fillStyle = "#536366"; ctx.font = "12px system-ui";
    ctx.fillText("R", W-18, Y(0)-8); ctx.fillText("J", X(0)+8, 16);

    // Direction field.
    ctx.strokeStyle = "rgba(42,72,73,.32)"; ctx.lineWidth = 1;
    for (let r=-2.75;r<=2.76;r+=.5) for (let j=-2.75;j<=2.76;j+=.5) {
      const dr=A[0]*r+A[1]*j, dj=A[2]*r+A[3]*j, n=Math.hypot(dr,dj);
      if (n < 1e-7) continue;
      const len=.16, ux=dr/n*len, uy=dj/n*len;
      ctx.beginPath();ctx.moveTo(X(r-ux),Y(j-uy));ctx.lineTo(X(r+ux),Y(j+uy));ctx.stroke();
    }

    // Equilibrium line for 5.3.6 and degenerate 5.3.4/5.3.5.
    if (problem === "536" || ((problem === "534" || problem === "535") && Math.abs(Math.abs(a)-Math.abs(b)) < EPS)) {
      let c0, c1;
      if (problem === "536") { c0 = a; c1 = b; }
      else { c0=A[0]; c1=A[1]; }
      ctx.save(); ctx.setLineDash([7,6]); ctx.strokeStyle="#b47721"; ctx.lineWidth=2;
      if (Math.abs(c1)>EPS) {ctx.beginPath();ctx.moveTo(X(-range),Y(c0*range/c1));ctx.lineTo(X(range),Y(-c0*range/c1));ctx.stroke();}
      else {ctx.beginPath();ctx.moveTo(X(0),0);ctx.lineTo(X(0),H);ctx.stroke();}
      ctx.restore();
    }

    const f = (r,j) => [A[0]*r+A[1]*j,A[2]*r+A[3]*j];
    const step = (r,j,h) => {
      const k1=f(r,j), k2=f(r+h*k1[0]/2,j+h*k1[1]/2), k3=f(r+h*k2[0]/2,j+h*k2[1]/2), k4=f(r+h*k3[0],j+h*k3[1]);
      return [r+h*(k1[0]+2*k2[0]+2*k3[0]+k4[0])/6,j+h*(k1[1]+2*k2[1]+2*k3[1]+k4[1])/6];
    };
    seeds.forEach((s, idx) => {
      ctx.strokeStyle=colors[idx];ctx.lineWidth=2;ctx.beginPath();
      const branches = {};
      [-1,1].forEach(sign => {
        let r=s[0]*2.6,j=s[1]*2.6;
        const pts=[];
        for(let n=0;n<340;n++){
          if(Math.abs(r)>range*1.3||Math.abs(j)>range*1.3)break;
          pts.push([r,j]); [r,j]=step(r,j,sign*.018);
        }
        branches[sign]=pts;
      });
      const curve=branches[-1].slice().reverse().concat(branches[1].slice(1));
      curve.forEach((p,k)=>{if(k===0)ctx.moveTo(X(p[0]),Y(p[1]));else ctx.lineTo(X(p[0]),Y(p[1]));});
      ctx.stroke();
      ctx.fillStyle=colors[idx];ctx.beginPath();ctx.arc(X(s[0]*2.6),Y(s[1]*2.6),3.2,0,Math.PI*2);ctx.fill();
    });
    ctx.fillStyle="#17272b";ctx.beginPath();ctx.arc(X(0),Y(0),3.5,0,Math.PI*2);ctx.fill();
  }

  document.querySelectorAll("[data-problem]").forEach(section => {
    section.querySelectorAll("input").forEach(input => input.addEventListener("input", () => draw(section)));
    section.querySelectorAll(".presets button").forEach(button => button.addEventListener("click", () => {
      section.querySelector(".param-a").value=button.dataset.a;
      section.querySelector(".param-b").value=button.dataset.b;
      draw(section);
    }));
    draw(section);
  });
  let timer;
  window.addEventListener("resize", () => { clearTimeout(timer); timer=setTimeout(()=>document.querySelectorAll("[data-problem]").forEach(draw),120); });
})();
