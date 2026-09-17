import fs from 'node:fs/promises';
import path from 'node:path';

export const profiles = {
  economy: { maxInput: 12000, maxOutput: 1500, budget: 40000, maxSteps: 8, outputLimit: 4000 },
  balanced: { maxInput: 24000, maxOutput: 3000, budget: 100000, maxSteps: 12, outputLimit: 6000 }
};
const numbers = ['budget', 'maxInput', 'maxOutput', 'maxSteps', 'outputLimit', 'loopLimit'];
const strings = ['model', 'baseUrl', 'testCommand'];
const allowed = new Set(['profile', 'provider', 'plan', 'permissions', 'pricing', ...numbers, ...strings]);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export function validateProjectConfig(data) {
  if (!object(data)) throw new Error('oscode.json must be an object.');
  for (const key of Object.keys(data)) if (!allowed.has(key)) throw new Error(`Unsupported oscode.json key: ${key}. API keys belong in environment variables.`);
  if (data.profile !== undefined && !Object.hasOwn(profiles, data.profile)) throw new Error('profile must be economy or balanced.');
  if (data.provider !== undefined && !['anthropic', 'compatible'].includes(data.provider)) throw new Error('provider must be anthropic or compatible.');
  for (const key of numbers) if (data[key] !== undefined && (!Number.isSafeInteger(data[key]) || data[key] < (key === 'loopLimit' ? 2 : 1))) throw new Error(`${key} must be a positive integer${key === 'loopLimit' ? ' >= 2' : ''}.`);
  if (data.outputLimit !== undefined && data.outputLimit < 200) throw new Error('outputLimit must be >= 200.');
  for (const key of strings) if (data[key] !== undefined && (typeof data[key] !== 'string' || !data[key].trim())) throw new Error(`${key} must be a nonempty string.`);
  if (data.plan !== undefined && typeof data.plan !== 'boolean') throw new Error('plan must be boolean.');
  if (data.permissions !== undefined) {
    if (!object(data.permissions)) throw new Error('permissions must be an object.');
    for (const [key, value] of Object.entries(data.permissions)) if (!['write', 'shell'].includes(key) || !['ask', 'deny'].includes(value)) throw new Error('Project permissions support write/shell: ask or deny. Automatic approval requires an explicit CLI flag.');
  }
  if (data.pricing !== undefined) {
    if (!object(data.pricing)) throw new Error('pricing must be an object.');
    for (const [provider, models] of Object.entries(data.pricing)) {
      if (!['anthropic', 'compatible'].includes(provider) || !object(models)) throw new Error('pricing must be grouped by provider, then exact model ID.');
      for (const rates of Object.values(models)) {
        if (!object(rates) || !Object.hasOwn(rates, 'input') || !Object.hasOwn(rates, 'output')) throw new Error('Each price entry requires input and output rates (USD / million tokens).');
        for (const [key, rate] of Object.entries(rates)) if (!['input', 'output', 'cacheRead', 'cacheWrite'].includes(key) || !Number.isFinite(rate) || rate < 0) throw new Error('Prices must be finite nonnegative numbers.');
      }
    }
  }
  return data;
}
export async function readProjectConfig(root) {
  const file = path.join(root, 'oscode.json');
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.size > 65536) throw new Error('oscode.json must be a regular file up to 64 KiB.');
    let data;
    try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch { throw new Error('oscode.json contains invalid JSON.'); }
    return validateProjectConfig(data);
  } catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}
export function resolveConfig(project = {}, args = {}, env = process.env) {
  validateProjectConfig(project);
  const profile = args.profile ?? env.OSCODE_PROFILE ?? project.profile ?? 'economy';
  if (!Object.hasOwn(profiles, profile)) throw new Error('Profile must be economy or balanced.');
  const merged = { ...profiles[profile], loopLimit: 3, ...project, profile,
    provider: args.provider ?? env.OSCODE_PROVIDER ?? project.provider ?? 'anthropic',
    model: args.model ?? env.OSCODE_MODEL ?? project.model,
    baseUrl: args['base-url'] ?? env.OSCODE_BASE_URL ?? project.baseUrl,
    plan: Boolean(args.plan || project.plan),
    permissions: { write: 'ask', shell: 'ask', ...project.permissions }
  };
  for (const [flag, key] of [['budget', 'budget'], ['max-input', 'maxInput'], ['max-output', 'maxOutput'], ['max-steps', 'maxSteps'], ['loop-limit', 'loopLimit']]) {
    const value = args[flag] ?? env[`OSCODE_${flag.toUpperCase().replaceAll('-', '_')}`];
    if (value !== undefined) merged[key] = Number(value);
  }
  validateProjectConfig(merged);
  if (args.demo) { merged.provider = 'demo'; merged.model = 'offline-demo'; merged.plan = true; }
  return merged;
}
export async function initConfig(root) {
  const sample = { profile: 'economy', budget: 40000, loopLimit: 3, permissions: { write: 'ask', shell: 'ask' } };
  await fs.writeFile(path.join(root, 'oscode.json'), JSON.stringify(sample, null, 2) + '\n', { flag: 'wx' });
}
