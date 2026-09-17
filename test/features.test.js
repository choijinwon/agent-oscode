import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { readProjectConfig, resolveConfig, initConfig } from '../src/config.js';
import { Checkpoints } from '../src/checkpoints.js';
import { WorkspaceTools } from '../src/tools.js';
import { newSession, saveSession, loadSession } from '../src/session.js';
import { costEstimate, usageReport, beginRequest, finishRequest } from '../src/usage.js';
import { LoopGuard } from '../src/loop-guard.js';
import { runTurn } from '../src/agent.js';
import { compact, addUsage } from '../src/context.js';
async function workspace(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oscode-features-')));
  t.after(() => fs.rm(root, { recursive: true, force: true })); return root;
}
const usage = { input: 100, output: 20, cacheRead: 40, cacheWrite: 10, requests: 1, estimated: 0 };
const config = { provider: 'anthropic', model: 'fixture', maxInput: 12000, maxOutput: 1000, budget: 10000, maxSteps: 8 };
const signal = () => new AbortController().signal;
async function cli(args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('OSCODE_') && key !== 'ANTHROPIC_API_KEY'));
  const child = spawn(process.execPath, [path.resolve('bin/oscode.js'), ...args], { env });
  let output = ''; child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
  const code = await new Promise(resolve => child.on('close', resolve)); return { code, output };
}
test('config precedence, strict validation, project denial, exclusive init', async t => {
  const root = await workspace(t);
  assert.deepEqual(await readProjectConfig(root), {});
  await initConfig(root); await assert.rejects(initConfig(root), /EEXIST/);
  const project = { model: 'project', budget: 500, permissions: { shell: 'deny' } };
  const resolved = resolveConfig(project, { model: 'cli' }, { OSCODE_MODEL: 'env', OSCODE_BUDGET: '800' });
  assert.equal(resolved.model, 'cli'); assert.equal(resolved.budget, 800); assert.equal(resolved.permissions.shell, 'deny');
  assert.equal(resolveConfig(project, {}, { OSCODE_MODEL: 'env' }).model, 'env');
  assert.equal(resolveConfig(project, {}, {}).model, 'project');
  assert.throws(() => resolveConfig({ apiKey: 'not-allowed' }, {}, {}));
  assert.throws(() => resolveConfig({ permissions: { shell: 'allow' } }, {}, {}));
  assert.throws(() => resolveConfig({}, { budget: 'NaN' }, {}));
  assert.throws(() => resolveConfig({ pricing: { anthropic: { x: { input: -1, output: 1 } } } }, {}, {}));
  const tools = new WorkspaceTools(root, { permissions: resolved.permissions, approve: async () => true });
  assert.equal((await tools.execute('shell', { command: 'touch forbidden' })).is_error, true);
  await assert.rejects(fs.stat(path.join(root, 'forbidden')));
});
test('usage cost separates cache rates and marks unknown prices', () => {
  assert.equal(costEstimate(usage, { input: 2, output: 4, cacheRead: 0.2, cacheWrite: 2.5 }), (50 * 2 + 20 * 4 + 40 * 0.2 + 10 * 2.5) / 1e6);
  assert.equal(costEstimate(usage, null), null);
  assert.equal(costEstimate(usage, { input: 2, output: 4 }), null);
  assert.equal(costEstimate(usage, null, 'demo'), 0);
  const session = newSession('/tmp');
  const turn = { messages: [{ role: 'user', content: 'hello' }], usage: { ...usage } };
  session.turns.push(turn, { messages: [{ role: 'user', content: 'next' }] });
  const record = beginRequest(turn, { ...config, pricing: { anthropic: { fixture: { input: 2, output: 4, cacheRead: 0.2, cacheWrite: 2.5 } } } }, 200, 100, { toolResults: 80 });
  finishRequest(record, usage); addUsage(session.usage, usage);
  const report = usageReport(session, true);
  assert.match(report, /fixture/); assert.match(report, /도구 결과: 80/); assert.match(report, /\$0.000213/);
  compact(session, 1); assert.equal(usageReport(session, true), report);
});
test('checkpoints restore the pre-agent user edit and original mode across resume', async t => {
  const root = await workspace(t), file = path.join(root, 'file');
  await fs.writeFile(file, 'existing user edit', { mode: 0o755 });
  const session = newSession(root), checkpoints = new Checkpoints(session);
  const tools = new WorkspaceTools(root, { checkpoints, approve: async () => true });
  await tools.execute('read_file', { path: 'file' });
  assert.equal((await tools.execute('edit_file', { path: 'file', old_text: 'user', new_text: 'agent' })).is_error, false);
  const resumed = new Checkpoints(await loadSession(root, session.id));
  assert.match(await resumed.undo(), /복원 완료/);
  assert.equal(await fs.readFile(file, 'utf8'), 'existing user edit');
  assert.equal((await fs.stat(file)).mode & 0o777, 0o755);
  assert.equal(resumed.session.workspaceNotes.length, 1);
});
test('undo refuses subsequent user changes, then supports reversing multiple edits', async t => {
  const root = await workspace(t), file = path.join(root, 'a'), session = newSession(root), c = new Checkpoints(session);
  await fs.writeFile(file, 'a'); await c.apply(file, 'a', 'b'); await c.apply(file, 'b', 'c');
  await fs.writeFile(file, 'user'); await assert.rejects(c.undo(), /충돌/); assert.equal(await fs.readFile(file, 'utf8'), 'user');
  await fs.writeFile(file, 'c'); await c.undo(); assert.equal(await fs.readFile(file, 'utf8'), 'b');
  await c.undo(); assert.equal(await fs.readFile(file, 'utf8'), 'a');
});
test('undo of new files removes only unchanged agent-created files', async t => {
  const root = await workspace(t), file = path.join(root, 'new'), c = new Checkpoints(newSession(root));
  await c.apply(file, null, 'created'); await c.undo(); await assert.rejects(fs.stat(file));
  await c.apply(file, null, 'created'); await fs.writeFile(file, 'user');
  await assert.rejects(c.undo(), /충돌/); assert.equal(await fs.readFile(file, 'utf8'), 'user');
});
test('checkpoint path replacement and journal save failures preserve user files', async t => {
  const root = await workspace(t), outside = await workspace(t), file = path.join(root, 'a');
  const c = new Checkpoints(newSession(root)); await c.apply(file, null, 'agent');
  await fs.unlink(file); await fs.writeFile(path.join(outside, 'a'), 'outside'); await fs.symlink(path.join(outside, 'a'), file);
  await assert.rejects(c.undo(), /symlink/); assert.equal(await fs.readFile(path.join(outside, 'a'), 'utf8'), 'outside');
  const fail = new Checkpoints(newSession(root), async () => { throw new Error('disk full'); });
  await assert.rejects(fail.apply(path.join(root, 'new'), null, 'x'), /disk full/); await assert.rejects(fs.stat(path.join(root, 'new')));
});
test('prepared/undoing checkpoint recovery is conservative and resumable', async t => {
  const root = await workspace(t), file = path.join(root, 'a'), c = new Checkpoints(newSession(root));
  await c.apply(file, null, 'agent');
  c.session.checkpoints[0].state = 'prepared'; await saveSession(c.session);
  const resumed = new Checkpoints(await loadSession(root, c.session.id)); await resumed.undo(); await assert.rejects(fs.stat(file));
  resumed.session.checkpoints[0].state = 'undoing'; await resumed.undo();
  assert.equal(resumed.session.checkpoints[0].state, 'undone');
});
test('loop guard handles reordered arguments and resets after real file progress', () => {
  const guard = new LoopGuard(3), call = { name: 'read_file', input: { path: './a', lines: 10 } }, result = { content: 'same', is_error: false };
  guard.observe(call, result); guard.observe(call, result);
  assert.match(guard.check({ name: 'read_file', input: { lines: 10, path: 'a' } }), /blocked/);
  guard.observe({ name: 'edit_file', input: {} }, { content: 'updated', is_error: false });
  assert.equal(guard.check(call), null);
});
test('loop stop skips remaining batch calls, pairs all results, and prevents another request', async t => {
  const root = await workspace(t), session = newSession(root); let calls = 0, executed = 0;
  const provider = { complete: async () => { calls++; return { content: '', calls: [1, 2, 3, 4].map(n => ({ id: String(n), name: 'search', input: { query: 'same' } })), usage }; } };
  const tools = { execute: async () => { executed++; return { content: 'No matches', is_error: false }; } };
  await assert.rejects(runTurn({ session, prompt: 'test', config, provider, tools, signal: signal() }), /Repeated/);
  assert.equal(calls, 1); assert.equal(executed, 2); assert.equal(session.turns[0].messages.filter(m => m.role === 'tool').length, 4);
  assert.ok(session.turns[0].loopStop);
});
test('consecutive distinct errors stop without another API request', async t => {
  const root = await workspace(t); let calls = 0;
  const provider = { complete: async () => { calls++; return { content: '', calls: [1, 2, 3].map(n => ({ id: String(n), name: 'read_file', input: { path: String(n) } })), usage }; } };
  await assert.rejects(runTurn({ session: newSession(root), prompt: 'test', config, provider, tools: new WorkspaceTools(root), signal: signal() }), /consecutive/);
  assert.equal(calls, 1);
});
test('interrupted sessions repair unknown tool results and reserve pending request usage only once', async t => {
  const root = await workspace(t), session = newSession(root);
  session.turns.push({ status: 'running', usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, requests: 0, estimated: 0 }, messages: [{ role: 'user', content: 'task' }, { role: 'assistant', content: '', tool_calls: [{ id: 'a', name: 'write_file', input: {} }] }], requests: [{ status: 'pending', inputEstimate: 100, maxOutput: 50 }] });
  await saveSession(session); const resumed = await loadSession(root, session.id);
  assert.equal(resumed.turns[0].status, 'interrupted'); assert.equal(resumed.usage.input, 100);
  assert.equal(resumed.turns[0].messages.filter(m => m.role === 'tool').length, 1);
  await saveSession(resumed); assert.equal((await loadSession(root, session.id)).usage.input, 100);
});
test('CLI init/config/usage/undo work without credentials or API calls', async t => {
  const root = await workspace(t);
  assert.equal((await cli(['--cwd', root, '--init'])).code, 0);
  assert.notEqual((await cli(['--cwd', root, '--init'])).code, 0);
  assert.match((await cli(['--cwd', root, '--config'])).output, /economy/);
  const session = newSession(root), c = new Checkpoints(session); await c.apply(path.join(root, 'new'), null, 'new');
  const listing = await cli(['--cwd', root, '--checkpoints']); assert.equal(listing.code, 0); assert.match(listing.output, /new/);
  assert.equal((await cli(['--cwd', root, '--usage'])).code, 0);
  assert.notEqual((await cli(['--cwd', root, '--undo', 'latest', '--plan'])).code, 0);
  const undo = await cli(['--cwd', root, '--undo', 'latest']); assert.equal(undo.code, 0, undo.output); await assert.rejects(fs.stat(path.join(root, 'new')));
});
