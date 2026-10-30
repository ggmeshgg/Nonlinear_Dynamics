# Phase Plane Lab

A general phase-plane explorer for 2D autonomous systems ẋ = f(x, y), ẏ = g(x, y).
Type the right-hand sides; everything else is derived from them.

Site: https://ggmeshgg.github.io/Nonlinear_Dynamics/phase-plane/

## What it computes

- **Parameters.** Every symbol other than the two variables becomes a slider.
- **Field and nullclines.** Direction field; ẋ = 0 and ẏ = 0 by marching squares.
- **Fixed points.** Newton's method seeded from the crossings of the two
  nullclines and from a grid over the window. Only points inside the window are
  listed and counted. Each is classified from the Jacobian (τ, Δ, τ² − 4Δ) and
  shown in the trace–determinant plane. Many Δ = 0 points along a line are
  reported as a curve of fixed points rather than listed.
- **Saddle manifolds.** Integrated from the eigenvectors, forward and backward.
- **Trajectories.** Click or drag. Adaptive Dormand–Prince RK45, bounded by
  step count and screen distance, not by elapsed time, so slow systems are
  followed to the end. For divergence-free (Hamiltonian) systems the symplectic
  implicit midpoint rule keeps closed orbits closed. A trajectory is snapped
  shut on returning to its start only when orbits are known to be closed curves
  (Hamiltonian, or conserved E); otherwise a slow spiral is drawn as a spiral.
- **Structure.** div f is differentiated symbolically (Compute Engine) and
  checked for identical zero, or zero at the current parameter values; finite
  differences are the fallback when no closed form exists. The badge says which.
  Hamiltonian systems get H contours built by line integration. Time-reversal
  symmetry is tested numerically. A linear center is called a nonlinear center
  only when one of these, or a conserved E with an extremum there, justifies it.
- **E field.** Optional. Checks dE/dt = ∇E·f numerically: conserved → level sets;
  dE/dt ≤ 0 → Lyapunov candidate; otherwise a tint shows the sign of dE/dt.
- **Equation forms.** ẋ, ẏ; a single second-order equation ẍ = …; or polar
  ṙ, θ̇, converted with ẋ = ṙ cos θ − r θ̇ sin θ, ẏ = ṙ sin θ + r θ̇ cos θ and
  plotted in the x, y plane.
- **Bifurcation diagram** (key B). Sweeps one parameter over its slider range.
  Fixed points are found at 241 values and linked into branches (solid stable,
  dashed unstable, dotted saddle). Markers use the classifier's labels, not raw
  signs, so a centre branch (τ = 0 up to rounding) gets no markers: H where a
  branch goes stable → unstable with Δ > 0 (Hopf), BP where Δ changes sign along
  a branch or where branches meet or cross (transcritical, pitchfork), F where a
  branch ends with nothing on the other side (fold). Stable limit cycles come
  from long forward integration: the tail must be periodic, then one exact
  return through a Poincaré section is taken and points displaced to either side
  must come back closer (return-map multiplier below 0.9). A centre's family
  returns to itself and is rejected; cycle searching is skipped altogether when
  the system is Hamiltonian or E is conserved. Cycle max/min are plotted. In
  polar form with ṙ independent of θ, cycle radii are the roots of ṙ, provided
  θ̇ keeps one sign on that circle (otherwise it is an invariant circle carrying
  fixed points, not a cycle); unstable cycles are shown too. Dragging in the
  diagram sets the parameter.
- **Reaction network.** For polynomial systems, the mass-action network that
  produces the equations, when one exists (Hárs–Tóth: no negative term in ẋ
  without x, likewise for y).

The URL holds the full state, so a link reproduces the view.

## Assumptions and limits

Apart from the symbolic divergence, checks are numerical and sampled in the
visible window. Fixed points outside the window are not listed, and the
bifurcation diagram covers only what the window shows. Newton from a finite set
of seeds has no completeness guarantee for arbitrary expressions, though
nullcline crossings cover everything visible at pixel resolution.
Integration-based cycles can be missed close to a Hopf point, where the
multiplier is near 1, and unstable cycles are found only in the polar case. In
polar form with θ̇ depending on θ the field is not C¹ at the origin; the origin is
then classified by the sign of ṙ, without eigenvalues. Reaction-network signs
use the current slider values.

## Code and tests

`core.js` holds the mathematics: parsing, fixed points and their classification,
integrators, contours, structure checks, reaction networks, limit cycles and
the bifurcation sweep. `index.html` holds the interface and drawing and imports
`core.js`. The Compute Engine is imported by package name: an import map in
`index.html` points it at jsDelivr, and in Node it comes from `node_modules`.

`test/core.test.js` checks known answers, each from the analysis of a system
rather than from the program's own output: equilibria and their types, which
systems are Hamiltonian or reversible, Van der Pol's cycle (amplitude 2.01,
period 6.663 at μ = 1), the √μ Hopf branch, fold, branch and Hopf points at
their exact parameter values, no limit cycles in conservative systems. A change
to the mathematics comes with a test of this kind.

```sh
npm ci
npm test
```

## Running

Serve the folder over HTTP: `index.html` loads `core.js` as a module, which
browsers refuse from `file://`. From the repository root, `npm run build` and
`npm run preview` serve the whole site. MathLive and the Compute Engine load
from jsDelivr, so an internet connection is needed.
