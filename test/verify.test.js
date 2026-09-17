import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { WorkspaceTools } from '../src/tools.js';
import { verifyProject, changedFiles, renderVerify } from '../src/verify.js';
import { startDevServer, localUrl } from '../src/dev-server.js';
import { resolveConfig } from '../src/config.js';
const exec = promisify(execFile);
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oscode-verify-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ packageManager: 'npm@10.0.0', scripts: { lint: 'node lint.cjs', dev: 'node server.cjs', fail: 'node -e "process.exit(3)"' } }));
  await fs.writeFile(path.join(root, 'lint.cjs'), "require('node:fs').writeFileSync('checked.txt','ok');");
  await fs.writeFile(path.join(root, 'server.cjs'), "const fs=require('node:fs');fs.writeFileSync('server.pid',String(process.pid));const s=require('node:http').createServer((q,r)=>{r.setHeader('content-type','text/html');r.end('<html><head><link rel=\"icon\" href=\"data:,\"></head><body>Ready</body></html>')});s.listen(0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+s.address().port));");
  return root;
}
const config = verify => resolveConfig({ verify }, {}, {});
test('verify config validates scripts/timeouts and report escapes hostile output', () => {
  assert.throws(() => config({ scripts: ['lint; rm'] }));
  assert.throws(() => config({ readyTimeout: 10 }));
  assert.throws(() => config({ url: 'file:///tmp/a' }));
  const html = renderVerify({ directory: '/tmp/run', steps: [{ name: '<img onerror=x>', status: 'failed', output: '<script>alert(1)</script>' }], changed: ['<svg>'], status: 'failed', ui: { results: [{ viewport: 'mobile', screenshot: 'javascript:alert(1)' }] } });
  assert.ok(!html.includes('<script>')); assert.match(html, /&lt;script&gt;/); assert.ok(!html.includes('src="javascript:'));
});
test('Git changes include staged, unstaged, deleted and untracked paths without ignored output', async t => {
  const root = await fixture(t);
  await exec('git', ['init', '-q'], { cwd: root });
  await fs.writeFile(path.join(root, '.gitignore'), '.oscode/\nignored.txt\n');
  await exec('git', ['add', '.'], { cwd: root });
  await exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.test', 'commit', '-qm', 'initial'], { cwd: root });
  await fs.writeFile(path.join(root, 'new.ts'), 'export const n = 1');
  await fs.writeFile(path.join(root, 'ignored.txt'), 'ignore');
  await fs.unlink(path.join(root, 'server.cjs'));
  await fs.appendFile(path.join(root, 'lint.cjs'), '\n// change');
  await exec('git', ['add', 'lint.cjs'], { cwd: root });
  assert.deepEqual(await changedFiles(root), ['lint.cjs', 'new.ts', 'server.cjs']);
});
test('plan mode and denied execution cannot run project scripts', async t => {
  const root = await fixture(t), tools = new WorkspaceTools(root);
  let approvals = 0;
  const plan = await verifyProject({ tools, config: { ...config({ scripts: ['lint'] }), plan: true }, approve: async () => { approvals++; return true; } });
  assert.equal(plan.status, 'planned'); assert.equal(approvals, 0);
  await assert.rejects(fs.stat(path.join(root, 'checked.txt')));
  const denied = await verifyProject({ tools, config: { ...config({ scripts: ['lint'] }), permissions: { shell: 'deny' } }, approve: async () => { approvals++; return true; } });
  assert.equal(denied.status, 'incomplete'); assert.equal(approvals, 0); assert.equal(denied.steps[0].status, 'blocked');
  await assert.rejects(fs.stat(path.join(root, 'checked.txt')));
});
test('selected scripts run with separate pass/fail/skip results and HTML output', async t => {
  const root = await fixture(t);
  const report = await verifyProject({ tools: new WorkspaceTools(root), config: config({ scripts: ['lint', 'fail'] }), approve: async () => true });
  assert.equal(report.status, 'failed'); assert.equal(report.steps[0].status, 'passed'); assert.equal(report.steps[1].status, 'failed'); assert.equal(report.steps[2].status, 'skipped');
  assert.match(await fs.readFile(report.html, 'utf8'), /OSCODE verification/);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('OSCODE_')));
  const cli = await exec(process.execPath, [path.resolve('bin/oscode.js'), 'verify', '--cwd', root, '--allow-shell'], { env });
  assert.match(cli.stdout, /passed/); assert.match(cli.stdout, /index.html/);
});
test('dev server detection, startup timeout and cancellation clean up owned process groups', async t => {
  const root = await fixture(t);
  assert.equal(localUrl('\u001b[32mLocal: http://localhost:5173/\u001b[0m'), 'http://localhost:5173/');
  assert.equal(localUrl('https://example.com'), undefined);
  const server = await startDevServer({ command: process.execPath, args: ['server.cjs'], cwd: root });
  const pid = Number(await fs.readFile(path.join(root, 'server.pid'), 'utf8'));
  await assert.rejects(startDevServer({ command: process.execPath, args: ['server.cjs'], cwd: root, url: server.url }), /already responds/);
  assert.equal((await fetch(server.url)).status, 200);
  await server.stop(); assert.throws(() => process.kill(pid, 0));
  await fs.writeFile(path.join(root, 'hang.cjs'), "require('node:fs').writeFileSync('hang.pid',String(process.pid));setInterval(()=>{},1000)");
  await assert.rejects(startDevServer({ command: process.execPath, args: ['hang.cjs'], cwd: root, timeout: 1000 }), /timed out/);
  let hangPid = Number(await fs.readFile(path.join(root, 'hang.pid'), 'utf8'));
  assert.throws(() => process.kill(hangPid, 0));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 400);
  await assert.rejects(startDevServer({ command: process.execPath, args: ['hang.cjs'], cwd: root, signal: controller.signal }));
  clearTimeout(timer);
  hangPid = Number(await fs.readFile(path.join(root, 'hang.pid'), 'utf8'));
  assert.throws(() => process.kill(Number(hangPid), 0));
});
test('verify starts a development server, checks real Chromium and stops its child process', async t => {
  try { const { chromium } = await import('playwright'); await fs.access(chromium.executablePath()); } catch { if (process.env.CI) throw Error('CI needs Chromium'); t.skip(); return; }
  const root = await fixture(t);
  const report = await verifyProject({ tools: new WorkspaceTools(root), config: config({ scripts: [], devScript: 'dev' }), approve: async () => true });
  assert.equal(report.status, 'passed', JSON.stringify(report)); assert.equal(report.server.stopped, true);
  const pid = Number(await fs.readFile(path.join(root, 'server.pid'), 'utf8'));
  assert.throws(() => process.kill(pid, 0));
  assert.equal(report.ui.results.length, 3);
  assert.match(await fs.readFile(report.html, 'utf8'), /\.\.\/ui-.*mobile.png/);
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(new URL('file://' + report.html).href);
    assert.equal(await page.locator('h1').innerText(), 'OSCODE verification');
    assert.equal(await page.locator('img').count(), 3);
    assert.ok(await page.locator('img').first().evaluate(img => img.complete && img.naturalWidth > 0));
  } finally { await browser.close(); }
});

test('unchanged and documentation-only work skips execution, while plan blocks verify tool', async t => {
  const root = await fixture(t);
  await exec('git', ['init', '-q'], { cwd: root });
  await exec('git', ['add', '.'], { cwd: root });
  await exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.test', 'commit', '-qm', 'initial'], { cwd: root });
  await fs.writeFile(path.join(root, 'README.md'), 'docs');
  const report = await verifyProject({ tools: new WorkspaceTools(root), config: config({ scripts: ['lint'] }), changed: true, approve: async () => { throw Error('Should not request execution'); } });
  assert.equal(report.status, 'skipped');
  await assert.rejects(fs.stat(path.join(root, 'checked.txt')));
  const result = await new WorkspaceTools(root, { readOnly: true, approve: async () => true }).execute('verify_project', {});
  assert.equal(result.is_error, true); assert.match(result.content, /Plan mode/);
});
