import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { WorkspaceTools, runCommand } from '../src/tools.js';
import { compact, buildMessages, estimateTokens, trimOldToolResult } from '../src/context.js';
import { newSession, saveSession, loadSession } from '../src/session.js';
import { runTurn } from '../src/agent.js';
import { makeBody, parseResponse, endpoint } from '../src/providers.js';
import { collectStream } from '../src/stream.js';

async function workspace(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oscode-test-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
const usage = (input = 100, output = 50) => ({ input, output, cacheRead: 0, cacheWrite: 0, requests: 1, estimated: 0 });
const config = { maxInput: 12000, maxOutput: 1000, budget: 10000, maxSteps: 5, model: 'test' };
const signal = () => new AbortController().signal;

test('file tools require a fresh read and a unique replacement; preserve literal dollar signs', async t => {
  const root = await workspace(t), tools = new WorkspaceTools(root, { approve: async () => true });
  await fs.writeFile(path.join(root, 'a.txt'), 'hello world\nhello again\n');
  assert.equal((await tools.execute('edit_file', { path: 'a.txt', old_text: 'world', new_text: 'earth' })).is_error, true);
  await tools.execute('read_file', { path: 'a.txt', start: 1, lines: 1 });
  assert.equal((await tools.execute('edit_file', { path: 'a.txt', old_text: 'hello', new_text: 'hi' })).is_error, true);
  assert.equal((await tools.execute('edit_file', { path: 'a.txt', old_text: 'world', new_text: '$& earth' })).is_error, false);
  assert.match(await fs.readFile(path.join(root, 'a.txt'), 'utf8'), /\$& earth/);
  await fs.writeFile(path.join(root, 'a.txt'), 'external change');
  assert.equal((await tools.execute('edit_file', { path: 'a.txt', old_text: 'external', new_text: 'local' })).is_error, true);
});
test('refuse project escape, private files, symlinks, and overwrite', async t => {
  const root = await workspace(t), outside = await workspace(t);
  await fs.writeFile(path.join(outside, 'secret'), 'private');
  await fs.symlink(outside, path.join(root, 'link'));
  const tools = new WorkspaceTools(root, { approve: async () => true });
  for (const name of ['../secret', 'link/secret', '.env', '.git/config', '.oscode/file']) {
    assert.equal((await tools.execute('read_file', { path: name })).is_error, true, name);
  }
  assert.equal((await tools.execute('write_file', { path: 'link/new', content: 'x' })).is_error, true);
  assert.equal((await tools.execute('write_file', { path: 'new', content: 'one' })).is_error, false);
  assert.equal((await tools.execute('write_file', { path: 'new', content: 'two' })).is_error, true);
  assert.equal(await fs.readFile(path.join(root, 'new'), 'utf8'), 'one');
});
test('plan mode and default permissions prevent side effects', async t => {
  const root = await workspace(t);
  const tools = new WorkspaceTools(root, { readOnly: true, approve: async () => true });
  assert.equal((await tools.execute('shell', { command: 'touch forbidden' })).is_error, true);
  assert.equal((await tools.execute('write_file', { path: 'forbidden', content: 'x' })).is_error, true);
  const denied = new WorkspaceTools(root);
  assert.equal((await denied.execute('shell', { command: 'touch forbidden' })).is_error, true);
  await assert.rejects(fs.stat(path.join(root, 'forbidden')));
});
test('tool validation and output bounds', async t => {
  const root = await workspace(t), tools = new WorkspaceTools(root, { outputLimit: 200 });
  await fs.writeFile(path.join(root, 'long.txt'), 'x'.repeat(5000));
  assert.equal((await tools.execute('read_file', { path: 'long.txt', lines: 301 })).is_error, true);
  assert.equal((await tools.execute('read_file', { path: 'long.txt', extra: true })).is_error, true);
  const result = await tools.execute('read_file', { path: 'long.txt' });
  assert.ok(result.content.length <= 200);
  assert.match(result.content, /truncated/);
});
test('Git ignore rules and excluded folders do not enter listing/search', async t => {
  const root = await workspace(t);
  await runCommand('git', ['init', '-q'], { cwd: root });
  await fs.writeFile(path.join(root, '.gitignore'), 'ignored.txt\n');
  await fs.writeFile(path.join(root, 'ignored.txt'), 'secret marker');
  await fs.writeFile(path.join(root, '.env'), 'secret marker');
  await fs.writeFile(path.join(root, 'ok.txt'), 'public marker');
  const tools = new WorkspaceTools(root);
  const result = await tools.execute('search', { query: 'marker' });
  assert.match(result.content, /ok.txt:1/); assert.doesNotMatch(result.content, /secret/);
});
test('command timeout, cancellation, and bounded output', async t => {
  const root = await workspace(t);
  const loud = await runCommand(process.execPath, ['-e', 'process.stdout.write("x".repeat(50000))'], { cwd: root, maxBytes: 100 });
  assert.equal(loud.output.length, 100); assert.equal(loud.truncated, true);
  const timed = await runCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { cwd: root, timeout: 50 });
  assert.equal(timed.timedOut, true);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 50);
  const stopped = await runCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { cwd: root, signal: controller.signal });
  assert.equal(stopped.cancelled, true);
});
test('compaction archives complete tool exchanges and preserves the active turn', () => {
  const session = newSession('/tmp');
  const old = { messages: [{ role: 'user', content: 'old request' }, { role: 'assistant', tool_calls: [{ id: 'a' }] }, { role: 'tool', tool_call_id: 'a', content: 'result' }] };
  session.turns = [old, { messages: [{ role: 'user', content: 'new request' }] }];
  assert.equal(compact(session, 1), 1);
  assert.deepEqual(session.archive[0], old);
  assert.equal(buildMessages(session).at(-1).content, 'new request');
  assert.equal(buildMessages(session).some(m => m.role === 'tool'), false);
  assert.ok(estimateTokens('가나다') > estimateTokens('abc'));
});
test('session save/resume is scoped and includes archived history', async t => {
  const root = await workspace(t), session = newSession(root);
  await saveSession(session);
  assert.equal((await loadSession(root, 'latest')).id, session.id);
  assert.equal((await fs.stat(path.join(root, '.oscode', `${session.id}.json`))).mode & 0o777, 0o600);
  await assert.rejects(loadSession(root, '../../elsewhere'));
  const dir = path.join(root, '.oscode');
  await fs.rm(dir, { recursive: true });
  await fs.symlink(await workspace(t), dir);
  await assert.rejects(saveSession(session), /symlink/);
});
test('Anthropic preserves tool-result pairing and counts all cache input once', () => {
  const request = { model: 'x', system: 'rules', maxOutput: 500, tools: [], messages: [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: '', tool_calls: [{ id: 'a', name: 'read_file', input: { path: 'x' } }, { id: 'b', name: 'read_file', input: { path: 'y' } }] },
    { role: 'tool', tool_call_id: 'a', content: 'one' }, { role: 'tool', tool_call_id: 'b', content: 'two', is_error: true }
  ] };
  const body = makeBody('anthropic', request);
  assert.equal(body.messages.length, 3);
  assert.equal(body.messages[2].content.length, 2);
  assert.equal(body.messages[2].content[1].is_error, true);
  const response = parseResponse('anthropic', { content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 20, cache_creation_input_tokens: 30 } }, request);
  assert.equal(response.usage.input, 60); assert.equal(response.usage.cacheRead, 20);
});
test('compatible responses preserve usage and reject credential-bearing endpoints', () => {
  const response = parseResponse('compatible', { choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 50, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 40 } } }, {});
  assert.equal(response.usage.input, 50); assert.equal(response.usage.cacheRead, 40);
  assert.throws(() => endpoint('http://example.com/v1', 'chat/completions'));
  assert.throws(() => endpoint('https://key@example.com/v1', 'chat/completions'));
  assert.equal(endpoint('http://localhost:1234/v1', 'chat/completions'), 'http://localhost:1234/v1/chat/completions');
});
async function* fragmented(text) {
  const bytes = Buffer.from(text);
  for (let i = 0; i < bytes.length; i += 3) yield bytes.subarray(i, i + 3);
}
const sse = events => events.map(e => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join('');
test('SSE handles split UTF-8 and fragmented tool arguments with late usage', async () => {
  let shown = '';
  const data = await collectStream('compatible', fragmented(sse([
    { choices: [{ delta: { content: '안녕', tool_calls: [{ index: 0, id: 'a', function: { name: 'read_file', arguments: '{"pa' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'th":"x"}' } }] }, finish_reason: 'tool_calls' }] },
    { choices: [], usage: { prompt_tokens: 10, completion_tokens: 8 } }, '[DONE]'
  ])), text => shown += text);
  assert.equal(shown, '안녕');
  assert.equal(JSON.parse(data.choices[0].message.tool_calls[0].function.arguments).path, 'x');
  assert.equal(data.usage.prompt_tokens, 10);
  await assert.rejects(collectStream('compatible', fragmented(sse([{ choices: [{ delta: { content: 'partial' } }] }]))), /before completion/);
});
test('Anthropic SSE collects tool input, cache usage, and final output usage', async () => {
  const data = await collectStream('anthropic', fragmented(sse([
    { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0, cache_read_input_tokens: 20 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'a', name: 'list_files', input: {} } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"path":"."}' } },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 30 } },
    { type: 'message_stop' }
  ])));
  assert.deepEqual(data.content[0].input, { path: '.' });
  assert.equal(data.usage.output_tokens, 30); assert.equal(data.usage.cache_read_input_tokens, 20);
});
test('agent completes read → edit → final and accounts usage', async t => {
  const root = await workspace(t); await fs.writeFile(path.join(root, 'a'), 'before');
  const session = newSession(root), tools = new WorkspaceTools(root, { approve: async () => true });
  const responses = [
    { content: '', calls: [{ id: '1', name: 'read_file', input: { path: 'a' } }], usage: usage() },
    { content: '', calls: [{ id: '2', name: 'edit_file', input: { path: 'a', old_text: 'before', new_text: 'after' } }], usage: usage() },
    { content: 'done', calls: [], usage: usage() }
  ];
  const turn = await runTurn({ session, prompt: 'edit', config, tools, provider: { complete: async () => responses.shift() }, signal: signal(), save: saveSession });
  assert.equal(turn.status, 'done'); assert.equal(session.usage.input, 300);
  assert.equal(await fs.readFile(path.join(root, 'a'), 'utf8'), 'after');
  assert.equal((await loadSession(root, session.id)).turns[0].status, 'done');
});
test('budget blocks API calls before dispatch and after reported usage exhausts budget', async t => {
  const root = await workspace(t), tools = new WorkspaceTools(root);
  let calls = 0;
  const provider = { complete: async () => { calls++; return { content: '', calls: [{ id: 'a', name: 'list_files', input: {} }], usage: usage(20000) }; } };
  await assert.rejects(runTurn({ session: newSession(root), prompt: 'hi', config: { ...config, budget: 1 }, provider, tools, signal: signal() }), /budget/);
  assert.equal(calls, 0);
  await assert.rejects(runTurn({ session: newSession(root), prompt: 'hi', config, provider, tools, signal: signal() }), /budget/);
  assert.equal(calls, 1);
});
test('truncated responses and cancellation never execute tool calls', async t => {
  const root = await workspace(t), tools = new WorkspaceTools(root, { approve: async () => true });
  const provider = { complete: async () => ({ content: '', truncated: true, calls: [{ id: 'a', name: 'write_file', input: { path: 'bad', content: 'bad' } }], usage: usage() }) };
  await assert.rejects(runTurn({ session: newSession(root), prompt: 'hi', config, provider, tools, signal: signal() }), /output limit/);
  await assert.rejects(fs.stat(path.join(root, 'bad')));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(runTurn({ session: newSession(root), prompt: 'hi', config, provider, tools, signal: controller.signal }), /Cancelled/);
});
test('API failure reserves unknown usage and does not automatically retry', async t => {
  const root = await workspace(t), session = newSession(root); let attempts = 0;
  await assert.rejects(runTurn({ session, prompt: 'hi', config, tools: new WorkspaceTools(root), signal: signal(), provider: { complete: async () => { attempts++; throw new Error('network lost'); } } }), /network lost/);
  assert.equal(attempts, 1); assert.equal(session.usage.estimated, 1); assert.ok(session.usage.input > 0);
});
test('CLI talks to a mock HTTP provider, executes tools, streams text, and saves actual usage', async t => {
  const root = await workspace(t); await fs.writeFile(path.join(root, 'sample.txt'), 'hello fixture');
  const received = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    received.push(JSON.parse(body));
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    if (received.length === 1) res.end(sse([
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'read1', function: { name: 'read_file', arguments: '{"path":"sample.txt"}' } }] }, finish_reason: 'tool_calls' }] },
      { choices: [], usage: { prompt_tokens: 100, completion_tokens: 20 } }, '[DONE]'
    ]));
    else res.end(sse([
      { choices: [{ delta: { content: 'Verified hello fixture.' }, finish_reason: 'stop' }] },
      { choices: [], usage: { prompt_tokens: 140, completion_tokens: 10 } }, '[DONE]'
    ]));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const child = spawn(process.execPath, [path.resolve('bin/oscode.js'), '--provider', 'compatible', '--base-url', `http://127.0.0.1:${server.address().port}/v1`, '--model', 'fixture', '--cwd', root, '--prompt', 'read sample', '--plan'], { env: { ...process.env, OSCODE_API_KEY: '' } });
  let output = ''; child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
  assert.equal(await new Promise(resolve => child.on('close', resolve)), 0, output);
  assert.equal(received.length, 2);
  assert.equal(received[1].messages.at(-1).role, 'tool');
  assert.match(output, /Verified hello fixture/);
  assert.match(output, /입력 240 · 출력 30/);
  const saved = await loadSession(root, 'latest');
  assert.equal(saved.usage.input, 240); assert.equal(saved.turns[0].status, 'done');
});

