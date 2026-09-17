import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { WorkspaceTools } from '../src/tools.js';
import { inspectTokens, inspectImpact, storyRecipe } from '../src/frontend-quality.js';
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oscode-quality-')));
  t.after(() => fs.rm(root, { recursive: true, force: true })); return root;
}
test('Tailwind analysis finds exact token candidates and preserves variable references', async t => {
  const root = await fixture(t), tools = new WorkspaceTools(root);
  await fs.writeFile(path.join(root, 'package.json'), '{"devDependencies":{"tailwindcss":"^4.0.0"}}');
  await fs.writeFile(path.join(root, 'theme.css'), '@theme { --color-brand: #123456; --spacing-card: 24px; }');
  await fs.writeFile(path.join(root, 'Button.tsx'), '<button className="bg-[#123456] p-[24px] text-[var(--label)]" />');
  const report = JSON.parse(await inspectTokens(tools));
  assert.equal(report.findings.length, 2); assert.deepEqual(report.findings[0].tokenCandidates, ['--color-brand']);
  assert.deepEqual(report.findings[1].tokenCandidates, ['--spacing-card']);
  assert.match(report.tailwindDeclared, /4/);
  await assert.rejects(inspectTokens(tools, '..'));
});
test('AST impact resolves root aliases, re-exports and dynamic imports without comment false positives', async t => {
  const root = await fixture(t), tools = new WorkspaceTools(root);
  await fs.mkdir(path.join(root, 'src'));
  await fs.writeFile(path.join(root, 'tsconfig.json'), '{// config\n"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}');
  const files = { 'Button.tsx': 'export default () => null;', 'index.ts': "export { default as Button } from './Button';", 'Page.tsx': "import { Button } from '@/index';", 'Page.test.ts': "import './Page';", 'lazy.ts': "const load = () => import('./Button');", 'comment.ts': "// import Button from './Button'" };
  for (const [name, code] of Object.entries(files)) await fs.writeFile(path.join(root, 'src', name), code);
  const result = JSON.parse(await inspectImpact(tools, 'src/Button.tsx'));
  assert.equal(result.partial, false); assert.equal(result.totalAffected, 4);
  assert.deepEqual(result.testCandidates, ['src/Page.test.ts']);
  assert.ok(!result.affectedFiles.includes('src/comment.ts'));
});
test('Story recipe uses explicit states, optional role assertions and a colocated output', async t => {
  const root = await fixture(t), tools = new WorkspaceTools(root);
  await fs.writeFile(path.join(root, 'Button.tsx'), 'export default function Button() { return <button>Save</button>; }');
  await fs.writeFile(path.join(root, 'package.json'), '{"devDependencies":{"storybook":"^10.0.0"}}');
  await fs.writeFile(path.join(root, 'states.json'), '{"Default":{},"Loading":{"loading":true}}');
  const recipe = JSON.parse(await storyRecipe(tools, { path: 'Button.tsx', states: 'states.json', role: 'button', name: 'Save' }));
  assert.equal(recipe.output, 'Button.stories.jsx'); assert.match(recipe.code, /storybook\/test/); assert.match(recipe.code, /toBeVisible/); assert.match(recipe.code, /export const Loading/);
  await fs.writeFile(path.join(root, 'states.json'), '{"bad-name":{}}');
  await assert.rejects(storyRecipe(tools, { path: 'Button.tsx', states: 'states.json' }), /capitalized/);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('OSCODE_')));
  const cli = args => promisify(execFile)(process.execPath, [path.resolve('bin/oscode.js'), '--cwd', root, ...args], { env });
  await cli(['--story', 'Button.tsx', '--output', 'Button.stories.jsx', '--yes']);
  assert.match(await fs.readFile(path.join(root, 'Button.stories.jsx'), 'utf8'), /import Component/);
  await assert.rejects(cli(['--story', 'Button.tsx', '--output', 'Elsewhere.jsx', '--yes']), e => /Colocated/.test(e.stdout));
  await assert.rejects(cli(['--story', 'Button.tsx', '--output', 'Button.stories.jsx', '--plan', '--yes']), e => /Plan mode/.test(e.stdout));
});
