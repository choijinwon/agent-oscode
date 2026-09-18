import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { runTurn } from '../src/agent.js';
import { newSession, loadSession, saveSession } from '../src/session.js';
import { WorkspaceTools } from '../src/tools.js';
import { latestPlan, renderPlan, getApplicablePlan, planExecutionPrompt, switchMode } from '../src/plans.js';
import { compact, buildMessages } from '../src/context.js';
async function workspace(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oscode-plan-')));
  t.after(() => fs.rm(root, { recursive: true, force: true })); return root;
}
const base = { provider: 'compatible', model: 'fixture', budget: 15000, maxInput: 12000, maxOutput: 1000, maxSteps: 5, plan: true };
const usage = { input: 100, output: 20, cacheRead: 0, cacheWrite: 0, requests: 1, estimated: 0 };
const planText = '# 목표\n로그인 오류 수정\n## 단계\n1. auth.js 검증 수정\n## 검증\nnpm test\n## 가정\n없음';
const signal = () => new AbortController().signal;
const response = (content = planText, calls = []) => ({ content, calls, usage });
async function makePlan(root, session = newSession(root)) {
  await runTurn({ session, prompt: '로그인 오류를 수정해줘', config: { ...base }, provider: { complete: async () => response() }, tools: new WorkspaceTools(root), signal: signal(), save: saveSession });
  return session;
}
async function cli(args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('OSCODE_') && key !== 'ANTHROPIC_API_KEY'));
  const child = spawn(process.execPath, [path.resolve('bin/oscode.js'), ...args], { env });
  let output = ''; child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
  const code = await new Promise(resolve => { child.on('close', resolve); child.on('error', () => resolve(-1)); }); return { code, output };
}
test('plan mode investigates, stores a draft and exposes only read tools without extra model calls', async t => {
  const root = await workspace(t), session = newSession(root); let calls = 0;
  await fs.writeFile(path.join(root, 'auth.js'), 'original');
  const tools = new WorkspaceTools(root, { approve: async () => true });
  const provider = { complete: async req => {
    calls++; assert.deepEqual(req.tools.map(t => t.name), ['repository_map', 'read_document', 'analysis_checkpoint', 'list_files', 'read_file', 'search']);
    assert.match(req.system, /Finish with a concise Markdown plan/);
    return calls === 1 ? response('', [{ id: 'r', name: 'read_file', input: { path: 'auth.js' } }]) : response();
  } };
  await runTurn({ session, prompt: 'fix login', config: base, provider, tools, signal: signal(), save: saveSession });
  assert.equal(calls, 2); assert.equal(session.mode, 'plan');
  assert.equal(latestPlan(session).status, 'draft'); assert.equal(latestPlan(session).text, planText);
  assert.equal((await loadSession(root, session.id)).plans[0].text, planText);
  assert.equal(await fs.readFile(path.join(root, 'auth.js'), 'utf8'), 'original');
});
test('agent dispatcher blocks mutations even when the supplied tool runner permits writes', async t => {
  const root = await workspace(t), session = newSession(root); let executed = 0;
  const provider = { complete: async () => response('', ['write_file', 'shell', 'edit_file'].map((name, i) => ({ id: String(i), name, input: {} }))) };
  await assert.rejects(runTurn({ session, prompt: 'fix', config: base, provider, tools: { execute: async () => { executed++; return { content: 'oops', is_error: false }; } }, signal: signal() }), /consecutive/);
  assert.equal(executed, 0); assert.equal(latestPlan(session).status, 'failed');
});
test('switching plan/build updates tools, preserves permissions, and respects project lock', async t => {
  const root = await workspace(t), session = newSession(root), config = { ...base, permissions: { write: 'deny' } };
  const tools = new WorkspaceTools(root, { permissions: config.permissions });
  switchMode(config, tools, session, true); assert.equal(tools.readOnly, true);
  assert.throws(() => switchMode(config, tools, session, false, true), /해제/);
  assert.equal(config.plan, true);
  switchMode(config, tools, session, false); assert.equal(config.plan, false); assert.equal(tools.permissions.write, 'deny');
});
test('plans survive compaction and execution includes the approved text only once', async t => {
  const root = await workspace(t), session = await makePlan(root), plan = getApplicablePlan(session);
  session.turns.push({ messages: [{ role: 'user', content: planExecutionPrompt(plan) }], executionPlanId: plan.id });
  assert.equal(buildMessages(session).filter(m => m.content?.includes('# 목표')).length, 1);
  compact(session, 1); assert.equal(latestPlan(session).text, planText);
  assert.match(renderPlan(session), /계획 r1/);
  assert.match(renderPlan(session, true), /draft/);
});
test('empty, cancelled, failed and newer unfinished plans cannot be applied', async t => {
  const root = await workspace(t), session = await makePlan(root);
  await assert.rejects(runTurn({ session, prompt: 'new plan', config: base, provider: { complete: async () => response('') }, tools: new WorkspaceTools(root), signal: signal() }), /완성된 계획/);
  assert.equal(session.plans.length, 2); assert.equal(latestPlan(session).status, 'failed');
  assert.throws(() => getApplicablePlan(session), /완성된 계획/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(runTurn({ session, prompt: 'cancelled', config: base, provider: { complete: async () => response() }, tools: new WorkspaceTools(root), signal: controller.signal }), /Cancelled/);
  assert.equal(latestPlan(session).status, 'failed');
});
test('approved plan execution records its outcome and prevents accidental completed-plan replay', async t => {
  const root = await workspace(t), session = await makePlan(root), plan = getApplicablePlan(session);
  assert.throws(() => getApplicablePlan(session, { locked: true }));
  await assert.rejects(runTurn({ session, prompt: 'run', config: base, provider: {}, tools: {}, signal: signal(), executionPlan: plan }), /read-only/);
  await runTurn({ session, prompt: planExecutionPrompt(plan), config: { ...base, plan: false }, executionPlan: plan, provider: { complete: async () => response('No changes needed; verified current source.') }, tools: new WorkspaceTools(root), signal: signal(), save: saveSession });
  assert.equal(plan.status, 'completed'); assert.equal(plan.attempts[0].status, 'completed');
  assert.throws(() => getApplicablePlan(session), /completed/);
});
test('stopped execution can be explicitly resumed, while interrupted planning remains incomplete', async t => {
  const root = await workspace(t), session = await makePlan(root), plan = getApplicablePlan(session);
  await assert.rejects(runTurn({ session, prompt: planExecutionPrompt(plan), config: { ...base, plan: false }, executionPlan: plan, provider: { complete: async () => { throw new Error('offline'); } }, tools: new WorkspaceTools(root), signal: signal(), save: saveSession }), /offline/);
  assert.equal(getApplicablePlan(session).status, 'stopped');
  plan.status = 'running'; session.turns.at(-1).status = 'running'; await saveSession(session);
  const loaded = await loadSession(root, session.id); assert.equal(getApplicablePlan(loaded).status, 'interrupted');
  const planningSession = await makePlan(root); planningSession.turns[0].status = 'running'; latestPlan(planningSession).status = 'planning'; await saveSession(planningSession);
  assert.equal(latestPlan(await loadSession(root, planningSession.id)).status, 'failed');
});
test('show-plan and conflicting/locked apply commands need no API credentials', async t => {
  const root = await workspace(t), session = await makePlan(root);
  const show = await cli(['--cwd', root, '--resume', session.id, '--show-plan']);
  assert.equal(show.code, 0); assert.match(show.output, /auth.js/);
  assert.notEqual((await cli(['--cwd', root, '--apply-plan', '--plan'])).code, 0);
  await fs.writeFile(path.join(root, 'oscode.json'), '{"plan":true}');
  const apply = await cli(['--cwd', root, '--resume', session.id, '--apply-plan', '--yes', '--allow-shell']);
  assert.notEqual(apply.code, 0); assert.match(apply.output, /plan: true/);
});
test('CLI plans then explicitly applies the saved plan through the mock API', async t => {
  const root = await workspace(t); let count = 0; const requests = [];
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw); requests.push(body); count++;
    res.writeHead(200, { 'content-type': 'application/json' });
    const message = count === 1 ? { content: '# Plan\nCreate answer.txt with ok.\nVerify its content.' }
      : count === 2 ? { content: '', tool_calls: [{ id: 'create', type: 'function', function: { name: 'write_file', arguments: '{"path":"answer.txt","content":"ok"}' } }] }
        : { content: 'Created answer.txt.' };
    res.end(JSON.stringify({ choices: [{ message, finish_reason: count === 2 ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 20 } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const common = ['--cwd', root, '--provider', 'compatible', '--model', 'fixture', '--base-url', `http://127.0.0.1:${server.address().port}/v1`];
  const planned = await cli([...common, '--plan', '--prompt', 'Create answer.txt', '--yes', '--allow-shell']);
  assert.equal(planned.code, 0, planned.output); assert.equal(count, 1); await assert.rejects(fs.stat(path.join(root, 'answer.txt')));
  assert.deepEqual(requests[0].tools.map(t => t.function.name), ['repository_map', 'read_document', 'analysis_checkpoint', 'list_files', 'read_file', 'search']);
  const applied = await cli([...common, '--resume', 'latest', '--apply-plan', '--yes']);
  assert.equal(applied.code, 0, applied.output); assert.equal(count, 3);
  assert.equal(await fs.readFile(path.join(root, 'answer.txt'), 'utf8'), 'ok');
  assert.equal(requests[1].messages.filter(m => m.content?.includes('# Plan')).length, 1);
  assert.equal(latestPlan(await loadSession(root, 'latest')).status, 'completed');
});
