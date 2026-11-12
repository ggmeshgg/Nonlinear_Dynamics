#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Strogatz 7.2.19(d), Rinaldi et al. (2013): reproducible numerical figures.

Run: python strogatz_7_2_19_reproduce.py
Requires: numpy, scipy, matplotlib.
Creates three PNG plots and prints equilibria / eigenvalues / Scarlett's peak.
Variables follow STROGATZ: R = Rhett's love for Scarlett (horizontal axis),
S = Scarlett's love for Rhett (vertical axis).
Paper uses x1 = S (horizontal) and x2 = R (vertical): the axes are swapped.
"""
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp
from scipy.optimize import root, minimize_scalar

OUT = Path(__file__).resolve().parent
A_S, A_R, K = 1.2, 1.0, 15.0

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 11,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "figure.dpi": 120,
    "savefig.dpi": 210,
})


def field(t, z):
    """dR/dt, dS/dt, for z=(R,S); also supports array inputs."""
    R, S = z
    return np.array([
        -R + A_S + K*S*np.exp(-S),
        -S + A_R + K*R*np.exp(-R),
    ])


def jacobian(z):
    R, S = z
    return np.array([
        [-1., K*np.exp(-S)*(1-S)],
        [K*np.exp(-R)*(1-R), -1.],
    ])


def fixed_points():
    points = []
    for x in np.linspace(0, 8, 13):
        for y in np.linspace(0, 8, 13):
            sol = root(lambda z: field(0, z), [x, y], tol=1e-12)
            if (np.linalg.norm(field(0, sol.x)) < 1e-9
                and np.min(sol.x) >= -1e-9
                and all(np.linalg.norm(sol.x - q) > 1e-6 for q in points)):
                points.append(sol.x)
    points.sort(key=lambda q: q[0])
    return points


def stable_separatrix(saddle):
    """Trace the two branches of the saddle's stable manifold backward in time."""
    lam, vec = np.linalg.eig(jacobian(saddle))
    v = np.real(vec[:, np.argmin(np.real(lam))])
    v = v / np.linalg.norm(v)
    branches = []
    def exit_view(t, z):
        """Stop backward integration at the edge of the plotting window."""
        return min(z[0], z[1], 8-z[0], 8-z[1])
    exit_view.terminal = True
    exit_view.direction = 0
    for sgn in [-1, 1]:
        initial = saddle + sgn*1e-5*v
        sol = solve_ivp(field, (0, -12), initial, max_step=0.015,
                        rtol=1e-10, atol=1e-12, events=exit_view)
        pts = sol.y.T
        # keep only points inside the displayed first quadrant
        good = ((pts[:,0]>=0) & (pts[:,0]<=8)
                & (pts[:,1]>=0) & (pts[:,1]<=8))
        branches.append(pts[good])
    return branches


def draw_reaction_curve():
    q = np.linspace(0, 7, 800)
    response = K*q*np.exp(-q)
    fig, ax = plt.subplots(figsize=(8.9, 4.6))
    ax.plot(q, response, lw=3, color="#2563eb", label=r"$F(q)=15q e^{-q}$")
    ax.axvline(1, lw=1.7, ls="--", color="#d97706")
    ax.scatter([1], [K/np.e], color="#d97706", s=48, zorder=3)
    ax.annotate("Максимум при q = 1", (1, K/np.e), (1.7, 5.25),
                arrowprops=dict(arrowstyle="->", color="#d97706"), fontsize=11)
    ax.set(xlabel="Любовь партнёра, q", ylabel="Положительный вклад в скорость изменения чувств",
           title="Немонотонная реакция на любовь партнёра")
    ax.grid(alpha=.2)
    ax.legend(loc="upper right")
    fig.tight_layout()
    fig.savefig(OUT / "strogatz_7_2_19_reaction.png", bbox_inches="tight")
    plt.close(fig)


