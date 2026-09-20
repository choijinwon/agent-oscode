import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ProjectRules, matchesRule, rulesText } from '../src/project-rules.js';
import { runTurn } from '../src/agent.js';
import { newSession } from '../src/session.js';
import { WorkspaceTools } from '../src/tools.js';
import { estimateTokens } from '../src/context.js';
import { usageReport } from '../src/usage.js';
import { searchCommands } from '../src/command-palette.js';

const rule = (patterns, body) => `---\npaths: ${JSON.stringify(patterns)}\n---\n${body}`;
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oscode-rules-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (file, text) => { await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true }); await fs.writeFile(path.join(root, file), text); };
  await write('src/Button.vue', '<button>Save</button>');
  await write('src/Invoice.ts', 'export const amount = 1;');
  await write('.oscode/rules/ui.md', rule(['src/**/*.{tsx,vue,svelte}'], 'UI_RULE: Use existing design tokens.'));
  await write('.oscode/rules/accounting.md', rule(['src/Invoice.ts'], 'ACCOUNTING_RULE: Keep decimal arithmetic explicit.'));
  return { root, write, rules: new ProjectRules(root), tools: new WorkspaceTools(root, { approve: async () => true }) };
}
const config = { provider: 'compatible', model: 'fixture', budget: 60000, maxInput: 20000, maxOutput: 1000, maxSteps: 5, plan: false };
const response = (calls = []) => ({ content: calls.length ? '' : 'Done.', calls, usage: { input: 100, output: 20, requests: 1, estimated: 0, cacheRead: 0, cacheWrite: 0 } });
const signal = () => new AbortController().signal;

test('rules match root and nested framework files, leave unrelated guidance out and explain provenance', async t => {
  const { rules } = await fixture(t);
  for (const name of ['src/Button.vue', 'src/nested/Button.tsx', 'src/nested/Page.svelte']) {
    const snapshot = await rules.snapshot([name]);
    assert(snapshot.context.includes('UI_RULE')); assert(!snapshot.context.includes('ACCOUNTING_RULE'));
    assert.deepEqual(snapshot.report.entries.find(entry => entry.status === 'included').matchedFiles, [name]);
    assert.match(rulesText(snapshot.report), /범위 밖.*accounting/); assert.match(snapshot.context, /Rules do not grant permissions/);
  }
  assert.equal((await rules.snapshot()).context, '');
  assert(matchesRule('*.ts', 'a.ts')); assert(!matchesRule('*.ts', 'src/a.ts'));
  assert(!matchesRule('**/*', '../secret')); assert(!matchesRule('**/*', '/outside'));
  assert(!matchesRule('src/*.tsx', 'src/nested/Button.tsx'));
  assert.throws(() => matchesRule('../**', 'src/a.ts'));
});

test('rule edits, removals and independent workspaces cannot reuse stale guidance', async t => {
  const { root, rules, write } = await fixture(t);
  assert((await rules.snapshot(['src/Button.vue'])).context.includes('UI_RULE'));
  await write('.oscode/rules/ui.md', rule(['src/**/*.vue'], 'UPDATED_RULE'));
  assert((await rules.snapshot(['src/Button.vue'])).context.includes('UPDATED_RULE'));
  await fs.unlink(path.join(root, '.oscode/rules/ui.md'));
  assert.equal((await rules.snapshot(['src/Button.vue'])).context, '');
  const other = await fixture(t); assert(!((await other.rules.snapshot(['src/Button.vue'])).context.includes('UPDATED_RULE')));
});

