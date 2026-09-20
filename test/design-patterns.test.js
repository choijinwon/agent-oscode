import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceTools} from '../src/tools.js';
import {DesignStudio} from '../src/design-studio.js';
import {designRecipe} from '../src/design-recipes.js';
import {patternCatalog} from '../src/design-patterns.js';
import {defaultTheme} from '../src/design-theme.js';
import {openDesignGallery} from '../src/design-gallery.js';

async function browser(t){
 let chromium;try{chromium=(await import('playwright')).chromium;await fs.access(chromium.executablePath());}
 catch(e){if(process.env.CI)throw e;t.skip('Chromium required');return;}
 const b=await chromium.launch({headless:true});t.after(()=>b.close());return b;
}
const tools=()=>({readOnly:false,permissions:{},approve:async()=>true,onPreview:()=>{}});
async function choose(page){const response=page.waitForResponse(r=>r.url().endsWith('/select'));await page.locator('#choose').click();assert.equal((await response).status(),200);}

test('six interaction starters support all adapters and keep unrelated runtime small',()=>{
 assert.equal(patternCatalog.length,6);
 for(const framework of ['react','vue','angular','svelte'])for(const {id} of patternCatalog){
  const result=designRecipe({framework,item:id,motion:'off'}),code=result.code.replaceAll('\\"','"');
  assert(code.includes('data-interaction="true"'));assert(code.includes('data-motion="off"'));
  assert(code.includes('function patternAction'));assert(code.includes("type==='toggle'"));
  assert(!code.includes('function adminAction'));assert(!code.includes('__id__'));
 }
 assert(!designRecipe({framework:'react',item:'button'}).code.includes('function patternAction'));
 assert(!designRecipe({framework:'react',item:'button'}).css.includes('.oc-reorder'));
});

test('interact command filters patterns and preserves framework and motion on selection',async t=>{
 const b=await browser(t);if(!b)return;const page=await b.newPage();
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-patterns-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const workspace=new WorkspaceTools(root,{approve:async()=>true});
 const studio=new DesignStudio(workspace);
 await studio.command('interact vue',undefined,{open:async url=>{
  await page.goto(url);assert.equal(await page.locator('.catalog-item').count(),6);
  await page.locator('[data-id=step-form]').click();await page.locator('#motion').selectOption('reduced');await choose(page);
 }});
 assert.equal(studio.selection.item,'step-form');assert.equal(studio.selection.framework,'vue');assert.equal(studio.selection.motion,'reduced');
});

test('accordion, popover menu and undo notification work with keyboard and isolated previews',async t=>{
 const b=await browser(t);if(!b)return;const page=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openDesignGallery(tools(),{theme:defaultTheme,initial:'accordion'},undefined,{open:async url=>{
  await page.goto(url);const p=page.locator('#preview');await p.locator('summary').first().focus();await page.keyboard.press('Enter');
  assert(await p.locator('details').first().evaluate(el=>el.open));assert.equal(await page.locator('#states details[open]').count(),0);
  await page.keyboard.press('Space');assert(!await p.locator('details').first().evaluate(el=>el.open));
  await page.locator('[data-id=action-menu]').click();const trigger=p.getByRole('button',{name:'작업 선택'});
  await trigger.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.activeElement?.dataset.pattern==='menu-choice');
  await page.keyboard.press('End');assert(await p.getByRole('button',{name:'보관 요청'}).evaluate(el=>el===document.activeElement));
  await page.keyboard.press('Escape');assert.equal(await p.locator(':popover-open').count(),0);assert(await trigger.evaluate(el=>el===document.activeElement));
  await trigger.click();await page.locator('#item-title').click();assert.equal(await p.locator(':popover-open').count(),0);
  await trigger.click();await p.getByRole('button',{name:'공유 요청'}).click();assert.match(await p.getByRole('status').innerText(),/공유 요청 선택됨/);assert(await trigger.evaluate(el=>el===document.activeElement));
  await page.locator('[data-id=action-toast]').click();await p.getByRole('button',{name:'보관하기'}).click();
  assert(await p.getByRole('button',{name:'되돌리기'}).isVisible());assert.equal(await page.locator('#states [data-archived]').count(),0);
  await p.getByRole('button',{name:'되돌리기'}).click();assert.match(await p.locator('[data-archive-state]').innerText(),/진행 목록/);assert(await p.getByRole('button',{name:'보관하기'}).evaluate(el=>el===document.activeElement));
  await p.getByRole('button',{name:'보관하기'}).click();await p.getByRole('button',{name:'알림 닫기'}).click();assert.match(await p.locator('[data-archive-state]').innerText(),/보관 목록/);
  await p.getByRole('button',{name:'보관 알림 다시 보기'}).click();await p.getByRole('button',{name:'되돌리기'}).click();await choose(page);
 }});assert.deepEqual(errors,[]);
});

