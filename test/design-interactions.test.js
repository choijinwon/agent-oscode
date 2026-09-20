import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceTools} from '../src/tools.js';
import {DesignStudio} from '../src/design-studio.js';
import {defaultTheme} from '../src/design-theme.js';
import {designRecipe,validateSelection} from '../src/design-recipes.js';
import {openDesignGallery} from '../src/design-gallery.js';

async function browser(t){
  let chromium;try{chromium=(await import('playwright')).chromium;await fs.access(chromium.executablePath());}
  catch(e){if(process.env.CI)throw e;t.skip('Chromium required');return;}
  const b=await chromium.launch({headless:true});t.after(()=>b.close());return b;
}
const tools=()=>({readOnly:false,permissions:{},approve:async()=>true,onPreview:()=>{}});
async function choose(page){const response=page.waitForResponse(r=>r.url().endsWith('/select'));await page.locator('#choose').click();assert.equal((await response).status(),200);}

test('motion choices survive gallery selection and CLI generation without changing user actions',async t=>{
  const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-interaction-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const workspace=new WorkspaceTools(root,{approve:async()=>true}),studio=new DesignStudio(workspace);
  const b=await browser(t);if(!b)return;const page=await b.newPage();
  await studio.command('admin react',undefined,{open:async url=>{
    await page.goto(url);await page.locator('#motion').selectOption('off');
    await page.locator('#preview [data-admin-period]').selectOption('month');
    assert.equal(await page.locator('#preview .oc-admin-number').first().innerText(),'1,048');await choose(page);
  }});
  assert.equal(studio.selection.motion,'off');
  await studio.command('motion reduced');
  await assert.rejects(studio.command('motion invalid'),/auto\/reduced\/off/);assert.equal(studio.selection.motion,'reduced');
  await studio.command('apply Dashboard.jsx');assert.match(await fs.readFile(path.join(root,'Dashboard.jsx'),'utf8'),/data-motion="reduced"/);
  for(const framework of ['react','vue','angular','svelte']){
    const code=designRecipe({framework,item:'admin-table',motion:'off'}).code.replaceAll('\\"','"');assert(code.includes('data-motion="off"'));assert(code.includes('function designMotion'));
  }
  assert.throws(()=>validateSelection({framework:'react',item:'button',motion:'<script>'}),/motion/);
  const recipe=await workspace.execute('design_recipe',{framework:'react',component:'button',motion:'off'});
  assert.equal(recipe.is_error,false);assert(recipe.content.includes('data-motion="off"'));
  assert((await workspace.execute('design_recipe',{framework:'react',component:'button',motion:'invalid'})).is_error);
  assert((await workspace.execute('design_recipe',{framework:'react',component:'team:any',motion:'off'})).is_error);
});

