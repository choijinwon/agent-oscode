import { inspectTokens, inspectImpact, storyRecipe } from './frontend-quality.js';
import { inspectArchitecture } from './architecture.js';
import { inspectComponent } from './components.js';
import { checkUi, uiSummary, validateUiUrl } from './ui-check.js';
import { inspectFrontend } from './frontend.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { clip } from './context.js';

const str = { type: 'string' }, bool = { type: 'boolean' }, integer = { type: 'integer' };
const tool = (name, description, properties, required) => ({ name, description, parameters: { type: 'object', properties, required, additionalProperties: false } });
export const toolDefinitions = [
  tool('tailwind_tokens', 'Inspect bounded CSS tokens and literal arbitrary Tailwind utility candidates without executing configuration.', { path: str }, []),
  tool('frontend_impact', 'AST-based reverse import impact for a project source file, including root tsconfig aliases and re-exports; bounded candidate analysis.', { path: str }, ['path']),
  tool('storybook_recipe', 'Generate a React default-export CSF story recipe with optional JSON state args and role/name visibility assertions. Read-only; apply via file tools.', { path: str, states: str, role: str, name: str }, ['path']),
  tool('frontend_architecture', 'Inspect bounded frontend folder roles, client directives and relative import cycle/layer candidates. Heuristic, read-only; verify source before proposing architecture changes.', { path: str }, []),
  tool('ui_component', 'Get a bounded MUI, Ant Design or Bootstrap component starter, dependencies, setup guidance and existing file candidates. Read-only; then adapt with existing edit/write tools in BUILD.', { library: str, component: str, path: str }, ['library']),
  tool('ui_check', 'Open a user-provided HTTP(S) app URL in isolated Chromium; capture viewport screenshots, overflow and browser errors. Requires shell permission; BUILD only. Artifacts stored locally. Page JavaScript/network requests run.', { url: str, viewport: str, scenario: str, baseline: str, a11y: bool }, ['url']),
  tool('frontend_inspect', 'Inspect frontend stack, scripts and bounded component/style/test paths without executing project code. Scope path to an app in monorepos.', { path: str }, []),
  tool('list_files', 'List project files, respecting Git ignore rules when Git is available. Use a subdirectory to narrow results.', { path: str }, []),
  tool('read_file', 'Read a bounded line range. Read a file before editing it.', { path: str, start: integer, lines: integer }, ['path']),
  tool('search', 'Find literal text in project files. Returns matching lines, capped at 60 hits.', { query: str, path: str }, ['query']),
  tool('edit_file', 'Replace one unique exact text occurrence in a previously read file. Fails if the file changed since reading.', { path: str, old_text: str, new_text: str }, ['path', 'old_text', 'new_text']),
  tool('write_file', 'Create a new file; never overwrite an existing file. Parent directory must exist.', { path: str, content: str }, ['path', 'content']),
  tool('shell', 'Run a shell command from the project root after permission. Working directory changes do not persist. Output and duration are bounded.', { command: str }, ['command'])
];
const ignored = new Set(['.git', '.oscode', 'node_modules', '.venv', 'venv', '__pycache__', 'dist', 'build', 'coverage', '.next', '.nuxt', '.output', '.svelte-kit', '.astro', 'storybook-static', 'playwright-report', 'test-results']);
function excluded(name) {
  return name.split(/[\\/]/).some(p => ignored.has(p) || /^\.env(?:\.|$)/.test(p) || /\.(pem|key|p12)$/i.test(p) || p === 'id_rsa' || p === 'id_ed25519');
}
const hash = text => createHash('sha256').update(text).digest('hex');

export function runCommand(command, args, { cwd, signal, timeout = 30000, maxBytes = 16000 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Cancelled.'));
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let output = '', size = 0, truncated = false, timedOut = false, killTimer;
    const kill = sig => { try { if (process.platform !== 'win32') process.kill(-child.pid, sig); else child.kill(sig); } catch {} };
    const stop = () => { kill('SIGTERM'); killTimer ||= setTimeout(() => kill('SIGKILL'), 500); };
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeout);
    const abort = () => stop();
    signal?.addEventListener('abort', abort, { once: true });
    const collect = chunk => { const left = Math.max(0, maxBytes - size); output += chunk.subarray(0, left).toString(); size += chunk.length; if (size > maxBytes) truncated = true; };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    const cleanup = () => { clearTimeout(timer); clearTimeout(killTimer); signal?.removeEventListener('abort', abort); };
    child.on('error', error => { cleanup(); reject(error); });
    child.on('close', (code, sig) => { cleanup(); resolve({ code, signal: sig, output, truncated, timedOut, cancelled: Boolean(signal?.aborted) }); });
  });
}

