import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { checkUi } from '../src/ui-check.js';
import { validateScenario, approveBaseline } from '../src/ui-workflow.js';
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oscode-workflow-')));
  t.after(() => fs.rm(root, { recursive: true, force: true })); return root;
}
test('scenario schema rejects arbitrary code, missing fields and unbounded steps', () => {
  for (const data of [{ steps: [] }, { steps: [{ action: 'eval', selector: 'body' }] }, { steps: [{ action: 'fill', selector: 'input' }] }, { steps: Array(21).fill({ action: 'click', selector: 'button' }) }]) assert.throws(() => validateScenario(data));
  assert.ok(validateScenario({ steps: [{ action: 'fill', selector: 'input', value: '' }] }));
});
test('real browser runs scenarios, traces failures, audits a11y and compares explicitly approved baselines', async t => {
  let chromium; try { ({ chromium } = await import('playwright')); await fs.access(chromium.executablePath()); } catch { if (process.env.CI) throw Error('CI needs Chromium'); t.skip('Chromium unavailable'); return; }
  const root = await fixture(t); let changed = false;
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(`<html lang="en"><head><title>Fixture</title><link rel="icon" href="data:,"><style>body{background:${changed ? '#88ccff' : '#ffffff'};color:black}</style></head><body><main><h1>Sign in</h1><label for="name">Name</label><input id="name"><button id="submit" onclick="document.querySelector('#result').textContent='Saved'">Save</button><p id="result"></p><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></main></body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const scenario = { steps: [{ action: 'fill', selector: '#name', value: 'Ada' }, { action: 'click', selector: '#submit' }, { action: 'text', selector: '#result', value: 'Saved' }] };
  const first = await checkUi({ root, url, viewport: 'mobile', scenario, a11y: true });
  assert.equal(first.incomplete, false, JSON.stringify(first)); assert.equal(first.results[0].scenario.passed, true);
  assert.ok(first.results[0].accessibility.violations.some(v => v.id === 'image-alt'));
  assert.ok((await fs.stat(first.results[0].trace)).size > 0);
  await approveBaseline(root, path.basename(first.directory), 'login');
  await assert.rejects(approveBaseline(root, path.basename(first.directory), 'login'), /EEXIST/);
  const same = await checkUi({ root, url, viewport: 'mobile', scenario, a11y: true, baseline: 'login' });
  assert.equal(same.incomplete, false, JSON.stringify(same)); assert.equal(same.results[0].visual.changed, false);
  changed = true;
  const different = await checkUi({ root, url, viewport: 'mobile', scenario, baseline: 'login' });
  assert.equal(different.results[0].visual.changed, true); assert.ok((await fs.stat(different.results[0].visual.diff)).size > 0);
  const mismatch = await checkUi({ root, url: url + '?other=1', viewport: 'mobile', scenario, baseline: 'login' });
  assert.equal(mismatch.incomplete, true); assert.match(mismatch.results[0].error, /does not match/);
  const failed = await checkUi({ root, url, viewport: 'mobile', scenario: { steps: [{ action: 'text', selector: '#submit', value: 'Wrong' }] } });
  assert.equal(failed.results[0].scenario.passed, false); assert.ok(failed.findings > 0);
  await assert.rejects(approveBaseline(root, path.basename(failed.directory), 'bad'), /failed scenario/);
  await assert.rejects(approveBaseline(root, '../outside', 'bad'));
});
