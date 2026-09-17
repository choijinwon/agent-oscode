import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { emptyUsage, addUsage } from './context.js';

export function newSession(root) {
  return { version: 1, id: randomUUID(), root, created: new Date().toISOString(), turns: [], usage: emptyUsage(), memory: '', omitted: 0 };
}
export async function sessionDirectory(root) {
  const dir = path.join(root, '.oscode');
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  if ((await fs.lstat(dir)).isSymbolicLink()) throw new Error('.oscode must not be a symlink.');
  return dir;
}
export async function saveSession(session) {
  const dir = await sessionDirectory(session.root);
  const temporary = path.join(dir, `${session.id}.${randomUUID()}.tmp`);
  await fs.writeFile(temporary, JSON.stringify(session, null, 2), { mode: 0o600, flag: 'wx' });
  await fs.rename(temporary, path.join(dir, `${session.id}.json`));
}
export async function loadSession(root, id) {
  const dir = await sessionDirectory(root);
  if (id === 'latest') {
    const items = await Promise.all((await fs.readdir(dir)).filter(x => /^[a-f0-9-]{36}\.json$/.test(x)).map(async name => ({ name, stat: await fs.lstat(path.join(dir, name)) })));
    const latest = items.filter(x => x.stat.isFile()).sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)[0];
    if (!latest) throw new Error('No saved sessions.');
    id = latest.name.slice(0, -5);
  }
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid session ID.');
  const file = path.join(dir, `${id}.json`);
  if ((await fs.lstat(file)).isSymbolicLink()) throw new Error('Session must not be a symlink.');
  const session = JSON.parse(await fs.readFile(file, 'utf8'));
  if (session.version !== 1 || session.id !== id || session.root !== root || !Array.isArray(session.turns) || !session.usage) throw new Error('Invalid session or workspace mismatch.');
  for (const turn of session.turns) {
    if (turn.status !== 'running') continue;
    for (const record of turn.requests || []) {
      if (record.status !== 'pending' || record.usage) continue;
      record.status = 'unknown';
      record.usage = { input: record.inputEstimate, output: record.maxOutput, cacheRead: 0, cacheWrite: 0, requests: 1, estimated: 1 };
      addUsage(turn.usage, record.usage); addUsage(session.usage, record.usage);
    }
    const completed = new Set(turn.messages.filter(m => m.role === 'tool').map(m => m.tool_call_id));
    for (const call of turn.messages.flatMap(m => m.tool_calls || [])) {
      if (!completed.has(call.id)) turn.messages.push({ role: 'tool', tool_call_id: call.id, is_error: true, content: 'Execution was interrupted. This result is unknown; inspect files and checkpoints before acting. Do not assume the operation was not executed.' });
    }
    const plan = session.plans?.find(p => p.id === (turn.executionPlanId || turn.planId));
    if (plan) {
      plan.status = turn.executionPlanId ? 'interrupted' : 'failed';
      if (turn.executionPlanId && plan.attempts?.length) plan.attempts.at(-1).status = 'interrupted';
    }
    turn.status = 'interrupted';
    turn.messages.push({ role: 'user', content: '[oscode resumed after interrupted execution. Verify current files; do not automatically repeat mutations.]' });
  }
  return session;
}
