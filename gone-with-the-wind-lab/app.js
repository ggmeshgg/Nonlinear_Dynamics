(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const M = window.WindModel;
  const palette = { ink: "#3b3035", muted: "#665759", grid: "#e5d9d1", field: "#a39a97", blue: "#286876", red: "#a23855", gold: "#a16a30", violet: "#75549c", stable: "#386658" };
  const format = (n, digits = 2) => n.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const scenes = [
    ["22:26–23:10", "Скарлетт среди поклонников", "Скарлетт легко отвечает на знаки внимания, но быстро отстраняется после отклика. Авторы используют эту сцену, чтобы выбрать форму функции реакции. На траектории пары у S.1 нет отдельной точки.", null],
    ["20:46–21:29", "Первый взгляд", "В Двенадцати Дубах Скарлетт замечает взгляд Ретта. Авторы ставят первую встречу в начало координат. По их интерпретации, Скарлетт вызывает немного более сильный начальный интерес у Ретта.", [436,629]],
    ["39:54–40:35", "Разговор о трауре", "Ретт дразнит Скарлетт, указывая, что ей хочется веселиться. На авторской траектории это ранний участок, где чувства обоих растут.", [555,485]],
    ["40:35–42:00", "Танец на благотворительном балу", "Ретт предлагает 150 долларов золотом за право танцевать со Скарлетт. Она соглашается. Авторы размещают S.3 и S.4 рядом, на участке взаимного сближения.", [580,452]],
    ["42:54–45:47", "Первый поцелуй", "Подарок Ретта и поцелуй отмечают подъём интереса Скарлетт. Авторы помещают сцену около поворота, где её вовлечённость на первом этапе максимальна.", [632,356]],
    ["1:25:49–1:26:53", "Признание и отъезд", "Ретт помогает Скарлетт выбраться из горящей Атланты, признаётся в любви и уезжает. Скарлетт злится на его уход. Эта точка завершает первый этап и начинает пунктир разлуки.", [549,186]],
    ["2:06:43–2:09:22", "Визит в тюрьму", "После войны Скарлетт ищет деньги для Тары и навещает Ретта. Это конец разлуки. В уравнении для её чувств авторы удваивают вклад привлекательности Ретта.", [477,465]],
    ["2:43:11–2:45:07", "Предложение", "Ретт предлагает брак, и Скарлетт соглашается. Она признаёт, что деньги повлияли на решение. На второй ветви траектории вовлечённость обоих снова растёт.", [548,380]],
    ["2:49:00–2:49:19", "После свадьбы", "Супруги выглядят счастливыми. Авторы располагают сцену около максимума чувств Ретта на позднем этапе. Дальше его кривая идёт вниз.", [622,304]],
    ["2:55:53–2:56:29", "Первые признаки отдаления", "В ссоре Ретт отвечает на угрозу Скарлетт холодно. На графике его чувства уже ослабевают, а вовлечённость Скарлетт продолжает расти.", [703,391]],
    ["3:10:45–3:12:12", "Разговор о разводе", "Наутро Ретт предлагает развод. Авторы размещают сцену ближе к финалу, где кривая показывает высокую вовлечённость Скарлетт и низкую вовлечённость Ретта.", [866,496]],
    ["3:34:31–3:37:25", "Ретт уходит", "Скарлетт признаётся в любви, а Ретт уходит. На фазовой плоскости этому соответствует большая горизонтальная координата Скарлетт и небольшая вертикальная координата Ретта. Уход интерпретирует статья, сами уравнения рассчитывают уровни чувств.", [919,517]]
  ];
  const sceneButtons = scenes.map((scene, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "S." + (i + 1);
    button.setAttribute("aria-label", "S." + (i + 1) + " · " + scene[1]);
    button.addEventListener("click", () => selectScene(i));
    $("scene-nav").append(button);
    return button;
  });

  function selectScene(i) {
    const [time, title, description, mark] = scenes[i];
    const image = $("scene-image");
    image.src = "assets/scene-" + String(i + 1).padStart(2, "0") + ".jpg";
    image.alt = title;
    $("scene-kicker").textContent = "S." + (i + 1) + " · " + time;
    $("scene-title").textContent = title;
    $("scene-description").textContent = description;
    $("scene-marker").hidden = !mark;
    if (mark) {
      $("scene-marker").style.left = (mark[0] - 392) / 549 * 100 + "%";
      $("scene-marker").style.top = (mark[1] - 122) / 551 * 100 + "%";
    }
    sceneButtons.forEach((button, j) => button.setAttribute("aria-pressed", String(i === j)));
  }
  selectScene(1);

  const presets = {
    early: { as: 1.2, ar: 1, k: 15, r0: 0, s0: 0, note: "Параметры задачи. Сравните ранний подъём чувств Скарлетт с поздним приближением к узлу, где сильнее вовлечён Ретт." },
    alternate: { as: 1.2, ar: 1, k: 15, r0: 0, s0: 3, compare: true, note: "При тех же параметрах более сильное начальное чувство Скарлетт переносит пару в другой бассейн притяжения." },
    equal: { as: 1, ar: 1, k: 15, r0: 0, s0: 0, note: "При равной привлекательности и одинаковом старте траектория идёт по диагонали к седлу. Сдвиньте старт в сторону, чтобы увидеть другой исход." },
    late: { as: 1.2, ar: 2, k: 15, r0: 2, s0: .6, note: "Послевоенное поле при Aᵣ = 2. Старт выбран для иллюстрации возобновления контакта после разлуки." },
    story: { as: 1.2, ar: 1, k: 15, r0: 0, s0: 0, story: true, note: "Первый этап, разлука и встреча после войны. Передвигайте время, чтобы увидеть смену векторного поля." }
  };
  const sliders = ["as", "ar", "k", "r0", "s0", "arLate", "pause"];
  let currentPreset = "early", storyMode = false, time = 0;
  let run, comparison, limit, phaseGeometry, playbackId, lastStamp;

  function setPreset(key) {
    const p = presets[key];
    currentPreset = key;
    storyMode = Boolean(p.story);
    sliders.forEach(id => { $(id).value = p[id] ?? (id === "arLate" ? 2 : 1); });
    $("compare").checked = Boolean(p.compare);
    $("story-controls").hidden = !storyMode;
    $("preset-note").textContent = p.note;
    document.querySelectorAll("[data-preset]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.preset === key));
    });
    time = 0;
    rebuild();
  }

  function custom() {
    currentPreset = null;
    $("preset-note").textContent = storyMode ? "Ваши параметры для трёх этапов истории." : "Ваши параметры для одного неизменного фазового поля.";
    document.querySelectorAll("[data-preset]").forEach(button => button.setAttribute("aria-pressed", "false"));
  }

  function rebuild() {
    stop();
    const p = Object.fromEntries(sliders.map(id => [id, Number($(id).value)]));
    const story = storyMode ? { cut: 3.6, pause: p.pause, arLate: p.arLate } : null;
    run = M.simulate(p, [p.r0, p.s0], 20, story);
    comparison = $("compare").checked ? M.simulate(p, [0, 0], 20, story) : null;
    const max = Math.max(p.r0, p.s0, p.as + p.k / Math.E, Math.max(p.ar, story ? p.arLate : p.ar) + p.k / Math.E);
    limit = Math.max(8, 2 * Math.ceil(max / 2));
    for (const phase of run.phases) {
      phase.points = M.equilibria(phase.p);
      phase.boundaries = phase.points.filter(q => q.type === "saddle").flatMap(q => M.separatrix(q, phase.p, limit));
    }
    sliders.forEach(id => { $(id + "-value").value = format(p[id], ["k", "pause"].includes(id) ? 1 : 2); });
    const end = run.rows.at(-1);
    $("end").textContent = format(end.r) + " / " + format(end.s);
    const d = Math.abs(end.r - end.s);
    $("experiment-end").textContent = (d < .01 ? "К концу расчёта чувства почти равны." : end.r > end.s ?
      "К концу расчёта сильнее вовлечён Ретт." : "К концу расчёта сильнее вовлечена Скарлетт.") +
      (comparison ? " Серый пунктир — сравнение со стартом (0; 0)." : "");
    render();
  }

  function chart(canvas, square) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return null;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = "11px Segoe UI, Arial";
    const size = Math.min(w - 56, h - 52);
    const left = square ? (w - size) / 2 + 6 : 34;
    const top = 20;
    const width = square ? size : w - 54;
    const height = square ? size : h - 45;
    return { ctx, left, top, width, height };
  }

  function path(ctx, points, color, width, dash = []) {
    if (!points.length) return;
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function circle(ctx, x, y, radius, color, outline = "#fffaf1") {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = outline;
    ctx.stroke();
  }

  function label(ctx, x, y, text, align = "left", color = palette.muted) {
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  function grid(g, xmax, ymax, dx, dy) {
    const { ctx, left, top, width, height } = g;
    const X = x => left + width * x / xmax;
    const Y = y => top + height * (1 - y / ymax);
    for (let x = 0; x <= xmax; x += dx) {
      path(ctx, [[X(x),Y(0)], [X(x),Y(ymax)]], palette.grid, 1);
      label(ctx, X(x), Y(0) + 15, String(x), "center");
    }
    for (let y = 0; y <= ymax; y += dy) {
      path(ctx, [[X(0),Y(y)], [X(xmax),Y(y)]], palette.grid, 1);
      label(ctx, X(0) - 8, Y(y) + 4, String(y), "right");
    }
    path(ctx, [[X(0),Y(ymax)], [X(0),Y(0)], [X(xmax),Y(0)]], palette.muted, 1);
    return { X, Y };
  }

  function drawPhase(active, point) {
    const g = chart($("phase"), true);
    if (!g) return;
    phaseGeometry = g;
    const { ctx, left, top, width, height } = g;
    const { X, Y } = grid(g, limit, limit, 2, 2);
    label(ctx, left, 12, "S · чувства Скарлетт", "left", palette.red);
    label(ctx, left + width, top + height + 30, "R · чувства Ретта", "right", palette.blue);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left - 1, top - 1, width + 2, height + 2);
    ctx.clip();
    if ($("field").checked) {
      for (let j = 1; j < 13; j++) for (let i = 1; i < 13; i++) {
        const r = i * limit / 13, s = j * limit / 13;
        const [u, v] = M.field(r, s, active.p);
        if (Math.hypot(u, v) < 1e-9) continue;
        const a = Math.atan2(-v, u), x = X(r), y = Y(s);
        const x2 = x + 5 * Math.cos(a), y2 = y + 5 * Math.sin(a);
        path(ctx, [[x-5*Math.cos(a),y-5*Math.sin(a)], [x2,y2]], palette.field, .8);
        path(ctx, [[x2-3*Math.cos(a-.55), y2-3*Math.sin(a-.55)], [x2,y2], [x2-3*Math.cos(a+.55),y2-3*Math.sin(a+.55)]], palette.field, .8);
      }
    }
    if ($("curves").checked) {
      const q = Array.from({ length: 181 }, (_, i) => i * limit / 180);
      path(ctx, q.map(s => [X(active.p.as + M.response(s, active.p.k)), Y(s)]), palette.blue, 1.7, [6,4]);
      path(ctx, q.map(r => [X(r), Y(active.p.ar + M.response(r, active.p.k))]), palette.red, 1.7, [3,4]);
      active.boundaries.forEach(branch => path(ctx, branch.map(q => [X(q.r), Y(q.s)]), palette.violet, 1.8, [8,4,2,4]));
    }
    if (comparison) path(ctx, comparison.rows.map(q => [X(q.r),Y(q.s)]), "#736c6d", 1.6, [4,4]);
    for (const phase of run.phases) {
      const segment = run.rows.filter(q => q.t >= phase.start - 1e-9 && q.t <= phase.end + 1e-9);
      path(ctx, segment.map(q => [X(q.r), Y(q.s)]), palette.gold, 2.5, phase.name === "Разлука" ? [5,4] : []);
    }
    ctx.restore();
    active.points.forEach((q, i) => {
      if (q.type === "saddle") {
        ctx.save();
        ctx.translate(X(q.r), Y(q.s));
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = palette.violet;
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      } else circle(ctx, X(q.r), Y(q.s), 4.5, q.type === "critical" ? palette.violet : palette.stable);
      label(ctx, X(q.r) + 8, Y(q.s) - 7, String(i + 1), "left", palette.ink);
    });
    circle(ctx, X(run.rows[0].r), Y(run.rows[0].s), 4, "#fffaf1", palette.gold);
    circle(ctx, X(point.r), Y(point.s), 5.5, "#513024");
  }

  function drawTime(point) {
    const g = chart($("time-plot"), false);
    if (!g) return;
    const { ctx, left, top } = g;
    const { X, Y } = grid(g, run.end, limit, 5, limit <= 8 ? 2 : 4);
    if (storyMode) {
      const pause = run.phases[1];
      ctx.fillStyle = "#d6bd9a40";
      ctx.fillRect(X(pause.start), top, X(pause.end) - X(pause.start), g.height);
    }
    path(ctx, run.rows.map(q => [X(q.t),Y(q.r)]), palette.blue, 2.2);
    path(ctx, run.rows.map(q => [X(q.t),Y(q.s)]), palette.red, 2.2);
    path(ctx, [[X(time),Y(0)],[X(time),Y(limit)]], palette.gold, 1, [3,3]);
    circle(ctx, X(time), Y(point.r), 4, palette.blue);
    circle(ctx, X(time), Y(point.s), 4, palette.red);
    label(ctx, left, 12, "Вовлечённость");
    label(ctx, X(run.end) + 11, Y(0) + 15, "t");
  }

  const pointNames = { saddle: "седло", node: "уст. узел", focus: "уст. фокус", critical: "негиперболическая точка" };
  function render() {
    if (!run) return;
    const active = run.phases.find(phase => time < phase.end) ?? run.phases.at(-1);
    const point = M.pointAt(run, time);
    $("time").value = time;
    $("time-value").value = "t = " + format(time, 1);
    $("r-now").textContent = format(point.r);
    $("s-now").textContent = format(point.s);
    $("regime").textContent = active.name + " · точек: " + active.points.length;
    $("equilibria").textContent = active.points.map((q,i) =>
      (i + 1) + " · (" + format(q.r) + "; " + format(q.s) + ") " + pointNames[q.type]
    ).join("   |   ");
    drawPhase(active, point);
    drawTime(point);
  }

  function stop() {
    cancelAnimationFrame(playbackId);
    playbackId = null;
    lastStamp = null;
    $("play").textContent = "▶ Запустить";
  }

  function tick(stamp) {
    if (lastStamp != null) time = Math.min(run.end, time + Math.min(100, stamp - lastStamp) * .0025);
    lastStamp = stamp;
    render();
    if (time >= run.end) stop();
    else playbackId = requestAnimationFrame(tick);
  }

  $("play").addEventListener("click", () => {
    if (playbackId != null) { stop(); return; }
    if (time >= run.end) time = 0;
    $("play").textContent = "Ⅱ Пауза";
    playbackId = requestAnimationFrame(tick);
  });
  $("time").addEventListener("input", () => { stop(); time = Number($("time").value); render(); });
  $("field").addEventListener("change", render);
  $("curves").addEventListener("change", render);
  $("compare").addEventListener("change", rebuild);
  $("presets").addEventListener("click", e => {
    const button = e.target.closest("[data-preset]");
    if (button) setPreset(button.dataset.preset);
  });
  sliders.forEach(id => $(id).addEventListener("input", () => { custom(); rebuild(); }));
  $("phase").addEventListener("click", e => {
    if (!phaseGeometry) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { left, top, width, height } = phaseGeometry;
    const x = (e.clientX - rect.left - left) / width, y = (e.clientY - rect.top - top) / height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    $("r0").value = Math.min(12, Math.round(x * limit * 20) / 20);
    $("s0").value = Math.min(12, Math.round((1 - y) * limit * 20) / 20);
    time = 0;
    custom();
    rebuild();
  });
  $("return-early").addEventListener("click", () => setPreset("early"));
  for (const element of document.querySelectorAll(".math")) {
    if (window.katex) window.katex.render(element.textContent, element, { displayMode: element.classList.contains("display"), throwOnError: false, strict: "ignore" });
  }
  setPreset(currentPreset);
  new ResizeObserver(render).observe($("phase"));
  new ResizeObserver(render).observe($("time-plot"));
})();
