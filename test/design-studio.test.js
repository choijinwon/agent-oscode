import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {WorkspaceTools} from '../src/tools.js';
import {defaultTheme, projectTheme, validateTheme, exportTokens, importTokens} from '../src/design-theme.js';
import {designCatalog} from '../src/design-catalog.js';
import {designRecipe, applyDesign} from '../src/design-recipes.js';
import {registerDesign, readRegistry, exportRegistry, importRegistry, validateRegistry, applyRegistry} from '../src/design-registry.js';
import {openDesignGallery} from '../src/design-gallery.js';
import {DesignStudio} from '../src/design-studio.js';

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oscode-design-')));
  t.after(() => fs.rm(root, {recursive:true, force:true}));
  return {root, tools:new WorkspaceTools(root, {approve:async () => true})};
}
async function browser(t) {
  let chromium;
  try {chromium = (await import('playwright')).chromium; await fs.access(chromium.executablePath());}
  catch (e) {if (process.env.CI) throw e; t.skip('Chromium required'); return;}
  const b = await chromium.launch({headless:true}); t.after(() => b.close()); return b;
}

test('project themes detect bounded candidates, merge approved overrides and round-trip typed tokens', async t => {
  const {root, tools} = await fixture(t), studio = new DesignStudio(tools);
  await fs.writeFile(path.join(root, 'theme.css'), ':root { --primary:#123456; --radius:8px; --foreground:220 10% 20%; --color-border:var(--unsafe); }');
  const theme = await projectTheme(tools);
  assert.equal(theme.tokens.accent, '#123456'); assert.equal(theme.tokens.radius, '8px');
  assert.equal(theme.tokens.text, 'hsl(220 10% 20%)'); assert.equal(theme.tokens.border, defaultTheme.border);
  await assert.rejects(fs.access(path.join(root, '.oscode')), {code:'ENOENT'});
  await studio.command('theme set {"radius":"6px"}'); await studio.command('theme set {"accent":"#abcdef"}');
  assert.equal((await projectTheme(tools)).tokens.radius, '6px');
  assert.equal((await projectTheme(tools)).tokens.accent, '#abcdef');
  assert.deepEqual(importTokens(exportTokens(defaultTheme)), defaultTheme);
  for (const token of [{accent:'url(https://evil.test)'}, {font:'x; color:red'}, {radius:'-1px'}, {unknown:'red'}]) assert.throws(() => validateTheme(token));
  assert.throws(() => importTokens({oscode:{accent:{$type:'color', $value:'{remote.primary}'}}}));
  assert.throws(() => exportTokens({accent:'hsl(1 2% 3%)'}));
  tools.approve = async () => false;
  await assert.rejects(studio.command('theme set {"radius":"9px"}'), /취소/);
  assert.equal((await projectTheme(tools)).tokens.radius, '6px');
});

test('native recipes apply new files with framework gates, independent styles and partial-denial evidence', async t => {
  const {root, tools} = await fixture(t), selection = {framework:'react', item:'form', tokens:defaultTheme};
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({dependencies:{react:'^18.2.0'}}));
  await applyDesign(tools, selection, 'Profile.jsx');
  assert.match(await fs.readFile(path.join(root, 'Profile.css'), 'utf8'), /\[data-design="Profile-[\da-f]+"\]/);
  const other = designRecipe({...selection, tokens:{accent:'#123456'}}, 'Other.jsx');
  assert.match(other.css, /\[data-design="Other-[\da-f]+"\]/);
  await assert.rejects(applyDesign(tools, selection, 'Profile.jsx'), /덮어쓰지/);
  await assert.rejects(applyDesign(tools, {...selection, framework:'vue'}, 'Profile.vue'), /다릅니다/);
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({dependencies:{react:'^17.0.0'}}));
  await assert.rejects(applyDesign(tools, selection, 'Old.jsx'), /18.0/);
  await fs.unlink(path.join(root, 'package.json'));
  tools.approve = async (_, file) => file !== 'Partial.css';
  await assert.rejects(applyDesign(tools, selection, 'Partial.jsx'), /생성 완료: Partial.jsx/);
  await fs.access(path.join(root, 'Partial.jsx'));
  await assert.rejects(fs.access(path.join(root, 'Partial.css')), {code:'ENOENT'});
  await assert.rejects(applyDesign(tools, selection, '../Escape.jsx'), /outside/);
  assert.throws(() => designRecipe(selection, "Quote'.jsx"));
});

