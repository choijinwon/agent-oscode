import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WorkspaceTools } from '../src/tools.js';
import { dependencyImpact, impactText } from '../src/frontend-dependencies.js';
import { estimateTokens } from '../src/context.js';

async function fixture(t, files) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oscode-deps-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (file, text) => { await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true }); await fs.writeFile(path.join(root, file), text); };
  for (const [file, text] of Object.entries(files)) await write(file, text);
  return { root, write, tools: new WorkspaceTools(root, { readOnly: true }) };
}
const shared = {
  'src/tokens.css': ':root { --color: red; } /* SOURCE_BODY_NOT_SENT */',
  'src/shared.scss': '@import "./tokens.css";',
  'src/_space.scss': '$gap: 8px;',
  'src/views/ReactPage.tsx': 'import "../shared.scss"; export const ReactPage = () => <button />;',
  'src/views/VuePage.vue': '<template><button /></template>\n<script setup>import "../shared.scss";</script>',
  'src/views/SveltePage.svelte': '<script>import "../shared.scss";</script><button />',
  'src/views/app.component.ts': "import { Component } from '@angular/core';\n@Component({templateUrl:'app.html', styleUrls:['../shared.scss']}) export class App {}",
  'src/views/app.html': '<button>Save</button>',
  'src/App.spec.ts': "import './views/ReactPage'; import './views/VuePage.vue'; import './views/SveltePage.svelte'; import './views/app.component';",
  'src/unrelated.ts': 'export const unrelated = 1;',
};

test('shared style impact traces all four frameworks and a test with source-line evidence', async t => {
  const { tools } = await fixture(t, shared);
  const raw = await dependencyImpact(tools, 'src/tokens.css', undefined, 4000), report = JSON.parse(raw);
  assert.equal(report.partial, false); assert.equal(report.totalAffected, 6);
  for (const file of ['ReactPage.tsx', 'VuePage.vue', 'SveltePage.svelte', 'app.component.ts']) assert(report.pageCandidates.includes('src/views/' + file));
  assert.deepEqual(report.testCandidates, ['src/App.spec.ts']);
  const text = impactText(report); assert.match(text, /테스트 · src\/App.spec.ts/); assert.match(text, /app.component.ts:2/); assert.match(text, /모델 토큰 절감량이 아닙니다/);
  const chain = report.evidence.find(item => item.file === 'src/views/app.component.ts').chain;
  assert.deepEqual(chain.map(edge => [edge.from, edge.to, edge.kind, edge.line]), [['src/views/app.component.ts', 'src/shared.scss', 'style', 2], ['src/shared.scss', 'src/tokens.css', 'style', 1]]);
  assert(!raw.includes('SOURCE_BODY_NOT_SENT')); assert(!report.affectedFiles.includes('src/unrelated.ts'));
  const template = JSON.parse(await dependencyImpact(tools, 'src/views/app.html'));
  assert(template.affectedFiles.includes('src/views/app.component.ts')); assert(template.testCandidates.includes('src/App.spec.ts'));
});

test('hash cache invalidates changed and deleted files, and aliases resolve afresh', async t => {
  const { root, tools, write } = await fixture(t, { 'a.ts': 'export const a=1;', 'b.ts': 'export const b=2;', 'use.ts': 'import "@target";', 'tsconfig.json': '{"compilerOptions":{"paths":{"@target":["a.ts"]}}}' });
  assert.deepEqual(JSON.parse(await dependencyImpact(tools, 'a.ts')).affectedFiles, ['use.ts']);
  const cached = JSON.parse(await dependencyImpact(tools, 'a.ts')); assert.deepEqual(cached.cache, { hits: 3, parsed: 0 });
  await write('tsconfig.json', '{"compilerOptions":{"paths":{"@target":["b.ts"]}}}');
  assert.deepEqual(JSON.parse(await dependencyImpact(tools, 'a.ts')).affectedFiles, []);
  await write('use.ts', "import './a';");
  assert.equal(JSON.parse(await dependencyImpact(tools, 'a.ts')).cache.parsed, 1);
  await fs.unlink(path.join(root, 'use.ts'));
  assert.deepEqual(JSON.parse(await dependencyImpact(tools, 'a.ts')).affectedFiles, []);
  assert(!tools.frontendDependencyCache.has('use.ts'));
});