def draw_phase(points, sol):
    fig, ax = plt.subplots(figsize=(9.0, 8.25))
    xx, yy = np.meshgrid(np.linspace(0, 8, 49), np.linspace(0, 8, 49))
    uu, vv = field(0, [xx, yy])
    speed = np.hypot(uu, vv)
    ax.streamplot(xx, yy, uu, vv, color="#a9b5c3", linewidth=0.6,
                  density=.87, arrowsize=.7, zorder=1)
    q = np.linspace(0, 8, 1100)
    ax.plot(A_S+K*q*np.exp(-q), q, color="#b45309", lw=2, ls="--",
            label="Нульклина: R' = 0", zorder=3)
    ax.plot(q, A_R+K*q*np.exp(-q), color="#0d9488", lw=2, ls=(0,(2,2)),
            label="Нульклина: S' = 0", zorder=3)
    saddle = next(p for p in points if np.linalg.det(jacobian(p)) < 0)
    for j, branch in enumerate(stable_separatrix(saddle)):
        if len(branch) > 1:
            ax.plot(branch[:,0], branch[:,1], color="#7c3aed", lw=1.8, ls="-.",
                    label="Сепаратриса (уст. многообразие седла)" if j == 0 else None,
                    zorder=4)
    ax.plot(sol.y[0], sol.y[1], lw=3.4, color="#dc2626",
            label="Решение из (0, 0)", zorder=6)
    ax.plot([0], [0], "o", ms=7, color="#111827", zorder=7)
    ax.annotate("Первая встреча", (0,0), (0.45,.5),
                fontsize=10, arrowprops=dict(arrowstyle="->", lw=.9))
    for p in points:
        r,s=p
        if np.linalg.det(jacobian(p))<0:
            marker, color, label = "X", "#7c3aed", "седло"
            offset = (-1.5,.68)
        else:
            marker, color, label = "D", "#16a34a", "уст. узел"
            offset = (.28,-.75) if r<3 else (-2.18,.55)
        ax.scatter([r],[s],marker=marker,s=105,c=color,zorder=8)
        ax.annotate(f"{label}\n({r:.3f}; {s:.3f})",(r,s),(r+offset[0],s+offset[1]),
                    fontsize=9, arrowprops=dict(arrowstyle="-",lw=.8, color=color))
    ax.set(xlim=(0,8),ylim=(0,8),xlabel="R — любовь Ретта к Скарлетт",
           ylabel="S — любовь Скарлетт к Ретту",
           title="Фазовый портрет: A_S = 1.2, A_R = 1, k = 15")
    ax.set_aspect("equal",adjustable="box")
    ax.grid(alpha=.13)
    ax.legend(loc="upper right",fontsize=8.5,framealpha=.94)
    fig.tight_layout()
    fig.savefig(OUT / "strogatz_7_2_19_phase.png", bbox_inches="tight")
    plt.close(fig)


def draw_timeline(sol, tpeak, peak):
    fig, ax = plt.subplots(figsize=(9.4, 5.1))
    t = np.linspace(0, 18, 2200)
    R,S=sol.sol(t)
    ax.plot(t,R, color="#2563eb",lw=2.7,label="R(t): любовь Ретта")
    ax.plot(t,S, color="#e11d48",lw=2.7,label="S(t): любовь Скарлетт")
    ax.axvline(tpeak, ls="--", lw=1.4, color="#d97706")
    ax.scatter([tpeak],[peak[1]], c="#d97706",s=48,zorder=6)
    ax.annotate(f"Пик любви Скарлетт\nt ≈ {tpeak:.2f}; S ≈ {peak[1]:.2f}",
                (tpeak,peak[1]), (4.0,3.25), fontsize=10,
                arrowprops=dict(arrowstyle="->",color="#d97706"))
    ax.set(xlabel="Условное время t (не календарные годы)",
           ylabel="Положительная вовлечённость",
           title="Траектория любви из начального состояния R(0) = S(0) = 0",
           xlim=(0,18),ylim=(0,7.25))
    ax.grid(alpha=.2)
    ax.legend(loc="upper left")
    fig.tight_layout()
    fig.savefig(OUT / "strogatz_7_2_19_timeline.png", bbox_inches="tight")
    plt.close(fig)


def main():
    points = fixed_points()
    print("Параметры: A_S=1.2, A_R=1.0, k=15.0")
    for p in points:
        eig = np.linalg.eigvals(jacobian(p))
        print(f"(R,S) = ({p[0]:.8f}, {p[1]:.8f}); eigenvalues = {eig}")
    sol = solve_ivp(field, (0, 25), [0, 0], dense_output=True,
                    max_step=.025, rtol=1e-10, atol=1e-12)
    peak_res = minimize_scalar(lambda t: -sol.sol(t)[1], bounds=(0, 8),
                               method="bounded", options={"xatol":1e-10})
    tpeak=float(peak_res.x)
    peak=sol.sol(tpeak)
    print(f"Peak S: t={tpeak:.8f}, R={peak[0]:.8f}, S={peak[1]:.8f}")
    print(f"State t=25: R={sol.y[0,-1]:.8f}, S={sol.y[1,-1]:.8f}")
    draw_reaction_curve()
    draw_phase(points, sol)
    draw_timeline(sol, tpeak, peak)
    print("PNG saved to:", OUT)


if __name__ == "__main__":
    main()
