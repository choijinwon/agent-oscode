import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const defaultBase = provider => provider === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://openrouter.ai/api/v1';
export const credentialFile = () => path.join(os.homedir(), '.oscode', 'credentials.json');
function slot(provider, base) {
  if (!['anthropic', 'compatible'].includes(provider)) throw new Error('Provider must be anthropic or compatible.');
  const url = new URL(base || defaultBase(provider));
  if (url.username || url.password || url.search || url.hash || !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)))) throw new Error('Invalid credentials endpoint. Use HTTPS or localhost HTTP.');
  return `${provider}:${url.href.replace(/\/$/, '')}`;
}
function read(file) {
  try {
    const directory = fs.lstatSync(path.dirname(file));
    if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error('Credential directory must not be a symlink.');
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536) throw new Error('Invalid credentials file.');
    if (process.platform !== 'win32' && (stat.mode & 0o077)) throw new Error('Credentials permissions must be 600.');
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!value || value.version !== 1 || !value.keys || typeof value.keys !== 'object' || Array.isArray(value.keys) || Object.values(value.keys).some(k => typeof k !== 'string' || k.length > 8192)) throw new Error('Invalid credentials file.');
    return value;
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, keys: {} };
    // Never include file content or parser excerpts, which may contain keys.
    throw new Error('Cannot safely read credentials. Check ~/.oscode/credentials.json and its permissions.');
  }
}
export function getCredential(provider, base, file = credentialFile()) {
  return read(file).keys[slot(provider, base)];
}
export function setCredential(provider, base, key, file = credentialFile()) {
  const id = slot(provider, base);
  if (key !== null && (typeof key !== 'string' || !key.trim() || key.length > 8192 || /[\s\x00-\x1f\x7f]/.test(key))) throw new Error('API key must be nonempty, at most 8192 characters, without whitespace.');
  const data = read(file);
  if (key === null) delete data.keys[id]; else data.keys[id] = key;
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (fs.lstatSync(dir).isSymbolicLink()) throw new Error('Credential directory must not be a symlink.');
  const temporary = path.join(dir, `credentials-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, JSON.stringify(data), { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally { try { fs.unlinkSync(temporary); } catch {} }
}