test('design library survives team export/import and simultaneous registrations without executing code', async t => {
  const {root, tools} = await fixture(t), other = await fixture(t);
  await fs.writeFile(path.join(root, 'Team.jsx'), 'throw new Error("Registry sources must never execute");');
  await fs.writeFile(path.join(root, 'Team.css'), '.team { color: green; }');
  await Promise.all(['team-a', 'team-b'].map(name => registerDesign(tools, name, {framework:'react', path:'Team.jsx', css:'Team.css'})));
  const data = await readRegistry(tools); assert.equal(data.items.length, 2);
  await exportRegistry(tools, 'shared.json'); await fs.copyFile(path.join(root, 'shared.json'), path.join(other.root, 'shared.json'));
  assert.deepEqual((await importRegistry(other.tools, 'shared.json')).sort(), ['team-a', 'team-b']);
  await assert.rejects(importRegistry(other.tools, 'shared.json'), /레지스트리/);
  await applyRegistry(other.tools, (await readRegistry(other.tools)).items[0], 'Copied.jsx');
  assert.equal(await fs.readFile(path.join(other.root, 'Copied.jsx'), 'utf8'), data.items[0].code);
  const bad = structuredClone(data); bad.items[0].code += 'tampered'; assert.throws(() => validateRegistry(bad), /해시/);
  await fs.unlink(path.join(root, '.oscode/design-registry.json'));
  await fs.symlink(path.join(root, 'shared.json'), path.join(root, '.oscode/design-registry.json'));
  await assert.rejects(readRegistry(tools), /링크/);
});

test('PLAN is read-only, denied mutations fail, and code is retrievable in bounded chunks', async t => {
  const {root, tools} = await fixture(t); tools.readOnly = true; tools.outputLimit = 1200;
  const studio = new DesignStudio(tools); assert.match(await studio.command('list'), /입력 폼/);
  await studio.command('select react/tabs');
  for (const command of ['apply Tabs.jsx', 'theme set {"radius":"2px"}', 'gallery']) await assert.rejects(studio.command(command), /BUILD/);
  const expected = designRecipe({framework:'react', item:'tabs'});
  for (const section of ['code', 'css']) {
    let actual = '', offset = 0;
    do {
      const r = await tools.execute('design_recipe', {framework:'react', component:'tabs', section, offset});
      assert.equal(r.is_error, false); assert(r.content.length <= 1200); assert(!r.content.includes('[truncated'));
      actual += r.content.slice(r.content.indexOf('\n', r.content.indexOf('\n') + 1) + 1);
      const next = /nextOffset: (\d+|done)/.exec(r.content)[1]; if (next === 'done') break; offset = +next;
    } while (offset < 10000);
    assert.equal(actual, expected[section]);
  }
  assert((await tools.execute('design_recipe', {framework:'react', component:'tabs', section:'unknown'})).is_error);
  await assert.rejects(fs.access(path.join(root, '.oscode')), {code:'ENOENT'});
});

test('team TypeScript and stylesheet references survive renamed output and remain readable to the frontend agent', async t => {
  const {root, tools} = await fixture(t);
  await fs.writeFile(path.join(root, 'Team.tsx'), "import './Team.css';\nexport default function Team(){return <button>Save</button>}\n");
  await fs.writeFile(path.join(root, 'Team.css'), 'button { color: green; }');
  const item = await registerDesign(tools, 'team-button', {framework:'react',path:'Team.tsx',css:'Team.css'});
  await assert.rejects(applyRegistry(tools, item, 'Wrong.jsx'), /tsx/);
  await applyRegistry(tools, item, 'Renamed.tsx');
  assert.match(await fs.readFile(path.join(root, 'Renamed.tsx'),'utf8'), /import '\.\/Renamed.css'/);
  tools.readOnly = true;
  const code = await tools.execute('design_recipe',{framework:'react',component:'team:team-button'});
  assert.equal(code.is_error, false); assert(code.content.includes(item.code));
  assert((await tools.execute('design_recipe',{framework:'vue',component:'team:team-button'})).is_error);
  assert.throws(() => validateRegistry({version:1,items:[{...item,extension:'.sh'}]}), /확장자/);
});

test('studio preserves spaces in paths and produces all four framework families', async t => {
  const {root, tools} = await fixture(t), studio = new DesignStudio(tools);
  await fs.mkdir(path.join(root, 'two  spaces'));
  await studio.command('select react/form'); await studio.command('apply two  spaces/Form.jsx');
  await fs.access(path.join(root, 'two  spaces/Form.jsx'));
  for (const framework of ['react', 'vue', 'angular', 'svelte']) for (const item of designCatalog) {
    const result = designRecipe({framework, item:item.id});
    assert(!result.code.includes('__id__')); assert(result.code.includes('designAction'));
    assert(result.css.includes('--oc-accent')); assert(result.code.includes(result.cssFile));
  }
});