export class WorkspaceTools {
  constructor(root, { approve = async () => false, readOnly = false, outputLimit = 6000, onPreview = () => {}, checkpoints = null, permissions = {} } = {}) {
    this.checkpoints = checkpoints; this.permissions = permissions;
    this.root = root; this.approve = approve; this.readOnly = readOnly; this.outputLimit = outputLimit; this.onPreview = onPreview; this.reads = new Map();
  }
  async resolve(name = '.', create = false) {
    if (typeof name !== 'string' || name.includes('\0')) throw new Error('Invalid path.');
    const root = await fs.realpath(this.root);
    const candidate = path.resolve(root, name);
    const rel = path.relative(root, candidate);
    if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel) || excluded(rel)) throw new Error('Path is outside the allowed project files.');
    let actual;
    try { actual = await fs.realpath(candidate); }
    catch (error) {
      if (!create || error.code !== 'ENOENT') throw error;
      actual = path.join(await fs.realpath(path.dirname(candidate)), path.basename(candidate));
    }
    const realRel = path.relative(root, actual);
    if (realRel === '..' || realRel.startsWith(`..${path.sep}`) || path.isAbsolute(realRel) || excluded(realRel)) throw new Error('Symlink points outside the allowed project files.');
    return actual;
  }
  async text(file) {
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 512 * 1024) throw new Error('Only text files up to 512 KiB are supported; narrow the task.');
    const text = await fs.readFile(file, 'utf8');
    if (text.includes('\0')) throw new Error('Binary file is not supported.');
    return text;
  }
  async files(dir = '.', signal) {
    const target = await this.resolve(dir);
    if (!(await fs.stat(target)).isDirectory()) throw new Error('Expected a directory.');
    const git = await runCommand('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '.'], { cwd: target, signal, maxBytes: 256000 }).catch(() => null);
    if (git?.code === 0) {
      const relativeDir = path.relative(this.root, target);
      const names = git.output.split('\0');
      if (git.truncated) names.pop(); // Never use a partially captured filename.
      return [...new Set(names.filter(Boolean).map(f => path.join(relativeDir, f)))].filter(f => !excluded(f)).sort().slice(0, 3000);
    }
    const output = [];
    const walk = async (current, depth = 0) => {
      if (depth > 16 || output.length >= 3000 || signal?.aborted) return;
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (output.length >= 3000 || signal?.aborted) break;
        const file = path.join(current, entry.name), rel = path.relative(this.root, file);
        if (excluded(rel) || entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) await walk(file, depth + 1);
        else if (entry.isFile()) output.push(rel);
      }
    };
    await walk(target);
    return output;
  }
  validate(name, input) {
    const def = toolDefinitions.find(t => t.name === name);
    if (!def || !input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid tool or arguments.');
    for (const key of def.parameters.required) if (!(key in input)) throw new Error(`Missing ${key}.`);
    for (const [key, value] of Object.entries(input)) {
      const schema = def.parameters.properties[key];
      if (!schema || (schema.type === 'string' ? typeof value !== 'string' : schema.type === 'boolean' ? typeof value !== 'boolean' : !Number.isInteger(value))) throw new Error(`Invalid argument ${key}.`);
    }
  }
  async execute(name, input, signal) {
    try {
      this.validate(name, input);
      if (signal?.aborted) throw new Error('Cancelled.');
      const result = await this.perform(name, input, signal);
      return { content: clip(result, this.outputLimit), is_error: false };
    } catch (error) { return { content: clip(`Error: ${error.message}`, this.outputLimit), is_error: true }; }
  }
  async perform(name, input, signal) {
    const mutates = ['edit_file', 'write_file', 'shell', 'ui_check'].includes(name);
    if (mutates && this.readOnly) throw new Error('Plan mode allows only reading and searching.');
    if (mutates && this.permissions[['shell', 'ui_check'].includes(name) ? 'shell' : 'write'] === 'deny') throw new Error('Denied by project permissions.');
    if (name === 'ui_check') {
      validateUiUrl(input.url);
      this.onPreview(`Browser UI check: ${input.url} (${input.viewport || 'all'}); runs page scripts and saves local artifacts.`);
      if (!(await this.approve('shell', `Browser UI check: ${input.url}`, signal))) throw new Error('Browser execution denied.');
      const scenario = input.scenario ? JSON.parse(await this.text(await this.resolve(input.scenario))) : undefined;
      const report = await checkUi({ root: this.root, ...input, scenario, signal });
      return uiSummary(report);
    }
    if (name === 'tailwind_tokens') return inspectTokens(this, input.path, signal);
    if (name === 'frontend_impact') return inspectImpact(this, input.path, signal);
    if (name === 'storybook_recipe') return storyRecipe(this, input, signal);
    if (name === 'frontend_architecture') return inspectArchitecture(this, input.path, signal);
    if (name === 'ui_component') return inspectComponent(this, input, signal);
    if (name === 'frontend_inspect') return inspectFrontend(this, input.path, signal);
    if (name === 'list_files') {
      const files = await this.files(input.path, signal);
      return files.join('\n') + `\n[${files.length} files listed; maximum 3000]`;
    }
    if (name === 'read_file') {
      const file = await this.resolve(input.path), text = await this.text(file);
      const start = input.start ?? 1, count = input.lines ?? 100;
      if (start < 1 || count < 1 || count > 300) throw new Error('start must be positive; lines must be 1–300.');
      this.reads.set(file, hash(text));
      const lines = text.split('\n');
      return lines.slice(start - 1, start - 1 + count).map((line, i) => `${start + i}: ${line}`).join('\n') + `\n[${input.path}: ${lines.length} lines total]`;
    }
    if (name === 'search') {
      if (!input.query || input.query.length > 500) throw new Error('query must contain 1–500 characters.');
      const found = [];
      for (const name of await this.files(input.path, signal)) {
        if (signal?.aborted) throw new Error('Cancelled.');
        let text;
        try { text = await this.text(await this.resolve(name)); } catch { continue; }
        for (const [i, line] of text.split('\n').entries()) {
          if (line.includes(input.query)) found.push(`${name}:${i + 1}: ${clip(line, 300)}`);
          if (found.length >= 60) return found.join('\n') + '\n[60 matches; narrow the query]';
        }
      }
      return found.join('\n') || 'No matches in eligible text files.';
    }
    if (name === 'shell') {
      if (!input.command.trim() || input.command.length > 10000) throw new Error('Command must contain 1–10000 characters.');
      this.onPreview(`$ ${input.command}`);
      if (!(await this.approve('shell', input.command, signal))) throw new Error('Shell execution denied.');
      const result = await runCommand(process.env.SHELL || '/bin/sh', ['-c', input.command], { cwd: this.root, signal });
      this.reads.clear();
      if (result.code !== 0 || result.timedOut || result.cancelled) throw new Error(`Command exit=${result.code}, timeout=${result.timedOut}, cancelled=${result.cancelled}\n${result.output}`);
      return result.output + (result.truncated ? '\n[output truncated]' : '') + '\n[exit 0]';
    }
    if (name === 'write_file') {
      const file = await this.resolve(input.path, true);
      if (Buffer.byteLength(input.content) > 512 * 1024) throw new Error('File is too large.');
      this.onPreview(`Create ${input.path}\n${clip(input.content, 3000)}`);
      if (!(await this.approve('write', input.path, signal))) throw new Error('File creation denied.');
      if (signal?.aborted) throw new Error('Cancelled.');
      if (this.checkpoints) await this.checkpoints.apply(file, null, input.content);
      else await fs.writeFile(file, input.content, { flag: 'wx' });
      this.reads.set(file, hash(input.content));
      return `Created ${input.path}.`;
    }
    if (name === 'edit_file') {
      const file = await this.resolve(input.path), before = await this.text(file);
      if (this.reads.get(file) !== hash(before)) throw new Error('Read the current file before editing; it is unread or has changed.');
      if (!input.old_text || before.split(input.old_text).length !== 2) throw new Error('old_text must match exactly once. Include more surrounding context.');
      const after = before.replace(input.old_text, () => input.new_text);
      if (Buffer.byteLength(after) > 512 * 1024) throw new Error('Resulting file is too large.');
      this.onPreview(`Edit ${input.path}\n--- before\n${clip(input.old_text, 1500)}\n+++ after\n${clip(input.new_text, 1500)}`);
      if (!(await this.approve('write', input.path, signal))) throw new Error('Edit denied.');
      if (signal?.aborted) throw new Error('Cancelled.');
      if (hash(await this.text(file)) !== hash(before)) throw new Error('File changed during approval. Read again.');
      if (this.checkpoints) await this.checkpoints.apply(file, before, after);
      else await fs.writeFile(file, after);
      this.reads.set(file, hash(after));
      return `Updated ${input.path}.`;
    }
    throw new Error('Unknown tool.');
  }
}
