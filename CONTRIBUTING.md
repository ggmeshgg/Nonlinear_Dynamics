# Add your exploration

Bring a Strogatz problem, a simulation, or a worked solution. Keep each project
in an independent folder so it is easy to understand and run on its own.

1. Create a short, lowercase project folder such as `coupled-pendulums/`.
   Add an `index.html` entry point, a `README.md` explaining the model and how to
   run it, and any scripts or assets it needs. Put written work in `paper/`.
2. Use relative links for static assets and papers. Every project is served
   under `/Nonlinear_Dynamics/<project-name>/` on GitHub Pages. For a compiled
   app, pass that path to its bundler. Avoid absolute `/assets/` or `/paper/`
   links, which point outside the project on Pages.
3. Add a card to the `.project-grid` in the root `index.html`: a short title,
   useful description, simulation link, and paper link if available. Keep labels
   readable, supply accessible names for illustration links, and use local
   assets or inline SVG instead of external fonts or CDNs.
4. Update `scripts/build.mjs`. Add a static project to the copy list; for a
   project with its own build step, install its locked dependencies in the
   workflow, build it with the correct URL base, and copy its output plus papers
   into `dist/<project-name>/`. Keep dependencies and build output ignored.
   Update the README catalog and workflow cache paths if needed.
5. Run `npm run setup`, `npm run build`, and `npm run preview`. Open the catalog
   and your project at `http://127.0.0.1:4173/Nonlinear_Dynamics/`. Check small
   screens, keyboard controls, asset loading, and every paper link.
6. Submit a pull request explaining the question, the model, and what you
   checked. Cite the relevant exercise or chapter when applicable; distinguish
   exploratory extensions from textbook solutions.

Keep the mathematics and assumptions close to the experiment. A good project
makes it clear what its controls mean, what behavior to look for, and where the
model stops applying.
