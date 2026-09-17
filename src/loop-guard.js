import { createHash } from 'node:crypto';
import path from 'node:path';
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class LoopGuard {
  constructor(limit = 3) { this.limit = limit; this.calls = new Map(); this.failureRun = 0; }
  key(call) {
    const input = { ...call.input };
    if (typeof input.path === 'string') input.path = path.normalize(input.path);
    if (typeof input.command === 'string') input.command = input.command.trim();
    return digest({ name: call.name, input: canonical(input) });
  }
  check(call) {
    const previous = this.calls.get(this.key(call));
    if (previous?.count >= this.limit - 1) return `Repeated ${call.name} call returned the same result ${previous.count} times; blocked before attempt ${previous.count + 1}. Change the approach before continuing.`;
    if (this.failureRun >= this.limit) return `${this.failureRun} consecutive tool failures; stopped to avoid spending more tokens.`;
    return null;
  }
  failureReason() { return this.failureRun >= this.limit ? `${this.failureRun} consecutive tool failures; stopped to avoid spending more tokens.` : null; }
  observe(call, result) {
    if (!result.is_error && ['edit_file', 'write_file'].includes(call.name)) { this.calls.clear(); this.failureRun = 0; return; }
    const key = this.key(call), fingerprint = digest(result), previous = this.calls.get(key);
    this.calls.set(key, { fingerprint, count: previous?.fingerprint === fingerprint ? previous.count + 1 : 1 });
    this.failureRun = result.is_error ? this.failureRun + 1 : 0;
  }
}
