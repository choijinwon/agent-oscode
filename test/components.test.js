import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { componentRecipe } from '../src/components.js';
import { WorkspaceTools } from '../src/tools.js';
import { runTurn } from '../src/agent.js';
import { resolveConfig } from '../src/config.js';
import { newSession } from '../src/session.js';
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oscode-components-')));
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { react: '^19', antd: '^6' } }));
  await fs.writeFile(path.join(root, 'Button.jsx'), 'export default function Button() { return null; }');
  return root;
}
const cli = (root, ...args) => promisify(execFile)(process.execPath, [path.resolve('bin/oscode.js'), '--cwd', root, ...args], { env: Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('OSCODE_') && k !== 'ANTHROPIC_API_KEY')) });
test('catalog exposes 15 starters and rejects unknown/prototype names', () => {
  for (const library of ['mui', 'antd', 'bootstrap']) {
    assert.equal(componentRecipe(library).components.length, 5);
    for (const name of componentRecipe(library).components) {
      const recipe = componentRecipe(library, name);
      assert.ok(recipe.code.length > 30); assert.ok(recipe.docs.startsWith('https://'));
      assert.equal(recipe.extension, library === 'bootstrap' ? '.html' : '.jsx');
    }
  }
  for (const [library, name] of [['bad', 'button'], ['mui', 'toString'], ['__proto__', 'button']]) assert.throws(() => componentRecipe(library, name));
});
test('component inspection includes project declarations and reusable candidates with no writes', async t => {
  const root = await fixture(t), tools = new WorkspaceTools(root, { readOnly: true });
  const report = JSON.parse((await tools.execute('ui_component', { library: 'antd', component: 'button' })).content);
  assert.equal(report.declaredVersion, '^6'); assert.deepEqual(report.missingPackages, []); assert.deepEqual(report.existingCandidates, ['Button.jsx']);
  assert.equal((await tools.execute('ui_component', { library: 'mui', path: '..' })).is_error, true);
  await fs.unlink(path.join(root, 'package.json'));
  const plain = JSON.parse((await tools.execute('ui_component', { library: 'mui', component: 'card' })).content);
  assert.equal(plain.reactDeclared, false); assert.match(plain.caution, /React not declared/);
});
test('CLI previews without API credentials and creates only explicitly approved new files', async t => {
  const root = await fixture(t);
  assert.match((await cli(root, '--component', 'antd/button')).stdout, /ActionButton/);
  await assert.rejects(cli(root, '--component', 'antd/button', '--output', 'New.jsx'), e => /--yes/.test(e.stdout));
  await assert.rejects(fs.stat(path.join(root, 'New.jsx')));
  await cli(root, '--component', 'antd/button', '--output', 'New.jsx', '--yes');
  assert.equal(await fs.readFile(path.join(root, 'New.jsx'), 'utf8'), componentRecipe('antd', 'button').code);
  await assert.rejects(cli(root, '--component', 'mui/button', '--output', 'New.jsx', '--yes'));
  assert.match(await fs.readFile(path.join(root, 'New.jsx'), 'utf8'), /from 'antd'/);
  await assert.rejects(cli(root, '--component', 'bootstrap/button', '--output', 'Bad.jsx', '--yes'), e => /requires .html/.test(e.stdout));
});
test('plan and project denial block starter creation, including --yes', async t => {
  const root = await fixture(t);
  await assert.rejects(cli(root, '--component', 'mui/card', '--output', 'Card.jsx', '--plan', '--yes'), e => /Plan mode/.test(e.stdout));
  await fs.writeFile(path.join(root, 'oscode.json'), '{"permissions":{"write":"deny"}}');
  await assert.rejects(cli(root, '--component', 'mui/card', '--output', 'Card.jsx', '--yes'), e => /Denied/.test(e.stdout));
  await assert.rejects(fs.stat(path.join(root, 'Card.jsx')));
});
test('frontend agent can retrieve and apply a recipe via approved file tools', async t => {
  const root = await fixture(t); let step = 0;
  await fs.writeFile(path.join(root, 'App.jsx'), 'export default function App() { return null; }');
  const tools = new WorkspaceTools(root, { approve: async () => true });
  const actions = [
    { name: 'ui_component', input: { library: 'antd', component: 'button' } },
    { name: 'write_file', input: { path: 'ActionButton.jsx', content: componentRecipe('antd', 'button').code } },
    { name: 'read_file', input: { path: 'App.jsx' } },
    { name: 'edit_file', input: { path: 'App.jsx', old_text: 'export default function App() { return null; }', new_text: "import ActionButton from './ActionButton.jsx';\nexport default function App() { return <ActionButton />; }" } }
  ];
  await runTurn({ session: newSession(root), prompt: 'Apply an Ant Design button', config: resolveConfig({}, { agent: 'frontend' }, {}), tools, signal: new AbortController().signal,
    provider: { complete: async req => {
      assert.ok(req.tools.some(t => t.name === 'ui_component'));
      const action = actions[step++]; return { content: action ? '' : 'Applied', calls: action ? [{ id: String(step), ...action }] : [], usage: { input: 10, output: 10, requests: 1 } };
    } } });
  assert.match(await fs.readFile(path.join(root, 'App.jsx'), 'utf8'), /<ActionButton/);
});