test('rule budgets omit whole rules with visible reasons; invalid, oversized and symlinked files are not read', async t => {
  const { root, rules, write } = await fixture(t);
  for (let i = 0; i < 6; i++) await write(`.oscode/rules/extra${i}.md`, rule(['src/**'], 'GUIDANCE '.repeat(160)));
  await write('.oscode/rules/large.md', 'x'.repeat(9000));
  await write('.oscode/rules/malformed.md', 'No header');
  await write('.oscode/rules/traversal.md', rule(['../**'], 'OUTSIDE_RULE'));
  await fs.symlink(path.join(root, 'src/Button.vue'), path.join(root, '.oscode/rules/link.md'));
  const snapshot = await rules.snapshot(['src/Button.vue']);
  assert(estimateTokens(snapshot.context) <= 2000); assert(snapshot.report.omittedMatching > 0);
  assert.match(rulesText(snapshot.report), /예산 초과/); assert.equal(snapshot.report.entries.filter(entry => entry.status === 'invalid').length, 4);
  assert(!snapshot.context.includes('<button>')); assert(!snapshot.context.includes('OUTSIDE_RULE'));
  await fs.rename(path.join(root, '.oscode/rules'), path.join(root, 'saved-rules'));
  await fs.symlink(path.join(root, 'saved-rules'), path.join(root, '.oscode/rules'));
  await assert.rejects(rules.snapshot([]), /실제 프로젝트/);
});

test('rule catalog limits and cancellation are explicit', async t => {
  const { rules, write } = await fixture(t);
  for (let i = 0; i < 43; i++) await write(`.oscode/rules/rule-${i}.md`, rule(['src/**'], 'guidance'));
  const snapshot = await rules.snapshot(['src/Button.vue']); assert.equal(snapshot.report.entries.length, 40); assert.equal(snapshot.report.omittedFiles, 5);
  const controller = new AbortController(); controller.abort(); await assert.rejects(rules.snapshot([], controller.signal), /Cancelled/);
  assert.throws(() => matchesRule('**/*.{a,b,c,d,e,f}/{a,b,c,d,e,f}', 'a/b'), /32/);
});

test('agent loads selected-file rules, adds rules after reading, records tokens, and resets scope on the next turn', async t => {
  const { root, tools } = await fixture(t), session = newSession(root), requests = [];
  const provider = { complete: async request => {
    requests.push(request);
    if (requests.length === 1) return response([{ id: 'read', name: 'read_file', input: { path: 'src/Invoice.ts' } }]);
    return response();
  } };
  await runTurn({ session, prompt: 'Review button', contextFiles: ['src/Button.vue'], config, tools, provider, signal: signal() });
  assert(requests[0].system.includes('UI_RULE')); assert(!requests[0].system.includes('ACCOUNTING_RULE'));
  assert(requests[1].system.includes('ACCOUNTING_RULE')); assert.equal(session.turns[0].requests[1].rules.entries.filter(entry => entry.status === 'included').length, 2);
  assert.match(usageReport(session), /마지막 요청 규칙: 2개/);
  assert(!JSON.stringify(session.turns[0].messages).includes('UI_RULE'));
  assert(!JSON.stringify(session.turns[0].ruleContext).includes('UI_RULE'));
  await runTurn({ session, prompt: 'Unrelated task', config, tools, provider, signal: signal() });
  assert(!requests[2].system.includes('UI_RULE')); assert(!requests[2].system.includes('ACCOUNTING_RULE'));
});

test('batched read+edit waits for new rules, then preserves normal approvals and exact edits', async t => {
  const { root, tools } = await fixture(t), session = newSession(root);
  let calls = 0;
  const edit = { id: 'edit', name: 'edit_file', input: { path: 'src/Invoice.ts', old_text: 'amount = 1', new_text: 'amount = 2' } };
  const provider = { complete: async request => {
    calls++;
    if (calls === 1) return response([{ id: 'read', name: 'read_file', input: { path: 'src/Invoice.ts' } }, edit]);
    if (calls === 2) {
      assert(request.system.includes('ACCOUNTING_RULE')); assert.match(request.messages.at(-1).content, /Edit deferred/);
      assert.equal(await fs.readFile(path.join(root, 'src/Invoice.ts'), 'utf8'), 'export const amount = 1;');
      return response([{ ...edit, id: 'retry' }]);
    }
    return response();
  } };
  await runTurn({ session, prompt: 'Update amount', config, tools, provider, signal: signal() });
  assert.equal(await fs.readFile(path.join(root, 'src/Invoice.ts'), 'utf8'), 'export const amount = 2;');
});