test('tool-result trimming retains call IDs, recent outputs, and archived original', () => {
  const turn = { messages: [
    { role: 'tool', tool_call_id: 'a', content: 'a'.repeat(1000) },
    { role: 'tool', tool_call_id: 'b', content: 'b'.repeat(1000) },
    { role: 'tool', tool_call_id: 'c', content: 'c'.repeat(1000) }
  ] };
  assert.equal(trimOldToolResult(turn), true);
  assert.equal(turn.messages[0].tool_call_id, 'a');
  assert.ok(turn.messages[0].content.length < 400);
  assert.equal(turn.toolArchive[0].message.content.length, 1000);
  assert.equal(turn.messages[1].content.length, 1000);
  assert.equal(trimOldToolResult(turn), false);
});
test('step limit stops looping and leaves paired tool messages for resume', async t => {
  const root = await workspace(t), session = newSession(root); let calls = 0;
  const provider = { complete: async () => ({ content: '', calls: [{ id: String(++calls), name: 'list_files', input: {} }], usage: usage() }) };
  await assert.rejects(runTurn({ session, prompt: 'loop', config: { ...config, maxSteps: 2 }, tools: new WorkspaceTools(root), provider, signal: signal() }), /after 2/);
  assert.equal(calls, 2);
  const messages = session.turns[0].messages;
  assert.equal(messages.filter(m => m.role === 'tool').length, 2);
  assert.equal(session.turns[0].status, 'stopped');
});
test('file modification during approval prevents overwrite', async t => {
  const root = await workspace(t), file = path.join(root, 'a');
  await fs.writeFile(file, 'before');
  const tools = new WorkspaceTools(root, { approve: async () => { await fs.writeFile(file, 'changed'); return true; } });
  await tools.execute('read_file', { path: 'a' });
  const result = await tools.execute('edit_file', { path: 'a', old_text: 'before', new_text: 'after' });
  assert.equal(result.is_error, true);
  assert.equal(await fs.readFile(file, 'utf8'), 'changed');
});
