# Nonlinear Dynamics — Strogatz Solving Club

A shared home for our explorations of Steven Strogatz's *Nonlinear Dynamics and
Chaos*: interactive simulations, worked solutions, and papers.

**[Open the club](https://ggmeshgg.github.io/Nonlinear_Dynamics/)**

| Project | Simulation | Paper |
| --- | --- | --- |
| Fireflies | [Interactive model](fireflies/) | [Triangle-wave solution](fireflies/paper/fireflies_triangle_wave_solution.pdf) |
| Gas the room | [Evacuation sandbox](gas-the-room/) | [Model and analysis](gas-the-room/paper/main-typst.pdf) |
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

The build compiles the TypeScript/Vite gas simulation with base
`/Nonlinear_Dynamics/gas-the-room/`, then assembles `dist/` with the root catalog,
the two standalone HTML projects, and their papers. `dist/` and dependencies are
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