test('gallery checks local origin and selection schema, and cleans up after selection or abort', async t => {
  const {tools} = await fixture(t); let location;
  const selected = await openDesignGallery(tools, {theme:defaultTheme}, undefined, {open:async url => {
    location = url; const origin = new URL(url).origin, target = url + '/select';
    const wrongHost = await new Promise((resolve, reject) => http.get(url, {headers:{host:'evil.test'}}, r => {r.resume(); resolve(r.statusCode);}).on('error', reject));
    assert.equal(wrongHost, 403);
    assert.equal((await fetch(origin + '/')).status, 404);
    assert.equal((await fetch(target, {method:'POST', headers:{'Content-Type':'application/json', origin:'https://evil.test'}, body:'{}'})).status, 403);
    assert.equal((await fetch(target, {method:'POST', headers:{'Content-Type':'application/json', origin}, body:'{"item":"bad"}'})).status, 400);
    const response = await fetch(target, {method:'POST', headers:{'Content-Type':'application/json', origin}, body:JSON.stringify({framework:'react', item:'tabs', tokens:defaultTheme})});
    assert.deepEqual(await response.json(), {ok:true});
  }});
  assert.equal(selected.item, 'tabs'); await assert.rejects(fetch(location));
  const c = new AbortController();
  await assert.rejects(openDesignGallery(tools, {theme:defaultTheme}, c.signal, {open:async () => c.abort()}), /취소/);
  tools.permissions.shell = 'deny'; await assert.rejects(openDesignGallery(tools, {theme:defaultTheme}), /권한/);
});

test('browser gallery exercises keyboard tabs, modal focus, form validation, search, theme reset and choice', async t => {
  const b = await browser(t); if (!b) return; const {tools} = await fixture(t);
  const page = await b.newPage({viewport:{width:1440, height:1000}}), errors = []; page.on('pageerror', e => errors.push(e.message));
  const result = await openDesignGallery(tools, {theme:{...defaultTheme, radius:'6px'}, framework:'react'}, undefined, {open:async url => {
    await page.goto(url); assert.equal(await page.locator('#states article').count(), 6);
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'gallery mobile overflow');
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('[data-id="tabs"]').click(); const tabs = page.locator('#preview [role=tab]');
    await tabs.first().focus(); await page.keyboard.press('ArrowRight'); assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#preview [role=tabpanel]:visible').innerText(), '최근 활동이 없습니다.');
    await page.keyboard.press('End'); assert.equal(await tabs.nth(2).getAttribute('aria-selected'), 'true');
    await page.locator('[data-id="dialog"]').click(); await page.locator('#preview [data-action=open-dialog]').click();
    assert(await page.locator('#preview dialog').isVisible()); await page.keyboard.press('Escape');
    assert(!await page.locator('#preview dialog').isVisible()); assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'open-dialog');
    await page.locator('[data-id="tooltip"]').click(); await page.locator('#preview button').focus();
    assert(await page.locator('#preview [role=tooltip]').isVisible()); await page.keyboard.press('Escape');
    assert(!await page.locator('#preview [role=tooltip]').isVisible());
    await page.locator('[data-id="form"]').click(); await page.locator('#preview button').click();
    assert.equal(await page.locator('#preview [data-feedback]').innerText(), '');
    await page.locator('#preview [name=name]').fill('OSCODE'); await page.locator('#preview [name=email]').fill('test@example.com');
    await page.locator('#preview button').click(); assert.match(await page.locator('#preview [data-feedback]').innerText(), /입력을 확인/);
    await page.locator('[data-id="search-results"]').click(); await page.locator('#preview input').fill('없는 이름');
    assert(await page.locator('#preview [data-empty]').isVisible()); await page.locator('#preview input').fill('디자인');
    assert.equal(await page.locator('#preview [data-count]').innerText(), '1개 프로젝트');
    await page.locator('#radius').fill('20'); assert.equal(await page.locator('#radius-value').innerText(), '20px');
    await page.locator('#theme-reset').click(); assert.equal(await page.locator('#radius-value').innerText(), '6px');
    await page.locator('#search').fill('탭'); assert.equal(await page.locator('.catalog-item').count(), 2);
    await page.locator('[data-id="tabs"]').click(); await page.locator('#framework').selectOption('vue');
    await page.locator('#variant').selectOption('outline');
    const response = page.waitForResponse(r => r.url().endsWith('/select'));
    await page.locator('#choose').click(); assert.equal((await response).status(), 200);
    await page.waitForFunction(() => document.querySelector('#choose').textContent === '선택 완료');
  }});
  assert.equal(result.framework, 'vue'); assert.equal(result.item, 'tabs'); assert.equal(result.variant, 'outline'); assert.deepEqual(errors, []);
});

test('team gallery displays untrusted descriptions as text and never executes registry source', async t => {
  const b = await browser(t); if (!b) return; const {tools} = await fixture(t), page = await b.newPage();
  const registry = [{name:'team-button', framework:'react', description:'<img src=x onerror="window.registryRan=true">', code:'window.registryRan=true'}];
  const result = await openDesignGallery(tools, {theme:defaultTheme, registry}, undefined, {open:async url => {
    await page.goto(url); await page.locator('[data-id="team:team-button"]').click();
    assert.equal(await page.evaluate(() => window.registryRan), undefined);
    assert.equal(await page.locator('img').count(), 0); assert.match(await page.locator('#preview').innerText(), /원본 코드를 실행하지/);
    await page.locator('#framework').selectOption('vue'); assert(await page.locator('#choose').isDisabled());
    await page.locator('#framework').selectOption('react');
    const response = page.waitForResponse(r => r.url().endsWith('/select')); await page.locator('#choose').click(); await response;
  }});
  assert.equal(result.team, 'team-button');
});
