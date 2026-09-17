import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { checkUi, validateUiUrl, uiSummary } from '../src/ui-check.js';
import { WorkspaceTools } from '../src/tools.js';
import { runTurn } from '../src/agent.js';
import { newSession } from '../src/session.js';
import { resolveConfig } from '../src/config.js';
async function rootFor(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oscode-ui-')));
  t.after(() => fs.rm(root, { recursive: true, force: true })); return root;
}
test('UI URL and viewport validation reject unsupported input before launch', async t => {
  for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'http://user:pass@localhost']) assert.throws(() => validateUiUrl(url));
  const root = await rootFor(t);
  await assert.rejects(checkUi({ root, url: 'http://localhost', viewport: 'huge' }), /viewport/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(checkUi({ root, url: 'http://localhost', signal: controller.signal }), /Cancelled/);
});
test('browser tool respects plan mode and denied permissions before approval or launch', async t => {
  const root = await rootFor(t); let approvals = 0;
  for (const options of [{ readOnly: true }, { permissions: { shell: 'deny' } }]) {
    const tools = new WorkspaceTools(root, { ...options, approve: async () => { approvals++; return true; } });
    assert.equal((await tools.execute('ui_check', { url: 'http://localhost' })).is_error, true);
  }
  assert.equal(approvals, 0);
  assert.match((await new WorkspaceTools(root).execute('ui_check', { url: 'http://localhost' })).content, /denied/);
});
test('frontend PLAN dispatcher never invokes the browser even with a permissive runner', async t => {
  const root = await rootFor(t); let calls = 0, executed = 0;
  await runTurn({ session: newSession(root), prompt: 'inspect UI', config: resolveConfig({}, { agent: 'frontend', plan: true }, {}), signal: new AbortController().signal,
    tools: { execute: async () => { executed++; } }, provider: { complete: async req => {
      assert.ok(!req.tools.some(t => t.name === 'ui_check'));
      return { content: ++calls === 1 ? '' : 'Plan: inspect later', calls: calls === 1 ? [{ id: 'x', name: 'ui_check', input: { url: 'http://localhost' } }] : [], usage: { input: 10, output: 10, requests: 1 } };
    } } });
  assert.equal(executed, 0);
});
test('real Chromium detects overflow and errors, saves screenshots, and verifies the fix', async t => {
  let chromium;
  try { ({ chromium } = await import('playwright')); await fs.access(chromium.executablePath()); }
  catch { if (process.env.CI) throw new Error('CI requires Playwright Chromium'); t.skip('Install Chromium to run browser integration'); return; }
  const root = await rootFor(t); let broken = true;
  const server = createServer((req, res) => {
    if (req.url.startsWith('/missing')) { res.writeHead(404); res.end('missing'); return; }
    res.setHeader('Content-Type', 'text/html');
    res.end(`<html><head><link rel="icon" href="data:,"></head><body><div id="wide" style="width:${broken ? '1100px' : '100%'}">Content</div>${broken ? '<script>console.error("fixture console error");fetch("/missing?token=private");setTimeout(()=>{throw Error("fixture runtime error")},10)</script>' : ''}</body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/?secret=hidden`;
  const report = await checkUi({ root, url });
  assert.equal(report.results.length, 3); assert.equal(report.incomplete, false);
  assert.ok(report.results[0].overflow.pixels > 0);
  assert.equal(report.results[2].overflow.pixels, 0);
  assert.ok(report.results[0].overflow.candidates.some(x => x.selector === '#wide'));
  assert.ok(report.results[0].errors.some(x => x.includes('fixture runtime error')));
  assert.ok(report.results[0].requests.some(x => x.status === 404 && !x.url.includes('token=')));
  assert.ok(report.results[0].console.some(x => x.text.includes('fixture console error')));
  assert.ok((await fs.stat(report.results[0].screenshot)).size > 0);
  assert.equal(JSON.parse(await fs.readFile(report.file, 'utf8')).url.includes('secret='), false);
  assert.ok(uiSummary(report).length < 8000);
  const envForFailure = { ...process.env };
  await assert.rejects(promisify(execFile)(process.execPath, [path.resolve('bin/oscode.js'), 'ui', 'check', url, '--cwd', root, '--viewport', 'mobile'], { env: envForFailure }), error => error.code === 2 && JSON.parse(error.stdout).findings > 0);
  broken = false;
  const clean = await checkUi({ root, url, viewport: 'mobile' });
  assert.equal(clean.results.length, 1); assert.equal(clean.findings, 0); assert.equal(clean.incomplete, false);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('OSCODE_') && key !== 'ANTHROPIC_API_KEY'));
  const cli = await promisify(execFile)(process.execPath, [path.resolve('bin/oscode.js'), 'ui', 'check', url, '--cwd', root, '--viewport', 'mobile'], { env });
  assert.equal(JSON.parse(cli.stdout).findings, 0);
  await fs.writeFile(path.join(root, 'oscode.json'), '{"plan":true}');
  await assert.rejects(promisify(execFile)(process.execPath, [path.resolve('bin/oscode.js'), '--ui-check', url, '--cwd', root], { env }), error => error.code === 1 && /blocked/.test(error.stdout));
});
