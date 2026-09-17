import { spawn } from 'node:child_process';

export function clipboardCommands(platform = process.platform, env = process.env) {
  if (platform === 'darwin') return [{ read: ['pbpaste'], write: ['pbcopy'] }];
  if (platform === 'win32') return [{
    read: ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Clipboard -Raw'],
    write: ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', '[Console]::InputEncoding = [System.Text.Encoding]::UTF8; $text = [Console]::In.ReadToEnd(); Set-Clipboard -Value $text']
  }];
  if (platform === 'linux') return [
    ...(env.WAYLAND_DISPLAY ? [{ read: ['wl-paste', '--no-newline'], write: ['wl-copy'] }] : []),
    ...(env.DISPLAY ? [{ read: ['xclip', '-selection', 'clipboard', '-o'], write: ['xclip', '-selection', 'clipboard', '-i'] }, { read: ['xsel', '--clipboard', '--output'], write: ['xsel', '--clipboard', '--input'] }] : [])
  ];
  return [];
}
export function runClipboard(command, input, { spawnProcess = spawn, maxBytes = 1024 * 1024, timeout = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command[0], command.slice(1), { stdio: ['pipe', 'pipe', 'pipe'], shell: false });
    const chunks = []; let size = 0, failure;
    const timer = setTimeout(() => { failure = new Error('Clipboard command timed out.'); child.kill(); }, timeout);
    child.stdout.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) { failure = new Error('Clipboard exceeds 1 MiB; paste a smaller excerpt.'); child.kill(); }
      else chunks.push(chunk);
    });
    child.stderr.resume(); // Do not print arbitrary clipboard utility output.
    child.stdin.on('error', () => {});
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); if (failure) reject(failure); else if (code !== 0) reject(new Error('Clipboard command failed. Check desktop clipboard access.')); else resolve(Buffer.concat(chunks).toString('utf8')); });
    child.stdin.end(input ?? '');
  });
}
export async function accessClipboard(action, text = '', { platform = process.platform, env = process.env, run = runClipboard } = {}) {
  if (!['read', 'write'].includes(action)) throw new Error('Invalid clipboard action.');
  if (typeof text !== 'string' || Buffer.byteLength(text) > 1024 * 1024) throw new Error('Clipboard text must be at most 1 MiB.');
  for (const commands of clipboardCommands(platform, env)) {
    try { return await run(commands[action], action === 'write' ? text : undefined); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  throw new Error('No clipboard utility available. macOS: pbcopy/pbpaste; Linux: wl-clipboard or xclip/xsel with a desktop session; Windows: PowerShell.');
}
export function lastAnswer(session, codeOnly = false) {
  const turn = [...(session.archive || []), ...session.turns].filter(t => t.status === 'done').at(-1);
  const answer = turn?.messages.filter(m => m.role === 'assistant' && !m.tool_calls?.length && typeof m.content === 'string' && m.content.trim()).at(-1)?.content;
  if (!answer) throw new Error('No completed assistant answer to copy.');
  if (!codeOnly) return answer;
  const blocks = [...answer.matchAll(/^```[^\r\n]*\r?\n([\s\S]*?)^```[ \t]*$/gm)].map(m => m[1].replace(/\r?\n$/, ''));
  if (!blocks.length) throw new Error('The last answer contains no fenced code blocks.');
  return blocks.join('\n\n');
}
export class PasteDraft {
  constructor() { this.text = ''; }
  load(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('Clipboard is empty.');
    if (Buffer.byteLength(text) > 1024 * 1024) throw new Error('Clipboard exceeds 1 MiB.');
    this.text = text; return text;
  }
  clear() { this.text = ''; }
  take() { const text = this.text; if (!text.trim()) throw new Error('No pasted draft. Use /paste first.'); this.clear(); return text; }
}
