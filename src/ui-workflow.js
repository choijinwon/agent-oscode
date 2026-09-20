import {validateRoutes} from './ui-network.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sessionDirectory } from './session.js';

export function validateScenario(data) {
  if (!data || Array.isArray(data) || typeof data !== 'object' || Object.keys(data).some(k => !['steps','routes'].includes(k)) || !Array.isArray(data.steps) || !data.steps.length || data.steps.length > 20) throw new Error('Scenario requires 1–20 steps.');
  validateRoutes(data.routes);
  const actions = { click: [], fill: ['value'], press: ['key'], visible: [], hidden: [], disabled: [], enabled: [], count: ['value'], text: ['value'] };
  for (const step of data.steps) {
    if (!step || !Object.hasOwn(actions, step.action)) throw new Error('Actions: click, fill, press, visible, hidden, disabled, enabled, count, text.');
    const keys = ['action', 'selector', ...actions[step.action]];
    if (Object.keys(step).some(k => !keys.includes(k)) || keys.some(k => (step.action === 'count' && k === 'value' ? !Number.isInteger(step[k]) || step[k] < 0 || step[k] > 5000 : typeof step[k] !== 'string' || step[k].length > 2000)) || !step.selector.trim()) throw new Error('Invalid scenario step. Use a selector and required value/key.');
  }
  return data;
}
export async function runScenario(page, scenario) {
  validateScenario(scenario);
  const results = [];
  for (const [index, step] of scenario.steps.entries()) {
    const item = { step: index + 1, action: step.action, selector: step.selector, passed: false };
    try {
      const locator = page.locator(step.selector);
      if (step.action === 'click') await locator.click({ timeout: 5000 });
      if (step.action === 'fill') await locator.fill(step.value, { timeout: 5000 });
      if (step.action === 'press') await locator.press(step.key, { timeout: 5000 });
      if (step.action === 'hidden') await locator.waitFor({ state: 'hidden', timeout: 5000 });
      if (['disabled', 'enabled', 'count'].includes(step.action)) {
        const until = Date.now() + 5000;
        while (true) {
          const matches = await locator.count();
          const passed = step.action === 'count' ? matches === step.value : matches === 1 && await locator.isVisible() &&
            (step.action === 'disabled' ? await locator.isDisabled({timeout:1000}) : await locator.isEnabled({timeout:1000}));
          if (passed) break;
          if (Date.now() >= until) throw new Error('Expected state did not appear.');
          await page.waitForTimeout(100);
        }
      }
      if (step.action === 'visible' || step.action === 'text') {
        await locator.waitFor({ state: 'visible', timeout: 5000 });
        if (step.action === 'text') {
          // Poll asynchronously rendered text instead of asserting immediately after visibility.
          const until = Date.now() + 5000;
          while (!(await locator.innerText({ timeout: 1000 })).includes(step.value)) {
            if (Date.now() >= until) throw new Error('Expected text did not appear.');
            await page.waitForTimeout(100);
          }
        }
      }
      item.passed = true;
    } catch { item.error = 'Step failed; inspect the local trace. Values are omitted from this summary.'; }
    results.push(item);
    if (!item.passed) break;
  }
  return { assertions: results.filter(r => ['visible','hidden','disabled','enabled','count','text'].includes(r.action) && r.passed).length, plannedSteps: scenario.steps.length, passed: results.length === scenario.steps.length && results.every(r => r.passed), steps: results };
}
export const captureKey = (url, scenario) => createHash('sha256').update(JSON.stringify({ url, scenario: scenario || null })).digest('hex');
const validName = name => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name);
async function plainDirectory(dir) {
  const stat = await fs.lstat(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Artifact directory must not be a symlink.');
  return dir;
}
async function readPlain(file, maxBytes = 12 * 1024 * 1024) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) throw new Error('Invalid or oversized artifact.');
  return fs.readFile(file);
}
async function baselineRoot(root, create = false) {
  const dir = path.join(await sessionDirectory(root), 'ui-baselines');
  if (create) await fs.mkdir(dir, { recursive: true });
  return plainDirectory(dir);
}
export async function approveBaseline(root, run, name) {
  if (!validName(name) || !/^ui-[a-zA-Z0-9]{6}$/.test(run)) throw new Error('Use a baseline name and a local ui-XXXXXX run ID.');
  const source = await plainDirectory(path.join(await sessionDirectory(root), run));
  const report = JSON.parse(await readPlain(path.join(source, 'report.json'), 1024 * 1024));
  if (report.incomplete || !report.captureKey || !Array.isArray(report.results) || !report.results.length || report.results.some(r => r.scenario && !r.scenario.passed)) throw new Error('Cannot approve an incomplete/failed scenario report.');
  const captures = [];
  for (const r of report.results) {
    if (!['mobile', 'tablet', 'desktop'].includes(r.viewport) || !r.screenshot) throw new Error('Invalid capture.');
    captures.push({ viewport: r.viewport, bytes: await readPlain(path.join(source, `${r.viewport}.png`)) });
  }
  const dir = path.join(await baselineRoot(root, true), name);
  await fs.mkdir(dir); // No implicit overwrite of an approved baseline.
  try {
    for (const capture of captures) await fs.writeFile(path.join(dir, `${capture.viewport}.png`), capture.bytes, { flag: 'wx' });
    await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ captureKey: report.captureKey, environment: report.environment, viewports: captures.map(c => c.viewport) }), { flag: 'wx' });
  } catch (error) { await fs.rm(dir, { recursive: true, force: true }); throw error; }
  return `Approved baseline ${name}. Existing baselines are immutable; choose a new name to replace one.`;
}
export async function compareBaseline(root, name, key, environment, viewport, screenshot, output) {
  if (!validName(name)) throw new Error('Invalid baseline name.');
  const dir = await plainDirectory(path.join(await baselineRoot(root), name));
  const meta = JSON.parse(await readPlain(path.join(dir, 'manifest.json'), 10000));
  if (meta.captureKey !== key || JSON.stringify(meta.environment) !== JSON.stringify(environment) || !meta.viewports.includes(viewport)) throw new Error('Baseline URL, scenario, browser/platform or viewport does not match.');
  const [{ PNG }, { default: pixelmatch }] = await Promise.all([import('pngjs'), import('pixelmatch')]);
  const decode = bytes => {
    if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.readUInt32BE(16) * bytes.readUInt32BE(20) > 4000000) throw new Error('Invalid or oversized PNG dimensions.');
    return PNG.sync.read(bytes);
  };
  const before = decode(await readPlain(path.join(dir, `${viewport}.png`)));
  const after = decode(await readPlain(screenshot));
  if (before.width !== after.width || before.height !== after.height) return { changed: true, reason: 'Image dimensions differ.' };
  const diff = new PNG({ width: after.width, height: after.height });
  const changedPixels = pixelmatch(before.data, after.data, diff.data, after.width, after.height, { threshold: 0.1 });
  if (changedPixels) await fs.writeFile(output, PNG.sync.write(diff), { flag: 'wx' });
  return { changed: changedPixels > 0, changedPixels, ratio: changedPixels / (after.width * after.height), diff: changedPixels ? output : null };
}
export async function auditAccessibility(page) {
  const { default: axe } = await import('axe-core');
  await page.evaluate(axe.source);
  return page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return { violations: result.violations.slice(0, 20).map(v => ({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, nodes: v.nodes.slice(0, 3).map(n => ({ target: n.target, summary: n.failureSummary })) })), totalViolations: result.violations.length, incompleteRules: result.incomplete.length, note: 'Automated WCAG checks only; manual keyboard and usability review still required.' };
  });
}
