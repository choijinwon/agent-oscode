import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { WorkspaceTools } from '../src/tools.js';
import { runTurn } from '../src/agent.js';
import { newSession } from '../src/session.js';
import { resolveConfig } from '../src/config.js';
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oscode-arch-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'shared')); await fs.mkdir(path.join(root, 'features'));
  await fs.writeFile(path.join(root, 'shared/Button.tsx'), "'use client';\nimport { feature } from '../features/account'; export const Button = feature;");
  await fs.writeFile(path.join(root, 'features/account.ts'), "import { Button } from '../shared/Button'; export const feature = Button;");
  return root;
}
test('architecture reports relative cycles, folder coupling and client directives as candidates', async t => {
  const root = await fixture(t), tools = new WorkspaceTools(root, { readOnly: true });
  const report = JSON.parse((await tools.execute('frontend_architecture', {})).content);
  assert.equal(report.scannedFiles, 2); assert.equal(report.relativeImportCycles.length, 1);
  assert.equal(report.sharedToFeatureCandidates.length, 1); assert.equal(report.clientBoundaries[0].file, 'shared/Button.tsx');
  assert.match(report.limitations, /Heuristic/);
  assert.equal((await tools.execute('frontend_architecture', { path: '..' })).is_error, true);
});
test('architecture scans are bounded and available during frontend planning', async t => {
  const root = await fixture(t), tools = new WorkspaceTools(root, { readOnly: true });
  for (let i = 0; i < 80; i++) await fs.writeFile(path.join(root, `file${i}.js`), '');
  const report = JSON.parse((await tools.execute('frontend_architecture', {})).content);
  assert.equal(report.scannedFiles, 60);
  let calls = 0;
  await runTurn({ session: newSession(root), prompt: 'Review architecture', config: resolveConfig({}, { agent: 'frontend', plan: true }, {}), tools, signal: new AbortController().signal,
    provider: { complete: async req => {
      assert.ok(req.tools.some(t => t.name === 'frontend_architecture')); assert.ok(req.tools.some(t => t.name === 'ui_component'));
      return { content: ++calls === 1 ? '' : 'Plan: verify dependencies before moving files.', calls: calls === 1 ? [{ id: 'a', name: 'frontend_architecture', input: {} }] : [], usage: { input: 10, output: 10, requests: 1 } };
    } } });
  assert.equal(calls, 2);
});
