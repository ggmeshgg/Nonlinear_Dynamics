#set page(paper: "a4", margin: (x: 22mm, y: 19mm), numbering: "1")
#set text(font: "Libertinus Serif", size: 10.5pt, fill: rgb("#20242b"))
#set par(justify: true, leading: 0.68em)
#set heading(numbering: "1.", outlined: true)
#show heading.where(level: 1): it => block(above: 0pt, below: 10pt)[
  #set text(size: 19pt, weight: "bold", fill: rgb("#173b67"))
  #it.body
]
#show heading.where(level: 2): it => block(above: 14pt, below: 5pt)[
  #set text(size: 13pt, weight: "bold", fill: rgb("#24538a"))
  #it.body
]
#show math.equation.where(block: true): set block(above: 7pt, below: 7pt)

#let blue = rgb("#24538a")
#let pale = rgb("#edf4fb")
#let answer(body) = block(
  fill: pale,
  stroke: (left: 3pt + blue),
  inset: (x: 10pt, y: 8pt),
  radius: (right: 3pt),
  width: 100%,
  body,
)

= Fireflies with a Triangle-Wave Response

#text(fill: rgb("#55606d"), style: "italic")[Complete solution to Exercise 4.5.1]

We are given

$ dot(Theta) = Omega, quad dot(theta) = omega + A f(Theta-theta), $

where $A>0$, and $f$ is the $2pi$-periodic triangle wave

$
f(phi) = cases(
  phi, & -pi/2 <= phi <= pi/2,
  pi-phi, & pi/2 <= phi <= 3pi/2.
)
$

Define the phase difference and frequency mismatch by

$ phi = Theta-theta, quad delta = Omega-omega. $

Subtracting the two phase equations gives the single autonomous equation

$
dot(phi) = delta - A f(phi).
$

Everything below follows from this phase-difference equation.

== (a) Graph of $f(phi)$

On $[-pi/2,pi/2]$, the graph is the line $f(phi)=phi$, with slope $+1$. On $[pi/2,3pi/2]$, it is the line $f(phi)=pi-phi$, with slope $-1$. Periodic repetition produces a triangle wave of period $2pi$.

#figure(
  image("triangle-wave.svg", width: 100%),
  caption: [The $2pi$-periodic triangle wave. Its maximum is $pi/2$, and its minimum is $-pi/2$.],
)

#answer[
  $-pi/2 <= f(phi) <= pi/2, quad "period" = 2pi.$
]

== (b) Range of entrainment

Entrainment means that the phases are locked: $phi$ is constant. Therefore $dot(phi)=0$, so

$
0 = delta-A f(phi^*) quad arrow.r quad f(phi^*) = delta/A.
$

Such a fixed point exists exactly when $delta/A$ lies in the range of $f$. Since the range is $[-pi/2,pi/2]$,

$
-pi/2 <= delta/A <= pi/2.
$

Using $delta=Omega-omega$, the entrainment condition is

#answer[
  $abs(Omega-omega) <= A pi/2,$
  or equivalently
  $omega-A pi/2 <= Omega <= omega+A pi/2.$
]

At equality, the fixed point sits at a corner of the triangle wave. Just outside this interval, the phase slips continuously; the drift period found in part (d) diverges as the boundary is approached.

== (c) Locked phase difference $phi^*$

The fixed-point condition is $f(phi^*)=delta/A$. There are generally two solutions per period: one on each side of the triangle.

On the rising branch, $f(phi)=phi$, hence

$ phi_s^* = delta/A = (Omega-omega)/A, quad -pi/2 <= phi_s^* <= pi/2. $

To determine stability, differentiate the right-hand side of the phase equation. Away from the corners,

$
dif/(dif phi) (delta-A f(phi)) = -A f'(phi).
$

On the rising branch $f'=1$, so the derivative is $-A<0$: this fixed point is stable. Thus the physically observed locked phase difference is

#answer[
  $phi^* = (Omega-omega)/A mod 2pi, quad -pi/2 <= phi^* <= pi/2.$
]

For completeness, the falling branch gives

$ phi_u^* = pi-delta/A mod 2pi. $

There $f'=-1$, so the derivative is $+A>0$; this second fixed point is unstable. At the two endpoint cases, the stable and unstable solutions meet at a corner.

== (d) Drift period $T_"drift"$

Outside the entrainment range,

$ abs(delta) > A pi/2, $

so $dot(phi)$ never vanishes. The phase difference moves through one full $2pi$ cycle during each phase slip. First suppose $delta>A pi/2$, so $phi$ increases. The elapsed time is

$
T_"drift"
= integral_(-pi/2)^(3pi/2) 1/(delta-A f(phi)) dif phi.
$

Split the integral at $pi/2$ and insert the two linear formulas for $f$:

$
T_"drift"
= integral_(-pi/2)^(pi/2) 1/(delta-A phi) dif phi
  + integral_(pi/2)^(3pi/2) 1/(delta-A(pi-phi)) dif phi.
$

For the first piece,

$
I_1 = [-1/A ln(delta-A phi)]_(-pi/2)^(pi/2)
= 1/A ln((delta+A pi/2)/(delta-A pi/2)).
$

In the second piece, set $u=pi-phi$. Its limits become $pi/2$ and $-pi/2$, and reversing them gives exactly the same integral. Therefore $I_2=I_1$, so

$
T_"drift" = 2/A ln((delta+A pi/2)/(delta-A pi/2)),
quad delta>A pi/2.
$

If $delta<-A pi/2$, the phase moves in the opposite direction. The time is still positive and, by the odd symmetry of $f$, is obtained by replacing $delta$ with $abs(delta)$. Consequently,

#answer[
  $
    T_"drift" = 2/A ln(
      (abs(Omega-omega)+A pi/2)
      /
      (abs(Omega-omega)-A pi/2)
    ),
  $
  valid for $abs(Omega-omega)>A pi/2$.
]

As a check, $T_"drift" arrow.r infinity$ when the entrainment boundary is approached from outside. For a very large mismatch, $ln((D+a)/(D-a)) approx 2a/D$, with $D=abs(delta)$ and $a=A pi/2$; hence $T_"drift" approx 2pi/D$, the expected uncoupled result.
