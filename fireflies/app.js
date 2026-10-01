(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const controls = {
    omega: document.querySelector("#omega"),
    stimulus: document.querySelector("#stimulus"),
    coupling: document.querySelector("#coupling"),
    spread: document.querySelector("#spread"),
    population: document.querySelector("#population"),
    speed: document.querySelector("#speed")
  };

  const outputs = {
    omega: document.querySelector("#omegaOutput"),
    stimulus: document.querySelector("#stimulusOutput"),
    coupling: document.querySelector("#couplingOutput"),
    spread: document.querySelector("#spreadOutput")
  };

  const ui = {
    playButton: document.querySelector("#playButton"),
    playIcon: document.querySelector("#playIcon"),
    playText: document.querySelector("#playText"),
    resetButton: document.querySelector("#resetButton"),
    statusPill: document.querySelector("#statusPill"),
    statusText: document.querySelector("#statusText"),
    lockedMetric: document.querySelector("#lockedMetric"),
    mismatchMetric: document.querySelector("#mismatchMetric"),
    coherenceMetric: document.querySelector("#coherenceMetric"),
    slipMetric: document.querySelector("#slipMetric"),
    verdictText: document.querySelector("#verdictText"),
    meterBand: document.querySelector("#meterBand"),
    naturalMarker: document.querySelector("#naturalMarker"),
    stimulusMarker: document.querySelector("#stimulusMarker"),
    bottleneckReadout: document.querySelector("#bottleneckReadout"),
    bottleneckState: document.querySelector("#bottleneckState"),
    bottleneckPhase: document.querySelector("#bottleneckPhase"),
    bottleneckDrift: document.querySelector("#bottleneckDrift")
  };

  const canvases = {
    field: document.querySelector("#fieldCanvas"),
    phase: document.querySelector("#phaseCanvas"),
    timeline: document.querySelector("#timelineCanvas")
  };

  const contexts = Object.fromEntries(Object.entries(canvases).map(([key, canvas]) => [key, canvas.getContext("2d")]));

  let flies = [];
  let beaconPhase = 0;
  let simTime = 0;
  let paused = false;
  let lastFrame = performance.now();
  let flashEvents = [];
  let beaconFlashes = [];
  let representativeStartDifference = 0;
  let displayedSlips = 0;
  let metricsClock = 0;
  let responseMode = "sine";

  function number(name) {
    return Number(controls[name].value);
  }

  function gaussian(index) {
    // Deterministic Box-Muller samples keep the population stable after parameter changes.
    const u = Math.max(1e-6, fract(Math.sin((index + 1) * 12.9898) * 43758.5453));
    const v = fract(Math.sin((index + 1) * 78.233) * 23421.631);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  function fract(value) {
    return value - Math.floor(value);
  }

  function hash(index, salt) {
    return fract(Math.sin(index * 91.734 + salt * 38.152) * 41758.231);
  }

  function makeFly(index, count, keepPhase = null) {
    const phase = keepPhase ?? hash(index, 7) * TAU;
    return {
      phase,
      omegaOffset: gaussian(index),
      x: 0.05 + 0.9 * hash(index, 1),
      y: 0.13 + 0.76 * hash(index, 2),
      size: 0.7 + 1.5 * hash(index, 3),
      depth: 0.45 + 0.55 * hash(index, 4),
      flash: 0,
      row: index % Math.min(26, count)
    };
  }

  function rebuildPopulation(resetPhases = true) {
    const count = Number(controls.population.value);
    const old = flies;
    flies = Array.from({ length: count }, (_, index) => makeFly(index, count, resetPhases ? null : old[index]?.phase));
    if (resetPhases) {
      beaconPhase = 0;
      simTime = 0;
      flashEvents = [];
      beaconFlashes = [];
      displayedSlips = 0;
    }
    representativeStartDifference = beaconPhase - (flies[0]?.phase ?? 0);
    updateReadouts();
  }

  function omegaFor(fly) {
    return number("omega") + fly.omegaOffset * number("spread");
  }

  function triangleResponse(phaseDifference) {
    // Wrap to the definition interval [-π/2, 3π/2).
    const phi = ((phaseDifference + Math.PI / 2) % TAU + TAU) % TAU - Math.PI / 2;
    return phi <= Math.PI / 2 ? phi : Math.PI - phi;
  }

  function response(phaseDifference) {
    return responseMode === "triangle" ? triangleResponse(phaseDifference) : Math.sin(phaseDifference);
  }

  function responsePeak() {
    return responseMode === "triangle" ? Math.PI / 2 : 1;
  }

  function derivative(theta, omega, beacon, coupling) {
    return omega + coupling * response(beacon - theta);
  }

  function integrateFly(fly, dt, oldBeacon, stimulus, coupling) {
    const omega = omegaFor(fly);
    // RK4 uses a linearly advancing beacon during this short step.
    const k1 = derivative(fly.phase, omega, oldBeacon, coupling);
    const k2 = derivative(fly.phase + k1 * dt / 2, omega, oldBeacon + stimulus * dt / 2, coupling);
    const k3 = derivative(fly.phase + k2 * dt / 2, omega, oldBeacon + stimulus * dt / 2, coupling);
    const k4 = derivative(fly.phase + k3 * dt, omega, oldBeacon + stimulus * dt, coupling);
    return fly.phase + dt * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
  }

  function step(dt) {
    const stimulus = number("stimulus");
    const coupling = number("coupling");
    const oldBeacon = beaconPhase;
    beaconPhase += stimulus * dt;
    simTime += dt;

    if (Math.floor(oldBeacon / TAU) < Math.floor(beaconPhase / TAU)) beaconFlashes.push(simTime);

    flies.forEach((fly, index) => {
      const oldPhase = fly.phase;
      fly.phase = integrateFly(fly, dt, oldBeacon, stimulus, coupling);
      fly.flash *= Math.exp(-dt * 8.5);
      if (Math.floor(oldPhase / TAU) < Math.floor(fly.phase / TAU)) {
        fly.flash = 1;
        if (index < 26) flashEvents.push({ time: simTime, row: index });
      }
    });

    const cutoff = simTime - 12.5;
    flashEvents = flashEvents.filter(event => event.time >= cutoff);
    beaconFlashes = beaconFlashes.filter(time => time >= cutoff);

    if (flies[0]) {
      const drift = beaconPhase - flies[0].phase - representativeStartDifference;
      displayedSlips = Math.abs(Math.trunc(drift / TAU));
    }

    metricsClock += dt;
    if (metricsClock > 0.12) {
      updateMetrics();
      metricsClock = 0;
    }
  }

  function fitCanvas(canvas, context) {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width: rect.width, height: rect.height };
  }

  function wrapped(phase) {
    return ((phase % TAU) + TAU) % TAU;
  }

  function circularDistance(a, b) {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
  }

  function bottleneckInfo() {
    const mismatch = number("stimulus") - number("omega");
    const direction = Math.sign(mismatch);
    const maximumPull = number("coupling") * responsePeak();
    const phaseDifference = direction * Math.PI / 2;
    const representativeDifference = flies[0] ? beaconPhase - flies[0].phase : 0;
    const distance = direction === 0 ? Infinity : Math.abs(circularDistance(representativeDifference, phaseDifference));
    return {
      direction,
      phaseDifference,
      oscillatorPhase: beaconPhase - phaseDifference,
      minimumDrift: Math.abs(mismatch) - maximumPull,
      inside: distance < .2
    };
  }

  function pulse(phase) {
    const distance = Math.min(wrapped(phase), TAU - wrapped(phase));
    return Math.exp(-distance * distance / 0.018);
  }

  function drawField() {
    const ctx = contexts.field;
    const { width, height } = fitCanvas(canvases.field, ctx);
    ctx.clearRect(0, 0, width, height);

    const beaconPulse = pulse(beaconPhase);
    const beaconX = width * 0.83;
    const beaconY = height * 0.16;
    const beaconGlow = ctx.createRadialGradient(beaconX, beaconY, 0, beaconX, beaconY, 30 + beaconPulse * 95);
    beaconGlow.addColorStop(0, `rgba(255, 215, 128, ${0.9 * beaconPulse + 0.15})`);
    beaconGlow.addColorStop(0.12, `rgba(255, 184, 76, ${0.48 * beaconPulse + 0.08})`);
    beaconGlow.addColorStop(1, "rgba(255, 184, 76, 0)");
    ctx.fillStyle = beaconGlow;
    ctx.beginPath();
    ctx.arc(beaconX, beaconY, 30 + beaconPulse * 95, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 220, 143, ${0.45 + 0.55 * beaconPulse})`;
    ctx.beginPath(); ctx.arc(beaconX, beaconY, 3.2, 0, TAU); ctx.fill();

    // A quiet horizon gives the points a physical setting without hiding the data.
    ctx.fillStyle = "rgba(46, 69, 49, 0.13)";
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 24) {
      const y = height * 0.88 + Math.sin(x * 0.027) * 10 + Math.sin(x * 0.071) * 5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height); ctx.closePath(); ctx.fill();

    flies.forEach((fly, index) => {
      const x = fly.x * width + Math.sin(simTime * 0.18 + index) * 2.8;
      const y = fly.y * height + Math.cos(simTime * 0.13 + index * 1.7) * 2;
      const light = Math.max(fly.flash, pulse(fly.phase) * 0.8);
      const radius = fly.size * fly.depth;
      if (light > 0.015) {
        const glowRadius = radius * (7 + 11 * light);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
        glow.addColorStop(0, `rgba(228, 255, 145, ${0.88 * light})`);
        glow.addColorStop(0.16, `rgba(183, 241, 89, ${0.48 * light})`);
        glow.addColorStop(1, "rgba(183, 241, 89, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, glowRadius, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = `rgba(218, 247, 158, ${0.1 + 0.9 * light})`;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
    });
  }

  function drawPhaseCircle() {
    const ctx = contexts.phase;
    const { width, height } = fitCanvas(canvases.phase, ctx);
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2 - 2;
    const radius = Math.min(width, height) * 0.34;

    ctx.strokeStyle = "rgba(225, 239, 216, 0.13)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, radius * .64, 0, TAU); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * TAU - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * (radius - 4), cy + Math.sin(angle) * (radius - 4));
      ctx.lineTo(cx + Math.cos(angle) * (radius + 4), cy + Math.sin(angle) * (radius + 4));
      ctx.stroke();
    }

    const bottleneck = bottleneckInfo();
    if (bottleneck.direction !== 0) {
      const bottleneckAngle = wrapped(bottleneck.oscillatorPhase) - Math.PI / 2;
      ctx.save();
      ctx.strokeStyle = bottleneck.inside ? "rgba(255,132,109,.95)" : "rgba(255,184,76,.6)";
      ctx.lineWidth = bottleneck.inside ? 7 : 5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, bottleneckAngle - .16, bottleneckAngle + .16);
      ctx.stroke();
      ctx.setLineDash([]);
      const bx = cx + Math.cos(bottleneckAngle) * (radius + 21);
      const by = cy + Math.sin(bottleneckAngle) * (radius + 21);
      ctx.fillStyle = bottleneck.inside ? "#ff846d" : "#ffb84c";
      ctx.font = "700 9px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("B", bx, by);
      ctx.restore();
    }

    const maxDots = Math.min(flies.length, 160);
    for (let i = 0; i < maxDots; i++) {
      const fly = flies[Math.floor(i * flies.length / maxDots)];
      const angle = wrapped(fly.phase) - Math.PI / 2;
      const jitter = (hash(i, 11) - .5) * 13;
      const x = cx + Math.cos(angle) * (radius + jitter);
      const y = cy + Math.sin(angle) * (radius + jitter);
      const glow = Math.max(.2, fly.flash);
      ctx.fillStyle = `rgba(216, 255, 115, ${0.22 + glow * .6})`;
      ctx.beginPath(); ctx.arc(x, y, 1.4 + fly.flash, 0, TAU); ctx.fill();
    }

    const stimulusAngle = wrapped(beaconPhase) - Math.PI / 2;
    const sx = cx + Math.cos(stimulusAngle) * radius;
    const sy = cy + Math.sin(stimulusAngle) * radius;
    ctx.strokeStyle = "rgba(255, 184, 76, .55)";
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sx, sy); ctx.stroke();
    ctx.shadowBlur = 16; ctx.shadowColor = "#ffb84c"; ctx.fillStyle = "#ffb84c";
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(231,240,220,.42)";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("FLASH", cx, cy - radius - 17);
    ctx.font = "italic 13px Georgia, serif";
    ctx.fillText("phase", cx, cy + 5);
  }

  function drawTimeline() {
    const ctx = contexts.timeline;
    const { width, height } = fitCanvas(canvases.timeline, ctx);
    ctx.clearRect(0, 0, width, height);
    const left = 38;
    const right = 10;
    const top = 18;
    const bottom = 14;
    const rows = Math.min(26, flies.length);
    const rowHeight = (height - top - bottom) / (rows + 1);
    const xFor = time => left + (time - (simTime - 12)) / 12 * (width - left - right);

    ctx.font = "9px ui-sans-serif, system-ui";
    ctx.textAlign = "right";
    for (let row = 0; row <= rows; row++) {
      const y = top + row * rowHeight;
      ctx.strokeStyle = row === 0 ? "rgba(255,184,76,.16)" : "rgba(225,239,216,.055)";
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - right, y); ctx.stroke();
      if (row === 0) {
        ctx.fillStyle = "rgba(255,184,76,.65)"; ctx.fillText("Θ", left - 9, y + 3);
      } else if (row % 5 === 1) {
        ctx.fillStyle = "rgba(231,240,220,.35)"; ctx.fillText(String(row).padStart(2, "0"), left - 9, y + 3);
      }
    }
    for (let seconds = 0; seconds <= 12; seconds += 2) {
      const x = left + seconds / 12 * (width - left - right);
      ctx.strokeStyle = "rgba(225,239,216,.04)";
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, height - bottom); ctx.stroke();
    }

    ctx.lineWidth = 1.4;
    beaconFlashes.forEach(time => {
      const x = xFor(time);
      if (x < left) return;
      ctx.strokeStyle = "rgba(255,184,76,.9)";
      ctx.beginPath(); ctx.moveTo(x, top - 4); ctx.lineTo(x, top + rowHeight * .38); ctx.stroke();
    });
    flashEvents.forEach(event => {
      const x = xFor(event.time);
      if (x < left) return;
      const y = top + (event.row + 1) * rowHeight;
      ctx.strokeStyle = "rgba(216,255,115,.78)";
      ctx.beginPath(); ctx.moveTo(x, y - rowHeight * .34); ctx.lineTo(x, y + rowHeight * .34); ctx.stroke();
    });

    const nowX = width - right;
    const gradient = ctx.createLinearGradient(nowX - 45, 0, nowX, 0);
    gradient.addColorStop(0, "rgba(216,255,115,0)");
    gradient.addColorStop(1, "rgba(216,255,115,.055)");
    ctx.fillStyle = gradient; ctx.fillRect(nowX - 45, top, 45, height - top - bottom);
  }

  function coherence() {
    if (!flies.length) return 0;
    let x = 0;
    let y = 0;
    flies.forEach(fly => { x += Math.cos(fly.phase); y += Math.sin(fly.phase); });
    return Math.sqrt(x * x + y * y) / flies.length;
  }

  function lockingFraction() {
    const stimulus = number("stimulus");
    const maximumPull = number("coupling") * responsePeak();
    if (!flies.length) return 0;
    return flies.filter(fly => Math.abs(stimulus - omegaFor(fly)) <= maximumPull + 1e-9).length / flies.length;
  }

  function updateMetrics() {
    const fraction = lockingFraction();
    const mismatch = number("stimulus") - number("omega");
    const maximumPull = number("coupling") * responsePeak();
    const meanCanLock = Math.abs(mismatch) <= maximumPull + 1e-9;
    ui.lockedMetric.textContent = `${Math.round(fraction * 100)}%`;
    ui.mismatchMetric.textContent = `${mismatch >= 0 ? "+" : "−"}${Math.abs(mismatch).toFixed(2)}`;
    ui.coherenceMetric.textContent = coherence().toFixed(2);
    ui.slipMetric.textContent = String(displayedSlips);
    const bottleneck = bottleneckInfo();
    ui.bottleneckReadout.classList.toggle("inside", bottleneck.inside && bottleneck.minimumDrift >= 0);
    ui.bottleneckReadout.classList.toggle("locked", bottleneck.minimumDrift < 0 || bottleneck.direction === 0);
    ui.bottleneckPhase.textContent = bottleneck.direction < 0 ? "φ = −π/2" : bottleneck.direction > 0 ? "φ = π/2" : "φ = —";
    if (bottleneck.direction === 0) {
      ui.bottleneckState.textContent = "NO MISMATCH";
      ui.bottleneckDrift.textContent = "the beacon and mean rhythm match";
    } else if (bottleneck.minimumDrift < -1e-3) {
      ui.bottleneckState.textContent = "LOCKED BEFORE SLIP";
      ui.bottleneckDrift.textContent = `locking margin · ${Math.abs(bottleneck.minimumDrift).toFixed(2)} rad/s`;
    } else if (Math.abs(bottleneck.minimumDrift) <= 1e-3) {
      ui.bottleneckState.textContent = "AT THE BOTTLENECK";
      ui.bottleneckDrift.textContent = "minimum drift · 0.00 rad/s";
    } else if (bottleneck.inside) {
      ui.bottleneckState.textContent = "IN THE BOTTLENECK";
      ui.bottleneckDrift.textContent = `minimum drift · ${bottleneck.minimumDrift.toFixed(2)} rad/s`;
    } else {
      ui.bottleneckState.textContent = "BOTTLENECK ZONE";
      ui.bottleneckDrift.textContent = `minimum drift · ${bottleneck.minimumDrift.toFixed(2)} rad/s`;
    }
    ui.verdictText.textContent = meanCanLock
      ? "The mean firefly can synchronize."
      : `The mean firefly cannot lock: the mismatch exceeds the maximum pull by ${(Math.abs(mismatch) - maximumPull).toFixed(2)}.`;

    ui.statusPill.classList.remove("slipping", "mixed");
    if (fraction >= .95) {
      ui.statusText.textContent = "LOCKING";
    } else if (fraction <= .05) {
      ui.statusText.textContent = "PHASE SLIPPING";
      ui.statusPill.classList.add("slipping");
    } else {
      ui.statusText.textContent = "PARTIAL LOCK";
      ui.statusPill.classList.add("mixed");
    }
  }

  function percentOnScale(value) {
    return Math.max(0, Math.min(100, (value - .35) / 1.3 * 100));
  }

  function updateReadouts() {
    Object.entries(outputs).forEach(([name, output]) => {
      output.value = number(name).toFixed(name === "coupling" ? 3 : 2);
      const input = controls[name];
      const fill = (number(name) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
      input.style.setProperty("--fill", `${fill}%`);
    });

    const stimulus = number("stimulus");
    const maximumPull = number("coupling") * responsePeak();
    const low = percentOnScale(stimulus - maximumPull);
    const high = percentOnScale(stimulus + maximumPull);
    ui.meterBand.style.left = `${low}%`;
    ui.meterBand.style.width = `${Math.max(0, high - low)}%`;
    ui.naturalMarker.style.left = `${percentOnScale(number("omega"))}%`;
    ui.stimulusMarker.style.left = `${percentOnScale(stimulus)}%`;
    updateMetrics();
  }

  function applyPreset(name) {
    const peak = responsePeak();
    const presets = {
      perfect: { omega: 1, stimulus: 1, coupling: .28, spread: .03 },
      edge: { omega: .86, stimulus: 1.26, coupling: .4 / peak, spread: 0 },
      slip: { omega: .82, stimulus: 1.3, coupling: .43 / peak, spread: 0 },
      mixed: { omega: 1, stimulus: 1.25, coupling: .28, spread: .22 }
    };
    const preset = presets[name];
    Object.entries(preset).forEach(([key, value]) => { controls[key].value = value; });
    document.querySelectorAll("[data-preset]").forEach(button => button.classList.toggle("active", button.dataset.preset === name));
    rebuildPopulation(true);
  }

  function animate(now) {
    const realDt = Math.min(.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (!paused) {
      let remaining = realDt * Number(controls.speed.value);
      const maxStep = 1 / 90;
      while (remaining > 0) {
        const dt = Math.min(maxStep, remaining);
        step(dt);
        remaining -= dt;
      }
    }
    drawField();
    drawPhaseCircle();
    drawTimeline();
    requestAnimationFrame(animate);
  }

  ["omega", "stimulus", "coupling", "spread"].forEach(name => {
    controls[name].addEventListener("input", () => {
      document.querySelectorAll("[data-preset]").forEach(button => button.classList.remove("active"));
      updateReadouts();
    });
  });
  document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => {
    responseMode = button.dataset.mode;
    document.querySelectorAll("[data-mode]").forEach(candidate => {
      const selected = candidate === button;
      candidate.classList.toggle("active", selected);
      candidate.setAttribute("aria-pressed", String(selected));
    });
    document.querySelector("#modelEquation").innerHTML = responseMode === "triangle"
      ? "θ̇<sub>i</sub> = ω<sub>i</sub> + A f(Θ − θ<sub>i</sub>)"
      : "θ̇<sub>i</sub> = ω<sub>i</sub> + A sin(Θ − θ<sub>i</sub>)";
    document.querySelector("#responseDefinition").textContent = responseMode === "triangle"
      ? "f(φ)=φ on [−π/2, π/2] · f(φ)=π−φ on [π/2, 3π/2] · periodic"
      : "sin(φ) ranges from −1 to +1";
    document.querySelector("#thresholdEquation").innerHTML = responseMode === "triangle"
      ? "| Ω − ω<sub>i</sub> | <span>≤</span> Aπ/2"
      : "| Ω − ω<sub>i</sub> | <span>≤</span> A";
    document.querySelector("#modeDescription").textContent = responseMode === "triangle"
      ? "Piecewise linear response · maximum pull = Aπ/2"
      : "Smooth response · maximum pull = A";
    document.querySelector("#edgePresetFormula").textContent = responseMode === "triangle"
      ? "|Ω − ω| = Aπ/2"
      : "|Ω − ω| = A";
    document.querySelector("#slipPresetFormula").textContent = responseMode === "triangle"
      ? "|Ω − ω| > Aπ/2"
      : "|Ω − ω| > A";
    document.querySelectorAll("[data-preset]").forEach(preset => preset.classList.remove("active"));
    rebuildPopulation(true);
  }));
  controls.population.addEventListener("change", () => rebuildPopulation(false));
  controls.speed.addEventListener("change", updateReadouts);
  ui.resetButton.addEventListener("click", () => rebuildPopulation(true));
  ui.playButton.addEventListener("click", () => {
    paused = !paused;
    ui.playIcon.textContent = paused ? "▶" : "Ⅱ";
    ui.playText.textContent = paused ? "Resume the night" : "Pause the night";
  });
  document.querySelectorAll("[data-preset]").forEach(button => button.addEventListener("click", () => applyPreset(button.dataset.preset)));
  window.addEventListener("resize", () => {
    drawField(); drawPhaseCircle(); drawTimeline();
  });

  rebuildPopulation(true);
  requestAnimationFrame(animate);
})();
