# Phase Plane Lab

A general phase-plane explorer for 2D autonomous systems ẋ = f(x, y), ẏ = g(x, y).
Type the right-hand sides; everything else is derived from them.

Site: https://ggmeshgg.github.io/Nonlinear_Dynamics/phase-plane/

## What it computes

- **Parameters.** Every symbol other than the two variables becomes a slider.
- **Field and nullclines.** Direction field; ẋ = 0 and ẏ = 0 by marching squares.
- **Fixed points.** Newton's method from a grid of seeds. Each is classified from
  the Jacobian (τ, Δ, τ² − 4Δ) and shown in the trace–determinant plane.
- **Saddle manifolds.** Integrated from the eigenvectors, forward and backward.
- **Trajectories.** Click or drag. Adaptive Dormand–Prince RK45; for
  divergence-free (Hamiltonian) systems the symplectic implicit midpoint rule
  keeps closed orbits closed.
- **Structure.** Detects div f = 0 (draws H contours, built by line integration)
  and time-reversal symmetry. A linear center is called a nonlinear center only
  when one of these, or a conserved E with an extremum there, justifies it.
- **E field.** Optional. Checks dE/dt = ∇E·f numerically: conserved → level sets;
  dE/dt ≤ 0 → Lyapunov candidate; otherwise a tint shows the sign of dE/dt.
- **Equation forms.** ẋ, ẏ; a single second-order equation ẍ = …; or polar
  ṙ, θ̇, converted with ẋ = ṙ cos θ − r θ̇ sin θ, ẏ = ṙ sin θ + r θ̇ cos θ and
  plotted in the x, y plane.
- **Bifurcation diagram** (key B). Sweeps one parameter over its slider range.
  Fixed points are found at 241 values and linked into branches (solid stable,
  dashed unstable, dotted saddle). Markers: H where τ changes sign with Δ > 0
  (Hopf), BP where Δ changes sign along a branch (transcritical or pitchfork),
  F where a branch ends inside the window (fold). Stable limit cycles come
  from long forward integration: the tail must be periodic and the mean
  divergence along it negative; their max/min are plotted. In polar form with
  ṙ independent of θ, cycle radii are the roots of ṙ, so unstable cycles are
  shown too. Dragging in the diagram sets the parameter.
- **Reaction network.** For polynomial systems, the mass-action network that
  produces the equations, when one exists (Hárs–Tóth: no negative term in ẋ
  without x, likewise for y).

The URL holds the full state, so a link reproduces the view.

## Assumptions and limits

All checks are numerical and sampled in the visible window. Fixed points outside
the window are not searched, and the bifurcation diagram covers only what the
window shows. Integration-based cycles can be missed close to a Hopf point,
where attraction is slow, and unstable cycles are found only in the polar case. Reaction-network signs use the current slider
values.

## Running

Open `index.html` in a browser. MathLive and the Cortex Compute Engine load from
jsDelivr, so an internet connection is needed.
