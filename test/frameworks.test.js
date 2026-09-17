import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { detectFrameworks } from '../src/frameworks.js';
import { componentRecipe, inspectComponent } from '../src/components.js';
import { inspectFrontend } from '../src/frontend.js';
import { WorkspaceTools } from '../src/tools.js';
const packages = { react: 'react', vue: 'vue', angular: '@angular/core', svelte: 'svelte' };
test('four framework detection and 20 native starters use distinct file formats', () => {
  assert.deepEqual(detectFrameworks({ react: '^19', vue: '^3', '@angular/core': '^20', svelte: '^5' }).map(f => f.id), ['react', 'vue', 'angular', 'svelte']);
  for (const [framework, ext] of Object.entries({ react: '.jsx', vue: '.vue', angular: '.ts', svelte: '.svelte' })) {
    assert.equal(componentRecipe(framework).components.length, 5);
    for (const component of componentRecipe(framework).components) assert.equal(componentRecipe(framework, component).extension, ext);
  }
});
test('project detection and CLI generation honor framework and reject mismatches/old Svelte', async t => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oscode-frameworks-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const tools = new WorkspaceTools(root);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('OSCODE_')));
  const cli = (...args) => promisify(execFile)(process.execPath, [path.resolve('bin/oscode.js'), '--cwd', root, ...args], { env });
  for (const [framework, pkg] of Object.entries(packages)) {
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { [pkg]: framework === 'vue' ? '^3.5' : framework === 'svelte' ? '^5' : '^20' } }));
    const inspection = JSON.parse(await inspectFrontend(tools));
    assert.equal(inspection.frameworks[0].id, framework);
    const recipe = componentRecipe(framework, 'button');
    await cli('--component', `${framework}/button`, '--output', framework + recipe.extension, '--yes');
    assert.equal(await fs.readFile(path.join(root, framework + recipe.extension), 'utf8'), recipe.code);
    if (framework !== 'react') await assert.rejects(cli('--component', 'mui/button', '--output', 'wrong.jsx', '--yes'), e => /incompatible/.test(e.stdout));
  }
  await fs.writeFile(path.join(root, 'package.json'), '{"dependencies":{"svelte":"^4.0.0"}}');
  assert.equal(JSON.parse(await inspectComponent(tools, { library: 'svelte', component: 'button' })).compatible, false);
  await assert.rejects(cli('--component', 'svelte/button', '--output', 'old.svelte', '--yes'));
  await assert.rejects(cli('--component', 'svelte/button', '--output', 'plan.svelte', '--plan', '--yes'));
});
