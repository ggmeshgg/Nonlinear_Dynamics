# Nonlinear Dynamics — Strogatz Solving Club

A shared home for our explorations of Steven Strogatz's *Nonlinear Dynamics and
Chaos*: interactive simulations, worked solutions, and papers.

**[Open the club](https://ggmeshgg.github.io/Nonlinear_Dynamics/)**

| Project | Simulation | Paper |
| --- | --- | --- |
| Strogatz 5.3.3–5.3.6 (Kirill, Russian) | [Presentation and phase portraits](strogatz-5.3.3-5.3.6/) | Solutions included on the page |
| Fireflies | [Interactive model](fireflies/) | [Triangle-wave solution](fireflies/paper/fireflies_triangle_wave_solution.pdf) |
| Gas the room | [Evacuation sandbox](gas-the-room/) | [Model and analysis](gas-the-room/paper/main-typst.pdf) |
| RLC circuit (Russian) | [Interactive lecture](rlc-interactive-lecture/) | [Source notes](rlc-interactive-lecture/docs/source-notes.md) |
| Liquid level | [Interactive model](liquid-level/) | [Local regime map](liquid-level/paper/local-regime-map.pdf) |

## Local build

Use Node.js 24 (the repository includes an asdf `.tool-versions` file).

```sh
npm run setup
npm run build
npm run preview
```

Open `http://127.0.0.1:4173/Nonlinear_Dynamics/`. The preview uses the same nested
URL as GitHub Pages, so simulation assets can be checked before publishing.

The build compiles the gas simulation and RLC lecture with base paths
`/Nonlinear_Dynamics/gas-the-room/` and `/Nonlinear_Dynamics/rlc-interactive-lecture/`,
then assembles `dist/` with the root catalog,
the standalone HTML projects and the RLC lecture, and their papers. `dist/` and dependencies are
ignored by Git. For another host path, set `BASE_PATH` for **both** build and
preview (for example, `BASE_PATH=/ npm run build`).

Each simulation can also be run independently. For the gas project, use
`npm --prefix gas-the-room run dev`; its standalone development configuration
stays in the project folder.

## Publishing

The GitHub Actions workflow in `.github/workflows/pages.yml` builds and publishes
the site on a push to `main`. In the repository's **Settings → Pages**, select
**GitHub Actions** as the build and deployment source. The workflow caches the
gas simulation's npm dependencies using its lockfile; only the deployment job
has permission to write Pages and request a deployment identity token.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) to add a problem, experiment, or worked solution.

## Imported project history

`gas-the-room/` was imported from
[ggmeshgg/gas-the-room](https://github.com/ggmeshgg/gas-the-room) using `git subtree
add` **without squashing**, at source commit
`feebc15aac04a2dd89cf3d05e9812cd8967d7971`. Its original commits remain part of
this repository's Git history, and its source, assets, and paper live together
under `gas-the-room/`. The original repository was not changed by the import.

`rlc-interactive-lecture/` was imported with its complete history from
[norff21-hash/rlc-interactive-lecture](https://github.com/norff21-hash/rlc-interactive-lecture)
at `c351f5eb27691f6f397e96daa36c1803b1e4b58a`. The club build sets its nested
Pages base path; the lecture includes a link back to the club index.
