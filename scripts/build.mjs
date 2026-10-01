import { cp, mkdir, rm, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
const base = (process.env.BASE_PATH || '/Nonlinear_Dynamics/').replace(/\/?$/, '/');
if (!base.startsWith('/') || base.includes('..')) {
  throw new Error('BASE_PATH must be an absolute URL path, such as /Nonlinear_Dynamics/.');
}

const gasBuild = spawnSync('npm', ['run', 'build', '--', '--base', `${base}gas-the-room/`], {
  cwd: resolve(root, 'gas-the-room'),
  stdio: 'inherit',
});
if (gasBuild.error) throw gasBuild.error;
if (gasBuild.status !== 0) process.exit(gasBuild.status || 1);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'styles.css', 'favicon.svg']) {
  await cp(resolve(root, file), resolve(output, file));
}
await cp(resolve(root, 'gas-the-room/dist'), resolve(output, 'gas-the-room'), { recursive: true });
await cp(resolve(root, 'gas-the-room/paper'), resolve(output, 'gas-the-room/paper'), { recursive: true });

for (const project of ['fireflies', 'liquid-level']) {
  const source = resolve(root, project);
  try {
    await access(source);
  } catch {
    console.warn(`Skipping ${project}: project folder is not present.`);
    continue;
  }
  await cp(source, resolve(output, project), {
    recursive: true,
    filter: (path) => !path.slice(source.length).split(/[\\/]/).some(
      (part) => part.startsWith('.') || ['node_modules', 'dist'].includes(part),
    ),
  });
}
await access(resolve(output, 'gas-the-room/paper/main-typst.pdf'));
console.log(`Club site built in dist/ for ${base}`);
