import {installRoutes} from './ui-network.js';
import { validateScenario, runScenario, captureKey, compareBaseline, auditAccessibility } from './ui-workflow.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { sessionDirectory } from './session.js';

export const viewports = { mobile: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1440, height: 900 } };
export function validateUiUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('UI check requires an HTTP(S) URL without embedded credentials.');
  return url.href;
}
function safeUrl(value) {
  try { const url = new URL(value); return `${url.origin}${url.pathname}`.slice(0, 300); } catch { return '[invalid URL]'; }
}
export async function checkUi({ root, url, viewport = 'all', signal, scenario, baseline, a11y = false, chromium: injected }) {
  url = validateUiUrl(url);
  if (scenario) validateScenario(scenario);
  if (viewport !== 'all' && !Object.hasOwn(viewports, viewport)) throw new Error('viewport must be all, mobile, tablet or desktop.');
  if (signal?.aborted) throw new Error('Cancelled.');
  let chromium = injected;
  if (!chromium) {
    try { ({ chromium } = await import('playwright')); }
    catch { throw new Error('Install optional dependency: npm install playwright; then npx playwright install chromium.'); }
  }
  let browser;
  try { browser = await chromium.launch({ headless: true, timeout: 15000 }); }
  catch { throw new Error('Chromium could not start. Run npx playwright install chromium and retry.'); }
  const abort = () => { browser.close().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 60000);
  try {
    if (signal?.aborted) throw new Error('Cancelled.');
    const dir = await fs.mkdtemp(path.join(await sessionDirectory(root), 'ui-'));
    const report = { version: 2, captureKey: captureKey(url, scenario), environment: { platform: process.platform, browser: browser.version() }, url: safeUrl(url), created: new Date().toISOString(), directory: dir, results: [], limitations: 'Page load and optional saved scenario; 500 ms settling, top-document DOM capped at 5000 elements. Overflow candidates may be intentional. Optional pixel comparison and automated accessibility checks; no complete accessibility audit or source-map attribution. Screenshots and messages may contain page data.' };
    for (const [name, size] of Object.entries(viewports).filter(([name]) => viewport === 'all' || name === viewport)) {
      if (signal?.aborted) throw new Error('Cancelled.');
      const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: false });
      try {
        if (scenario) await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
        const network=await installRoutes(context,url,scenario?.routes);
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        const result = { viewport: name, ...size, console: [], errors: [], requests: [], overflow: null, screenshot: null };
        const add = (array, item) => { if (array.length < 20 && !array.some(x => JSON.stringify(x) === JSON.stringify(item))) array.push(item); };
        page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) add(result.console, { type: msg.type(), text: msg.text().slice(0, 400), source: safeUrl(msg.location().url), line: msg.location().lineNumber }); });
        page.on('pageerror', error => add(result.errors, error.message.slice(0, 400)));
        page.on('requestfailed', request => add(result.requests, { url: safeUrl(request.url()), failure: request.failure()?.errorText?.slice(0, 160) }));
        page.on('response', response => { if (response.status() >= 400) add(result.requests, { url: safeUrl(response.url()), status: response.status(), simulated: network.isMocked(response.request()) }); });
        page.on('dialog', dialog => { dialog.dismiss().catch(() => {}); });
        try {
          const response = await page.goto(url, { waitUntil: 'load', timeout: 10000 });
          result.status = response?.status() ?? null;
          await page.waitForTimeout(500);
          if (scenario) result.scenario = await runScenario(page, scenario);
          if (a11y) result.accessibility = await auditAccessibility(page);
          result.overflow = await page.evaluate(() => {
            const width = document.documentElement.clientWidth;
            const all = document.querySelectorAll('body *');
            const candidates = [];
            for (let i = 0; i < Math.min(all.length, 5000); i++) {
              const el = all[i], rect = el.getBoundingClientRect(), style = getComputedStyle(el);
              if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') continue;
              if (rect.right <= width + 1 && rect.left >= -1) continue;
              const parts = []; let node = el;
              for (let j = 0; node && j < 5; j++, node = node.parentElement) {
                if (node.id) { parts.unshift(`#${CSS.escape(node.id)}`); break; }
                const siblings = node.parentElement ? [...node.parentElement.children].filter(x => x.tagName === node.tagName) : [node];
                parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
              }
              candidates.push({ selector: parts.join(' > ').slice(0, 250), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), position: style.position, overflowX: style.overflowX });
              if (candidates.length >= 20) break;
            }
            return { pixels: Math.max(0, document.documentElement.scrollWidth - width), candidates, scannedLimit: Math.min(all.length, 5000) };
          });
          const shot = path.join(dir, `${name}.png`);
          await page.screenshot({ path: shot, animations: 'disabled', timeout: 10000 });
          result.screenshot = shot;
          if (baseline) result.visual = await compareBaseline(root, baseline, report.captureKey, report.environment, name, shot, path.join(dir, `${name}-diff.png`));
        } catch (error) {
          result.error = String(error.message).slice(0, 400);
          try { const shot=path.join(dir, `${name}-failure.png`); await page.screenshot({path:shot,timeout:2000}); result.screenshot=shot; } catch {}
        }
        if (scenario) { result.trace = path.join(dir, `${name}-trace.zip`); await context.tracing.stop({ path: result.trace }); }
        result.simulation=network.summary();
        report.results.push(result);
      } finally { await context.close(); }
    }
    if (signal?.aborted) throw new Error('Cancelled.');
    report.findings = report.results.reduce((n, r) => n + (r.overflow?.pixels > 1 ? 1 : 0) + r.errors.length + r.requests.filter(item=>!item.simulated).length + r.console.length + (r.simulation?.enabled&&!r.simulation.complete?1:0) + (r.scenario && !r.scenario.passed ? 1 : 0) + (r.visual?.changed ? 1 : 0) + (r.accessibility?.totalViolations || 0), 0);
    report.incomplete = report.results.some(r => r.error || (r.simulation?.enabled&&!r.simulation.complete));
    report.file = path.join(dir, 'report.json');
    await fs.writeFile(report.file, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
    return report;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); await browser.close(); }
}
export function uiSummary(report) {
  return JSON.stringify({ report: report.file, findings: report.findings, incomplete: report.incomplete,
    results: report.results.map(r => ({ viewport: r.viewport, overflowPixels: r.overflow?.pixels, candidates: r.overflow?.candidates.slice(0, 3), errors: r.errors.slice(0, 2), console: r.console.slice(0, 2), requests: r.requests.slice(0, 2), screenshot: r.screenshot, scenario: r.scenario, simulation:r.simulation, trace: r.trace, visual: r.visual, accessibility: r.accessibility ? { totalViolations: r.accessibility.totalViolations, violations: r.accessibility.violations.slice(0, 2), incompleteRules: r.accessibility.incompleteRules } : undefined, ...(r.error ? { error: r.error } : {}) })),
    note: 'Bounded diagnostic summary; full report and screenshots are local. Findings are candidates, not proof of root cause. Rerun the affected viewport after fixes.' }, null, 2);
}