test('step form validates each step, preserves edits and does not submit generic forms early',async t=>{
 const b=await browser(t);if(!b)return;const page=await b.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openDesignGallery(tools(),{theme:defaultTheme,initial:'step-form'},undefined,{open:async url=>{
  await page.goto(url);const p=page.locator('#preview');
  await p.getByRole('button',{name:'다음'}).click();assert(await p.getByLabel('프로젝트 이름').isVisible());
  await p.getByLabel('프로젝트 이름').fill('   ');await p.getByRole('button',{name:'다음'}).click();assert(await p.getByLabel('프로젝트 이름').isVisible());
  await p.getByLabel('프로젝트 이름').fill('고객 포털');await page.keyboard.press('Enter');assert(await p.getByLabel('담당자 이메일').isVisible());assert(await p.getByLabel('담당자 이메일').evaluate(el=>el===document.activeElement));
  await p.getByLabel('담당자 이메일').fill('invalid');await p.getByRole('button',{name:'다음'}).click();assert(await p.getByLabel('담당자 이메일').isVisible());
  await p.getByLabel('담당자 이메일').fill('team@example.com');await p.getByRole('button',{name:'이전',exact:true}).click();assert.equal(await p.getByLabel('프로젝트 이름').inputValue(),'고객 포털');
  await p.getByRole('button',{name:'다음'}).click();assert.equal(await p.getByLabel('담당자 이메일').inputValue(),'team@example.com');await p.getByRole('button',{name:'다음'}).click();assert.equal(await p.locator('[data-step-summary]').innerText(),'고객 포털 · team@example.com');
  assert(!/실제 저장/.test(await p.getByRole('status').innerText()));await p.getByRole('button',{name:'완료',exact:true}).click();assert.match(await p.getByRole('status').innerText(),/입력을 확인했습니다/);
  assert.equal(await page.locator('#states [data-step="0"]:visible').count(),6);await choose(page);
 }});assert.deepEqual(errors,[]);
});

test('radio navigation and reordering retain focus and work without motion at 360px',async t=>{
 const b=await browser(t);if(!b)return;const page=await b.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openDesignGallery(tools(),{theme:defaultTheme,initial:'segmented-control'},undefined,{open:async url=>{
  await page.goto(url);const p=page.locator('#preview');await p.getByRole('radio',{name:'전체',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await p.locator('[data-segment-item]:visible').count(),2);
  await page.keyboard.press('ArrowRight');assert.equal(await p.locator('[data-segment-item]:visible').count(),1);assert.equal(await page.locator('#states [data-segment-item]:visible').count(),18);
  await page.locator('[data-id=reorder-list]').click();await page.locator('#motion').selectOption('off');await p.getByRole('button',{name:'접근성 확인 위로'}).focus();await page.keyboard.press('Enter');
  assert.equal(await p.locator('[data-order-id]').first().getAttribute('data-order-id'),'accessibility');assert(await p.getByRole('button',{name:'접근성 확인 아래로'}).evaluate(el=>el===document.activeElement));
  assert.match(await p.getByRole('status').innerText(),/1 \/ 3번째/);assert.equal(await page.locator('#states article').first().locator('[data-order-id]').first().getAttribute('data-order-id'),'design');
  await page.locator('#viewport').selectOption('360');const frame=page.frameLocator('#mobile-preview');await frame.getByRole('button',{name:'배포 준비 위로'}).click();assert.equal(await frame.locator('[data-order-id]').nth(1).getAttribute('data-order-id'),'release');
  await page.waitForFunction(()=>document.querySelector('#mobile-observation').textContent.includes('가로 넘침 0px'));
  for(const {id} of patternCatalog){await page.locator(`[data-id="${id}"]`).click();await page.waitForFunction(()=>document.querySelector('#mobile-observation').textContent.includes('가로 넘침 0px'));}
  await page.locator('[data-id=action-menu]').click();await frame.getByRole('button',{name:'작업 선택'}).click();await frame.getByRole('button',{name:'복제 요청'}).click();assert.match(await frame.getByRole('status').innerText(),/복제 요청/);await choose(page);
 }});assert.deepEqual(errors,[]);
});
