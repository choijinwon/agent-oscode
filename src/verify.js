import fs from 'node:fs/promises';
import path from 'node:path';
import { runCommand } from './tools.js';
import { inspectFrontend } from './frontend.js';
import { inspectImpact } from './frontend-quality.js';
import { checkUi } from './ui-check.js';
import { sessionDirectory } from './session.js';
import { startDevServer } from './dev-server.js';

export function validateVerify(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('verify must be an object.');
  for (const key of Object.keys(value)) if (!['scripts', 'devScript', 'url', 'readyTimeout', 'scriptTimeout'].includes(key)) throw new Error(`Unknown verify option: ${key}`);
  const script = s => typeof s === 'string' && /^[\w][\w:.-]{0,79}$/.test(s);
  if (value.scripts !== undefined && (!Array.isArray(value.scripts) || value.scripts.length > 6 || !value.scripts.every(script))) throw new Error('verify.scripts requires up to 6 script names.');
  if (value.devScript !== undefined && !script(value.devScript)) throw new Error('Invalid verify.devScript.');
  if (value.url !== undefined) { const url = new URL(value.url); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid verify.url.'); }
  for (const key of ['readyTimeout', 'scriptTimeout']) if (value[key] !== undefined && (!Number.isInteger(value[key]) || value[key] < 1000 || value[key] > 120000)) throw new Error(`${key} must be 1000–120000 ms.`);
  return value;
}
export async function changedFiles(root, signal) {
  const names = new Set();
  for (const args of [['diff', 'HEAD', '--relative', '--no-renames', '--name-only', '-z', '--', '.'], ['ls-files', '--others', '--exclude-standard', '-z', '--', '.']]) {
    const result = await runCommand('git', args, { cwd: root, signal, maxBytes: 128000 });
    if (result.code !== 0 || result.truncated || result.cancelled || result.timedOut) throw new Error('Cannot obtain complete Git changes. --changed requires a repository with a HEAD commit.');
    for (const name of result.output.split('\0').filter(Boolean)) if (!name.split(/[\\/]/).some(p => ['.git', '.oscode', 'node_modules', 'dist', 'build', '.next', 'coverage'].includes(p) || /^\.env(?:\.|$)/.test(p))) names.add(name);
  }
  if (names.size > 500) throw new Error('More than 500 changed files; narrow the project.');
  return [...names].sort();
}
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function renderVerify(report) {
  const stepHtml = report.steps.map(s => `<article><h2>${escape(s.name)} <span class="${escape(s.status)}">${escape(s.status)}</span></h2><p>${escape(s.reason || '')}</p>${s.command ? `<pre>${escape(s.command)}</pre>` : ''}${s.output ? `<details><summary>Command output</summary><pre>${escape(s.output)}</pre></details>` : ''}</article>`).join('');
  const url = file => {
    if (!file) return null;
    const rel = path.relative(report.directory, file);
    // Only expose known sibling ui-run artifact names, never arbitrary report-provided links.
    return /^\.\.\/ui-[a-zA-Z0-9]{6}\/(mobile|tablet|desktop)(-diff)?\.png$/.test(rel) ? rel : null;
  };
  const images = (report.ui?.results || []).map(r => {
    const shot = url(r.screenshot), diff = url(r.visual?.diff);
    return `<article><h2>${escape(r.viewport)}</h2>${shot ? `<a href="${escape(shot)}"><img alt="${escape(r.viewport)} screenshot" src="${escape(shot)}"></a>` : ''}${diff ? `<img alt="Visual difference" src="${escape(diff)}">` : ''}<pre>${escape(JSON.stringify({ scenario: r.scenario, accessibility: r.accessibility, overflow: r.overflow, errors: r.errors, requests: r.requests, visual: r.visual, error: r.error }, null, 2))}</pre></article>`;
  }).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' file:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>OSCODE verification</title><style>body{font:16px system-ui;background:#10141b;color:#eef2f8;max-width:1000px;margin:auto;padding:28px}h1{font-size:32px}article{background:#1b2330;padding:20px;margin:18px 0;border-radius:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}img{max-width:100%;max-height:700px;object-fit:contain}span{font-size:14px}.passed{color:#7de2ae}.failed,.error,.blocked{color:#ffa4a4}.skipped{color:#ffdc8e}a{color:#9ad5ff}p{line-height:1.6}</style><h1>OSCODE verification</h1><p>Status: <strong>${escape(report.status)}</strong> · ${escape(report.created)}</p><p>Local report. No model API calls. Skipped checks are not passes.</p><details><summary>Changed files (${report.changed?.length || 0})</summary><pre>${escape((report.changed || []).join('\n'))}</pre></details><details><summary>Impact and test candidates</summary><pre>${escape(JSON.stringify(report.impact, null, 2))}</pre></details>${stepHtml}${images}<p>${escape(report.limitations)}</p></html>`;
}
export async function verifyProject({ tools, config, changed = false, start, url, signal, approve = async () => false, emit = () => {} }) {
  const options = validateVerify({ ...config.verify, ...(start ? { devScript: start } : {}), ...(url ? { url } : {}) });
  const changes = changed ? await changedFiles(tools.root, signal) : null;
  const stack = JSON.parse(await inspectFrontend(tools, '.', signal));
  let pkg = {};
  try { pkg = JSON.parse(await tools.text(await tools.resolve('package.json'))); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const manager = ['npm', 'pnpm', 'yarn', 'bun'].includes(stack.packageManager) ? stack.packageManager : null;
  const scripts = options.scripts ?? ['typecheck', 'lint'].filter(s => typeof pkg.scripts?.[s] === 'string');
  const workNeeded = !changed || changes.some(f => !/\.(md|txt|rst)$/.test(f));
  const report = { version: 1, created: new Date().toISOString(), changed: changes, impact: [], steps: [], status: 'planned', limitations: 'Git working-tree changes relative to HEAD, including staged/unstaged/untracked/deleted files. Impact is bounded and advisory. Configured scripts run at project scope; runner-specific test filtering is not guessed. Docs-only/no-change runs skip execution. UI checks use the supplied or detected URL; routes are not inferred.' };
  if (changed) {
    for (const file of changes.filter(f => /\.[cm]?[jt]sx?$/.test(f)).slice(0, 8)) {
      try { report.impact.push(JSON.parse(await inspectImpact(tools, file, signal))); }
      catch (e) { report.impact.push({ target: file, error: e.message }); }
    }
    if (changes.filter(f => /\.[cm]?[jt]sx?$/.test(f)).length > 8) report.impact.push({ note: 'Impact limited to first 8 changed source files.' });
  }
  for (const script of [...new Set(scripts)]) {
    report.steps.push({ name: script, command: manager ? `${manager} run ${script}` : null, script, status: !workNeeded ? 'skipped' : !manager || typeof pkg.scripts?.[script] !== 'string' ? 'blocked' : 'planned', reason: !workNeeded ? 'No non-document changes.' : !manager ? 'Package manager ambiguous; add packageManager or one lockfile.' : typeof pkg.scripts?.[script] !== 'string' ? 'Configured script missing.' : undefined });
  }
  if (!scripts.length) report.steps.push({ name: 'project scripts', status: 'skipped', reason: 'No typecheck/lint scripts found. Configure verify.scripts for tests/build/check.' });
  const uiStep = { name: 'browser', status: !workNeeded ? 'skipped' : options.url || options.devScript ? 'planned' : 'skipped', reason: !workNeeded ? 'No non-document changes.' : !options.url && !options.devScript ? 'No --url or --start configured.' : undefined };
  report.steps.push(uiStep);
  if (config.plan) return report;
  const dir = await fs.mkdtemp(path.join(await sessionDirectory(tools.root), 'verify-'));
  report.directory = dir; report.file = path.join(dir, 'report.json'); report.html = path.join(dir, 'index.html');
  const persist = async () => {
    await fs.writeFile(report.file, JSON.stringify(report, null, 2), { mode: 0o600 });
    await fs.writeFile(report.html, renderVerify(report), { mode: 0o600 });
  };
  let server;
  const allowed = async command => config.permissions?.shell !== 'deny' && !signal?.aborted && await approve('shell', command, signal);
  try {
    for (const step of report.steps.filter(s => s.script && s.status === 'planned')) {
      emit(step.command);
      if (!await allowed(`${step.command}\n${pkg.scripts[step.script]}`)) { step.status = 'blocked'; step.reason = signal?.aborted ? 'Cancelled.' : 'Execution not approved.'; continue; }
      step.status = 'running';
      const result = await runCommand(manager, ['run', step.script], { cwd: tools.root, signal, timeout: options.scriptTimeout || 60000, maxBytes: 12000 });
      step.status = result.code === 0 && !result.timedOut && !result.cancelled ? 'passed' : 'failed';
      step.output = result.output; step.exitCode = result.code;
      step.reason = result.timedOut ? 'Timed out.' : result.cancelled ? 'Cancelled.' : undefined;
      await persist();
    }
    if (uiStep.status === 'planned') {
      let target = options.url;
      if (options.devScript) {
        if (!manager || typeof pkg.scripts?.[options.devScript] !== 'string') throw new Error('Development script or package manager unavailable.');
        const command = `${manager} run ${options.devScript}`;
        emit(command);
        if (!await allowed(`${command}\n${pkg.scripts[options.devScript]}\nThen run browser diagnostics.`)) { uiStep.status = 'blocked'; uiStep.reason = 'Server/browser execution not approved.'; }
        else {
          server = await startDevServer({ command: manager, args: ['run', options.devScript], cwd: tools.root, url: target, signal, timeout: options.readyTimeout || 30000 });
          target = server.url; report.server = { pid: server.pid, url: target, owned: true, stopped: false };
        }
      } else if (!await allowed(`Browser diagnostics: ${target}`)) { uiStep.status = 'blocked'; uiStep.reason = 'Browser execution not approved.'; }
      if (uiStep.status === 'planned') {
        uiStep.status = 'running';
        report.ui = await checkUi({ root: tools.root, url: target, signal });
        uiStep.status = report.ui.incomplete ? 'error' : report.ui.findings ? 'failed' : 'passed';
      }
    }
  } catch (e) {
    for (const step of report.steps) if (step.status === 'running') { step.status = 'error'; step.reason = e.message; }
    report.steps.push({ name: 'verification runner', status: 'error', reason: e.message });
  } finally {
    if (server) { await server.stop(); report.server.stopped = true; report.server.output = server.logs(); }
    for (const step of report.steps) if (step.status === 'planned') { step.status = 'skipped'; step.reason = 'Runner stopped before execution.'; }
    report.status = signal?.aborted ? 'cancelled' : report.steps.some(s => ['error', 'blocked'].includes(s.status)) ? 'incomplete' : report.steps.some(s => s.status === 'failed') ? 'failed' : report.steps.some(s => s.status === 'passed') ? 'passed' : 'skipped';
    await persist();
  }
  return report;
}
