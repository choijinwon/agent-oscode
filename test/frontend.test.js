import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { WorkspaceTools } from '../src/tools.js';
import { resolveConfig } from '../src/config.js';
import { runTurn } from '../src/agent.js';
import { newSession, saveSession, loadSession } from '../src/session.js';
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oscode-frontend-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'src'));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.0.0', dependencies: { next: '*', react: '*' }, devDependencies: { typescript: '*', vitest: '*' }, scripts: { build: 'touch forbidden', 'test:unit': 'vitest', secret: 'private' } }));
  await fs.writeFile(path.join(root, 'src/Button.tsx'), 'export const Button = () => <button>OK</button>');
  return root;
}
test('frontend inspection reports declared stack and safe command names without executing scripts', async t => {
  const root = await fixture(t), tools = new WorkspaceTools(root, { readOnly: true });
  const report = await tools.execute('frontend_inspect', {});
  assert.equal(report.is_error, false);
  const data = JSON.parse(report.content);
  assert.deepEqual(data.stack, ['next', 'react', 'typescript', 'vitest']);
  assert.equal(data.packageManager, 'pnpm');
  assert.equal(data.scripts[0].command, 'pnpm run build');
  assert.deepEqual(data.files.components, ['src/Button.tsx']);
  assert.doesNotMatch(report.content, /touch forbidden|private/);
  await assert.rejects(fs.stat(path.join(root, 'forbidden')));
});
test('inspection handles static sites, caps examples and excludes generated files', async t => {
  const root = await fixture(t); await fs.unlink(path.join(root, 'package.json'));
  await fs.mkdir(path.join(root, '.next')); await fs.writeFile(path.join(root, '.next/private.tsx'), 'generated');
  for (let i = 0; i < 30; i++) await fs.writeFile(path.join(root, `src/C${i}.tsx`), '');
  const result = await new WorkspaceTools(root).execute('frontend_inspect', {});
  const data = JSON.parse(result.content);
  assert.equal(data.files.components.length, 10); assert.match(data.warning, /No package.json/);
  assert.doesNotMatch(result.content, /private.tsx/);
});
test('inspection rejects escapes, escaping manifests and invalid JSON', async t => {
  const root = await fixture(t), tools = new WorkspaceTools(root);
  assert.equal((await tools.execute('frontend_inspect', { path: '..' })).is_error, true);
  await fs.unlink(path.join(root, 'package.json')); await fs.symlink('/etc/passwd', path.join(root, 'package.json'));
  // Non-git traversal ignores symlinks; direct resolution also rejects outside targets.
  assert.doesNotMatch((await tools.execute('frontend_inspect', {})).content, /root:.*:/);
  await fs.unlink(path.join(root, 'package.json')); await fs.writeFile(path.join(root, 'package.json'), '{');
  assert.equal((await tools.execute('frontend_inspect', {})).is_error, true);
});
test('agent config validates values and CLI overrides environment and project', () => {
  assert.equal(resolveConfig({ agent: 'frontend' }, {}, {}).agent, 'frontend');
  assert.equal(resolveConfig({ agent: 'frontend' }, { agent: 'general' }, { OSCODE_AGENT: 'frontend' }).agent, 'general');
  assert.throws(() => resolveConfig({}, { agent: 'invalid' }, {}), /agent/);
});
test('frontend planning exposes inspection, blocks shell and preserves specialization on apply', async t => {
  const root = await fixture(t), session = newSession(root), config = resolveConfig({}, { agent: 'frontend', plan: true }, {});
  const usage = { input: 50, output: 20, requests: 1, cacheRead: 0, cacheWrite: 0, estimated: 0 };
  let count = 0;
  await runTurn({ session, prompt: 'Improve button', config, tools: new WorkspaceTools(root, { approve: async () => true }), signal: new AbortController().signal, save: saveSession,
    provider: { complete: async req => {
      assert.match(req.system, /FRONTEND SPECIALIST/); assert.ok(req.tools.some(t => t.name === 'frontend_inspect')); assert.ok(!req.tools.some(t => t.name === 'shell'));
      return { usage, content: ++count === 1 ? '' : 'Plan: src/Button.tsx; verify keyboard focus.', calls: count === 1 ? [{ id: 'i', name: 'frontend_inspect', input: {} }, { id: 's', name: 'shell', input: { command: 'touch forbidden' } }] : [] };
    } } });
  assert.equal(count, 2); await assert.rejects(fs.stat(path.join(root, 'forbidden')));
  const loaded = await loadSession(root, session.id); assert.equal(loaded.agent, 'frontend'); assert.equal(loaded.plans[0].agent, 'frontend');
  await runTurn({ session: loaded, prompt: 'apply', executionPlan: loaded.plans[0], config: { ...config, agent: 'general', plan: false }, tools: new WorkspaceTools(root), signal: new AbortController().signal, provider: { complete: async req => { assert.match(req.system, /FRONTEND SPECIALIST/); return { usage, content: 'Done', calls: [] }; } } });
});
test('offline CLI inspection needs no credentials or model and general mode has no specialist overhead', async t => {
  const root = await fixture(t), env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('OSCODE_') && key !== 'ANTHROPIC_API_KEY'));
  const { stdout } = await promisify(execFile)(process.execPath, [path.resolve('bin/oscode.js'), '--cwd', root, '--inspect-frontend'], { env });
  assert.match(stdout, /pnpm run build/);
  await runTurn({ session: newSession(root), prompt: 'hello', config: resolveConfig({}, {}, {}), tools: new WorkspaceTools(root), signal: new AbortController().signal, provider: { complete: async req => {
    assert.doesNotMatch(req.system, /FRONTEND SPECIALIST/); assert.ok(!req.tools.some(t => t.name === 'frontend_inspect'));
    return { content: 'hello', calls: [], usage: { input: 10, output: 5, requests: 1 } };
  } } });
});
