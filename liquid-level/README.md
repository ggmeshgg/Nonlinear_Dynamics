# Drip lab

A static, dependency-free browser simulation of a gravity-fed irrigation tank and integral windup. Five guided experiments progress from constant inflow to proportional control, integral control, actuator saturation, and recovery after windup. There are no anti-windup presets and no actuator lag.

## Run locally

Open `index.html` directly in a browser, or serve this directory:

```sh
python3 -m http.server 8080
```

Then open http://localhost:8080. No installation, bundler, API, or account is required. All fonts and assets are local or embedded. The application works offline.

## Publish on GitHub Pages

1. Create a GitHub repository and put the contents of this directory at its root. Include the empty `.nojekyll` file.
2. In the repository, open **Settings → Pages**.
3. Choose **Deploy from a branch**, select your branch (usually `main`) and **/ (root)**, then save.
4. Wait for GitHub's Pages deployment to finish and open the URL shown there.

Relative asset paths support both a root domain and `https://USER.github.io/REPOSITORY/`. No build step or environment secrets are needed.

## Use the lab

- The top behavior presets load a stable node, stable spiral, center, unstable spiral, unstable node, or saddle. Each starts at `(1.03, 0.6)` with no second-branch disturbance and opens a local phase-plane view around equilibrium. Uncheck **Near equilibrium** to see the complete trajectory after it escapes that window. Pump saturation can change behavior away from the equilibrium.
- The center is an intentionally idealized outlet-compensating controller, `uc = c sqrt(h) + z - 0.6`. Its small unsaturated orbits are closed; it is not a claim that zero linear damping alone guarantees a nonlinear center. Eigenvalues describe the supplied preset at `(1, 0.6)`; editing its controller or relevant settings marks the classification as modified.
- Choose an experiment; each loads a reproducible starting configuration. Experiments 4 and 5 begin paused at the relevant failure stage.
- Play, pause, rewind, drag the timeline, or click/drag a time plot. Event buttons jump to branch opening, closing, upward target crossing, and the highest recorded post-closing level.
- Every time plot shows the full simulated run. Bright phase-plane paths show elapsed time; faint paths show the remainder. The current field switches at opening and closing.
- Click the flow legend labels to hide or show a series. Hiding the large requested flow rescales that chart so delivered and outlet flow are easier to inspect.
- Adjust gains, capacity, branch strength, timing, and initial conditions. Editing a parameter recomputes the run and pauses playback at the current time. Changing the integral gain in the integral preset also resets z₀ to the nominal equilibrium value; initial conditions remain editable afterward.
- Try custom arithmetic expressions for the command and memory derivative. The parser supports only the documented math operations, not JavaScript. Formulas are evaluated locally.

## Model and interpretation

Normalized unit tank area, target h★ = 1, baseline coefficient c₀ = 0.6:

```
e = 1 - h
u = clamp(uc, 0, umax)
dh/dt = u - c(t) sqrt(h)
dz/dt = selected controller rule
```

Branch 1 drains `0.6 sqrt(h)`. While the second branch is open it adds `(c1 - 0.6) sqrt(h)`. Branch opening/closing is an external time schedule, so this is a switched, two-state system. The water level and controller memory stay continuous; outlet flow jumps at a switch. The controlled quantity is level, which maintains the first branch's drip rate at nominal balance. The animation is schematic, not a droplet-scale fluid model.

Constant and proportional presets have `dz/dt = 0`, leaving the second coordinate inactive. The proportional preset uses nominal feedforward `0.6 + KP * e`; the integral preset uses `KI * z` with `dz/dt = e`.

The field arrows display direction, not speed. Dashed white contours mark `dh/dt = 0`. Amber-tinted areas indicate upper actuator saturation. For the integral preset, the exact upper boundary is `z = umax / KI`; custom-controller shading and zero contours are sampled approximations. The error-area plot represents memory increments only when `dz/dt = e`.

There is no finite tank-capacity or overflow model. The schematic tank rescales to fit the computed run. There are no thermal states, pump dynamics, pressure-compensated emitters, or anti-windup corrections.

### Numerical method

Fixed-step RK4 with default step 0.01, split at both disturbance transitions. All stages within a step use the same discharge coefficient. Level evaluations and completed steps are constrained to h ≥ 0; behavior extremely close to dry-out is approximate. Traces sample at approximately 0.05 time units. Replay interpolates state and reevaluates the instantaneous controller and outflow. The displayed saturation duration and peak are sample-based (about 0.05 time-unit resolution); “≥” means the run ended before saturation cleared.

The simulation spans 70 normalized time units. Recovery metrics are measured from branch closing to the end of that window, not to infinite time. Custom formulas that become non-finite or leave supported state ranges are rejected; the last valid run is preserved.

## Files and checks

- `index.html`: accessible page structure and tank schematic.
- `styles.css`: responsive styling.
- `model.js`: pure dynamics, integrator, and arithmetic parser.
- `app.js`: lessons, controls, replay, and SVG plots.
- `model.test.cjs`: physics, integration, and parser checks.

Run the model checks with Node 18 or newer:

```sh
node --test model.test.cjs
```

Browsers with `document.modelContext` may expose three optional tools to read the run, select an experiment, and seek the replay. Ordinary browser use does not depend on that API.


## Club publication

Recovered from the September 24, 2026 water-tank controller chat. Original simulation assets are retained.

[Local regime map (Russian PDF)](paper/local-regime-map.pdf), its Typst source, plotting script and figures are included in `paper/`.

See the [paper source instructions](paper/README.md) for rebuilding the PDF with Typst or regenerating its figures with Python.
