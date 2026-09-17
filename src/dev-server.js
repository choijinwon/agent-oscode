import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

export function localUrl(text) {
  for (const match of stripVTControlCharacters(text).matchAll(/https?:\/\/[^\s<>"']+/g)) {
    try {
      const url = new URL(match[0]);
      if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.username && !url.password) return url.href;
    } catch {}
  }
}
async function ready(url, signal) {
  try {
    const response = await fetch(url, { signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(750)]), redirect: 'manual' });
    await response.body?.cancel();
    return response.status >= 200 && response.status < 400;
  } catch { return false; }
}
export async function startDevServer({ command, args, cwd, url, signal, timeout = 30000 }) {
  if (signal?.aborted) throw new Error('Cancelled.');
  if (url && await ready(url, signal)) throw new Error('Configured URL already responds. Omit --start to use the existing server.');
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  let output = '', exited = false, error, stopped = false;
  const closed = new Promise(resolve => { child.once('close', () => { exited = true; resolve(); }); child.once('error', e => { error = e; exited = true; resolve(); }); });
  const capture = chunk => { output = (output + chunk.toString()).slice(-12000); };
  child.stdout.on('data', capture); child.stderr.on('data', capture);
  const kill = sig => { if (!child.pid) return; try { if (process.platform === 'win32') child.kill(sig); else process.kill(-child.pid, sig); } catch {} };
  const stop = async () => {
    if (stopped) return; stopped = true;
    kill('SIGTERM');
    await Promise.race([closed, delay(500)]);
    // Kill descendants even if the package-manager parent already exited.
    kill('SIGKILL'); await Promise.race([closed, delay(500)]);
    signal?.removeEventListener('abort', abort);
  };
  const abort = () => { kill('SIGTERM'); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      if (signal?.aborted) throw new Error('Cancelled.');
      if (exited) throw new Error(`Dev server exited before readiness: ${error?.message || output.slice(-1200)}`);
      const candidate = url || localUrl(output);
      if (candidate && await ready(candidate, signal)) return { url: candidate, pid: child.pid, stop, logs: () => output };
      await delay(150, undefined, { signal });
    }
    throw new Error('Dev server readiness timed out. Set an explicit --url if no local URL is printed.');
  } catch (e) { await stop(); throw e; }
}