test('normal and subtle feedback animate, off and OS reduced motion stay still while controls keep working',async t=>{
  const b=await browser(t);if(!b)return;const page=await b.newPage({reducedMotion:'no-preference'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Observe calls while still executing the browser's real Web Animations implementation.
  await page.addInitScript(()=>{
    window.motionRecords=[];const animate=Element.prototype.animate;
    Element.prototype.animate=function(frames,options){window.motionRecords.push({frames,duration:options.duration});return animate.call(this,frames,options);};
  });
  await openDesignGallery(tools(),{theme:defaultTheme,initial:'admin-dashboard'},undefined,{open:async url=>{
    await page.goto(url);const p=page.locator('#preview');
    await p.getByLabel('조회 기간').selectOption('month');
    let record=await page.evaluate(()=>window.motionRecords.at(-1));assert.equal(record.duration,180);assert.equal(record.frames[0].transform,'translateY(4px)');
    await page.locator('#motion').selectOption('reduced');await page.evaluate(()=>window.motionRecords=[]);
    await p.getByLabel('조회 기간').selectOption('month');record=await page.evaluate(()=>window.motionRecords.at(-1));assert.equal(record.duration,100);assert(!('transform' in record.frames[0]));
    await page.locator('#motion').selectOption('off');await page.evaluate(()=>window.motionRecords=[]);await p.getByLabel('조회 기간').selectOption('month');assert.equal(await page.evaluate(()=>window.motionRecords.length),0);
    await page.locator('#motion').selectOption('auto');await page.emulateMedia({reducedMotion:'reduce'});await p.getByLabel('조회 기간').selectOption('month');assert.equal(await page.evaluate(()=>window.motionRecords.length),0);assert.equal(await p.locator('.oc-admin-number').first().innerText(),'1,048');
    await page.locator('[data-id=admin-table]').click();
    assert.equal(await p.locator('[data-admin-sort]').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
    await p.getByRole('checkbox',{name:'김민지 선택',exact:true}).check();assert.equal(await p.locator('[data-admin-row][data-selected]').count(),1);
    await p.getByLabel('상태',{exact:true}).selectOption('pending');assert.equal(await p.locator('[data-selected]').count(),0);
    await p.getByRole('button',{name:'박서준 상세 보기'}).click();assert(await p.getByRole('dialog',{name:'사용자 상세'}).isVisible());assert.equal(await page.evaluate(()=>window.motionRecords.length),0);
    await page.keyboard.press('Escape');await choose(page);
  }});assert.deepEqual(errors,[]);
});

test('detail drawer supports keyboard, focus return, instance isolation and the phone viewport',async t=>{
  const b=await browser(t);if(!b)return;const page=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openDesignGallery(tools(),{theme:defaultTheme,initial:'admin-table'},undefined,{open:async url=>{
    await page.goto(url);const p=page.locator('#preview'),trigger=p.getByRole('button',{name:'김민지 상세 보기'});
    await trigger.focus();await page.keyboard.press('Enter');const dialog=p.getByRole('dialog',{name:'사용자 상세'});
    assert(await dialog.isVisible());assert.equal(await dialog.locator('[data-detail-email]').innerText(),'minji@example.com');
    assert.equal(await page.locator('#states dialog[open]').count(),0);
    assert(await dialog.evaluate(el=>el.contains(document.activeElement)));await page.keyboard.press('Tab');
    // Native dialogs may let Tab visit browser chrome (activeElement becomes body), never background controls.
    assert(await dialog.evaluate(el=>document.activeElement===document.body||el.contains(document.activeElement)));
    if(await dialog.evaluate(()=>document.activeElement===document.body))await page.keyboard.press('Tab');
    assert(await dialog.evaluate(el=>el.contains(document.activeElement)));
    await page.keyboard.press('Escape');assert(!await dialog.isVisible());assert(await trigger.evaluate(el=>document.activeElement===el));
    await p.getByLabel('상태',{exact:true}).selectOption('pending');await p.getByRole('button',{name:'박서준 상세 보기'}).click();assert.equal(await dialog.locator('[data-detail-team]').innerText(),'디자인팀');await dialog.getByRole('button',{name:'사용자 상세 닫기'}).click();assert.equal(await p.getByLabel('상태',{exact:true}).inputValue(),'pending');
    await page.locator('#viewport').selectOption('360');await page.waitForFunction(()=>document.querySelector('#mobile-observation').textContent.startsWith('360 ×'));
    const frame=page.frameLocator('#mobile-preview');await frame.getByRole('button',{name:'김민지 상세 보기'}).click();
    const mobileDialog=frame.getByRole('dialog',{name:'사용자 상세'});
    await mobileDialog.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));
    assert(await mobileDialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}));
    await page.waitForFunction(()=>{const top=document.querySelector('#mobile-preview').getBoundingClientRect().top;return top>=-1&&top<innerHeight-80;});
    await mobileDialog.getByRole('button',{name:'사용자 상세 닫기'}).click();await choose(page);
  }});assert.deepEqual(errors,[]);
});