test('styles, SFC blocks, cycles and module suffixes work without matching comments or quoted directives', async t => {
  const { tools } = await fixture(t, {
    'theme.css': ':root{}', '_spacing.scss': '$size: 1px;',
    'Card.vue': '<!-- <script>import "./phantom.ts";</script> -->\n<script setup src="./external.ts"></script><style>@use "spacing"; @import "./theme.css";</style>',
    'external.ts': 'export const x=1;', 'Page.svelte': '<script>import Card from "./Card.vue";</script>',
    'a.mts': 'export * from "./b.mjs";', 'b.mts': 'export * from "./a.mjs";',
    'noise.css': '/* @import "./theme.css"; */ .x{content:"@import \'./theme.css\'";}',
    'noise.ts': '// import "./theme.css";\nconst x="import theme";',
  });
  const report = JSON.parse(await dependencyImpact(tools, 'theme.css'));
  assert.equal(report.partial, false); assert.deepEqual([...report.affectedFiles].sort(), ['Card.vue', 'Page.svelte']);
  assert.equal(JSON.parse(await dependencyImpact(tools, '_spacing.scss')).totalAffected, 2);
  assert.equal(JSON.parse(await dependencyImpact(tools, 'external.ts')).totalAffected, 2);
  assert.deepEqual(JSON.parse(await dependencyImpact(tools, 'a.mts')).affectedFiles, ['b.mts']);
});

test('unresolved imports, parser failures and non-literal dependencies are reported as partial', async t => {
  const { tools } = await fixture(t, { 'a.ts': 'export const a=1;', 'broken.ts': 'export const = ;', 'lazy.ts': 'const n="a"; import(n); import "./missing";', 'theme.css': '@import url(unquoted.css);' });
  const result = JSON.parse(await dependencyImpact(tools, 'a.ts'));
  assert(result.partial); assert(result.unresolved.some(item => item.specifier === './missing'));
  assert(result.issues.some(item => item.reason === 'script parse diagnostics')); assert(result.issues.some(item => item.reason === 'non-literal dynamic import'));
  assert(result.issues.some(item => item.reason === 'unresolved style import syntax'));
});

test('bounded output distinguishes omitted results from incomplete scanning and never implies full coverage', async t => {
  const files = { 'theme.css': ':root{}' };
  for (let i = 0; i < 100; i++) files[`Page${i}.tsx`] = 'import "./theme.css";';
  const { tools } = await fixture(t, files);
  const raw = await dependencyImpact(tools, 'theme.css', undefined, 800), report = JSON.parse(raw);
  assert(estimateTokens(raw) <= 800); assert.equal(report.partial, false); assert.equal(report.totalAffected, 100); assert(report.omittedAffected > 0);
  assert.match(report.limitations, /not complete coverage/);
});

test('scan and path boundaries, cancellation and plan mode remain enforced', async t => {
  const files = { 'a.ts': 'export const a=1;' };
  for (let i = 0; i < 305; i++) files[`file${i}.ts`] = 'import "./a";';
  const { tools } = await fixture(t, files);
  const report = JSON.parse(await dependencyImpact(tools, 'a.ts')); assert(report.partial); assert.equal(report.scannedFiles, 300);
  await assert.rejects(dependencyImpact(tools, '../outside.ts'));
  await assert.rejects(dependencyImpact(tools, 'a.ts', undefined, 200));
  const controller = new AbortController(); controller.abort(); await assert.rejects(dependencyImpact(tools, 'a.ts', controller.signal), /Cancelled/);
  assert.equal((await tools.execute('frontend_impact', { path: 'a.ts', tokens: 1000 })).is_error, false);
});