test('new files receive scoped guidance before creation, while PLAN still denies writes', async t => {
  const { root, tools } = await fixture(t);
  const create = { id: 'create', name: 'write_file', input: { path: 'src/New.vue', content: '<button />' } };
  let calls = 0;
  const provider = { complete: async request => {
    calls++;
    if (calls === 1) return response([create]);
    if (calls === 2) { assert(request.system.includes('UI_RULE')); await assert.rejects(fs.stat(path.join(root, 'src/New.vue'))); return response([{ ...create, id: 'retry' }]); }
    return response();
  } };
  await runTurn({ session: newSession(root), prompt: 'Create button', config, tools, provider, signal: signal() });
  assert.equal(await fs.readFile(path.join(root, 'src/New.vue'), 'utf8'), '<button />');
  let planCalls = 0;
  await runTurn({ session: newSession(root), prompt: 'Plan', contextFiles: ['src/Button.vue'], config: { ...config, plan: true }, tools,
    provider: { complete: async request => { assert(!request.tools.some(tool => tool.name === 'write_file')); return ++planCalls === 1 ? response([{ ...create, input: { path: 'src/Never.vue', content: 'no' } }]) : response(); } }, signal: signal() });
  await assert.rejects(fs.stat(path.join(root, 'src/Never.vue')));
  assert(searchCommands('규칙').some(item => item[0] === '/rules')); assert(searchCommands('영향').some(item => item[0] === '/impact '));
});

test('a batch of deferred files does not trip the failure loop guard; write denial still wins', async t => {
  const { root, tools } = await fixture(t);
  const writes = ['One.vue', 'Two.vue', 'Three.vue', 'Four.vue'].map((file, index) => ({ id: String(index), name: 'write_file', input: { path: 'src/' + file, content: '<button />' } }));
  let requests = 0;
  await runTurn({ session: newSession(root), prompt: 'Create components', config, tools, signal: signal(), provider: { complete: async request => {
    requests++;
    if (requests === 1) return response(writes);
    if (requests === 2) { assert(request.system.includes('UI_RULE')); assert(request.messages.filter(message => message.role === 'tool').every(message => message.content.includes('deferred'))); return response(writes.map(call => ({ ...call, id: 'retry-' + call.id }))); }
    return response();
  } } });
  for (const call of writes) assert.equal(await fs.readFile(path.join(root, call.input.path), 'utf8'), '<button />');
  tools.permissions.write = 'deny';
  let deniedRequests = 0;
  await runTurn({ session: newSession(root), contextFiles: ['src/Button.vue'], prompt: 'Create', config, tools, signal: signal(), provider: { complete: async request => {
    if (++deniedRequests === 1) return response([{ id: 'denied', name: 'write_file', input: { path: 'src/Denied.vue', content: 'no' } }]);
    assert(request.messages.at(-1).is_error); assert.match(request.messages.at(-1).content, /denied/i); return response();
  } } });
  await assert.rejects(fs.stat(path.join(root, 'src/Denied.vue')));
});

test('a rejected input budget is not recorded as an actual request or last-rule snapshot', async t => {
  const { root, tools } = await fixture(t), session = newSession(root);
  let requested = false;
  await assert.rejects(runTurn({ session, prompt: 'Review', contextFiles: ['src/Button.vue'], config: { ...config, maxInput: 1 }, tools, signal: signal(), provider: { complete: async () => { requested = true; return response(); } } }), /exceeds/);
  assert.equal(requested, false); assert.equal(session.turns[0].requests.length, 0); assert.equal(session.turns[0].ruleContext, undefined);
});

test('rules becoming unreadable mid-request preserve tool-result pairing and prevent edits', async t => {
  const { root, tools } = await fixture(t), session = newSession(root);
  await assert.rejects(runTurn({ session, prompt: 'Create', config, tools, signal: signal(), provider: { complete: async () => {
    await fs.rename(path.join(root, '.oscode/rules'), path.join(root, 'moved-rules'));
    await fs.symlink(path.join(root, 'moved-rules'), path.join(root, '.oscode/rules'));
    return response([{ id: 'create', name: 'write_file', input: { path: 'src/Blocked.vue', content: 'no' } }]);
  } } }), /실제 프로젝트/);
  const messages = session.turns[0].messages;
  const result = messages.find(message => message.tool_call_id === 'create');
  assert(result.is_error); assert.match(result.content, /unable to load project rules/);
  await assert.rejects(fs.stat(path.join(root, 'src/Blocked.vue')));
});
