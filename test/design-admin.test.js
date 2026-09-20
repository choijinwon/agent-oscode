import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceTools} from '../src/tools.js';
import {DesignStudio} from '../src/design-studio.js';
import {adminCatalog} from '../src/design-admin.js';
import {designRecipe} from '../src/design-recipes.js';
import {openDesignGallery} from '../src/design-gallery.js';
import {defaultTheme} from '../src/design-theme.js';

async function browser(t){
  let chromium;
  try{chromium=(await import('playwright')).chromium;await fs.access(chromium.executablePath());}
  catch(e){if(process.env.CI)throw e;t.skip('Chromium required');return;}
  const b=await chromium.launch({headless:true});t.after(()=>b.close());return b;
}
async function choose(page){const response=page.waitForResponse(r=>r.url().endsWith('/select'));await page.locator('#choose').click();assert.equal((await response).status(),200);}
const tools=()=>({readOnly:false,permissions:{},approve:async()=>true,onPreview:()=>{}});

test('admin command selects and applies native files; PLAN and existing file protections still apply',async t=>{
  const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-admin-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const workspace=new WorkspaceTools(root,{approve:async()=>true}),studio=new DesignStudio(workspace);
  const b=await browser(t);if(!b)return;const page=await b.newPage({viewport:{width:1440,height:1000}});
  await studio.command('admin vue',undefined,{open:async url=>{
    await page.goto(url);assert.equal(await page.locator('#item-title').innerText(),'관리자 대시보드');
    assert.equal(await page.locator('.catalog-item').count(),5);
    assert.equal(await page.locator('#viewport').inputValue(),'fit');assert.equal(await page.locator('#framework').inputValue(),'vue');
    await page.locator('[data-id=admin-table]').click();await choose(page);
  }});
  await studio.command('apply Members.vue');assert.match(await fs.readFile(path.join(root,'Members.vue'),'utf8'),/defineEmits/);
  await assert.rejects(studio.command('apply Members.vue'),/덮어쓰지/);
  workspace.readOnly=true;await assert.rejects(studio.command('admin'),/BUILD/);
  const result=await workspace.execute('design_catalog',{query:'관리자'});assert.equal(result.is_error,false);assert(result.content.includes('admin-table'));
  // Admin behavior and styles should not consume tokens for unrelated native recipes.
  for(const framework of ['react','vue','angular','svelte']){
    const base=designRecipe({framework,item:'button'});assert(!base.code.includes('function adminAction'));assert(!base.css.includes('.oc-admin-body'));
    for(const {id} of adminCatalog){const recipe=designRecipe({framework,item:id});assert(!recipe.code.includes('__id__'));assert(recipe.code.includes('adminDesignAction'));assert(recipe.css.includes('.oc-admin-body'));}
  }
});

test('admin table combines filtering, sorting, page selection, mixed checkbox state and empty results without leaking selection',async t=>{
  const b=await browser(t);if(!b)return;const page=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openDesignGallery(tools(),{theme:defaultTheme,initial:'admin-table'},undefined,{open:async url=>{
    await page.goto(url);const p=page.locator('#preview'),visible=p.locator('[data-admin-row]:visible'),all=p.getByRole('checkbox',{name:'현재 페이지 전체 선택'});
    assert.equal(await visible.count(),3);assert(await p.getByRole('button',{name:'이전',exact:true}).isDisabled());
    await p.getByRole('checkbox',{name:'김민지 선택',exact:true}).check();assert(await all.evaluate(el=>el.indeterminate));
    await all.check();assert.match(await p.locator('[data-admin-table-status]').innerText(),/선택 3개/);
    await p.getByRole('button',{name:'다음',exact:true}).click();assert(!await all.isChecked());
    await p.getByRole('checkbox',{name:'정도윤 선택',exact:true}).check();
    await p.getByRole('button',{name:'선택 항목 검토',exact:true}).click();assert.match(await p.locator('[data-admin-bulk-status]').innerText(),/4개/);
    await p.getByRole('button',{name:'이전',exact:true}).click();assert(await all.isChecked());
    assert.equal(await page.locator('#states [data-row-select]:checked').count(),0);
    await p.getByRole('button',{name:/이름 정렬/}).click();assert.equal(await p.locator('th[aria-sort]').getAttribute('aria-sort'),'ascending');
    assert.equal(await visible.first().getAttribute('data-row-id'),'u07');
    await p.getByRole('button',{name:/이름 정렬/}).click();assert.equal(await visible.first().getAttribute('data-row-id'),'u06');
    await p.getByLabel('상태',{exact:true}).selectOption('active');assert.equal(await p.locator('[data-row-select]:checked').count(),0);
    assert.match(await p.locator('[data-admin-table-status]').innerText(),/4개 중 1–3 · 1\/2/);
    await p.getByRole('button',{name:'다음',exact:true}).click();assert.equal(await visible.count(),1);assert(await p.getByRole('button',{name:'다음',exact:true}).isDisabled());
    await p.getByLabel('사용자 검색',{exact:true}).fill('MINJI@');assert.equal(await visible.count(),1);assert.equal(await visible.first().getAttribute('data-row-id'),'u01');
    await p.getByLabel('사용자 검색',{exact:true}).fill('<script>');assert.equal(await visible.count(),0);assert(await p.locator('[data-admin-empty]').isVisible());assert(await all.isDisabled());assert(await p.getByRole('button',{name:'선택 항목 검토',exact:true}).isDisabled());
    await p.getByRole('button',{name:'필터 초기화',exact:true}).click();assert.equal(await visible.count(),3);assert.match(await p.locator('[data-admin-table-status]').innerText(),/8개 중 1–3/);
    await choose(page);
  }});assert.deepEqual(errors,[]);
});

test('admin layout, dashboard, invitation and activity controls operate independently with native validation',async t=>{
  const b=await browser(t);if(!b)return;const page=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openDesignGallery(tools(),{theme:defaultTheme,initial:'admin-layout'},undefined,{open:async url=>{
    await page.goto(url);const p=page.locator('#preview');
    await p.getByRole('button',{name:'메뉴 접기',exact:true}).click();assert(!await p.getByRole('navigation').isVisible());
    await p.getByRole('button',{name:'메뉴 펼치기',exact:true}).click();await p.getByRole('button',{name:'사용자',exact:true}).click();assert.equal(await p.locator('[data-admin-section]').innerText(),'사용자');
    await page.locator('[data-id=admin-dashboard]').click();await p.getByLabel('조회 기간').selectOption('month');
    assert.equal(await p.locator('.oc-admin-number').first().innerText(),'1,048');assert.equal(await p.locator('meter').first().evaluate(el=>el.value),84);
    assert.equal(await page.locator('#states .oc-admin-number').first().innerText(),'248');
    await page.locator('[data-id=admin-user-form]').click();await p.getByRole('button',{name:'초대 요청'}).click();assert.equal(await p.locator('[data-feedback]').innerText(),'');
    await p.getByLabel('이름',{exact:true}).fill('새 팀원');await p.getByLabel('이메일',{exact:true}).fill('invalid');await p.getByRole('button',{name:'초대 요청'}).click();assert.equal(await p.locator('[data-feedback]').innerText(),'');
    await p.getByLabel('이메일',{exact:true}).fill('new@example.com');await p.getByLabel('역할',{exact:true}).selectOption('admin');assert.match(await p.locator('[data-admin-role-note]').innerText(),/사용자와 프로젝트 설정/);
    await p.getByRole('button',{name:'초대 요청'}).click();assert.match(await p.locator('[data-feedback]').innerText(),/실제 저장은 앱에서 연결/);
    await page.locator('[data-id=admin-activity]').click();await p.getByLabel('활동 유형').selectOption('system');assert.equal(await p.locator('[data-admin-log]:visible').count(),1);
    await p.getByLabel('활동 검색').fill('김민지');assert(await p.locator('[data-admin-log-empty]').isVisible());await p.getByLabel('활동 유형').selectOption('all');assert.equal(await p.locator('[data-admin-log]:visible').count(),1);
    await choose(page);
  }});assert.deepEqual(errors,[]);
});

test('admin components fit a narrow viewport while the data table scrolls inside its own region',async t=>{
  const b=await browser(t);if(!b)return;const page=await b.newPage({viewport:{width:1440,height:1000}});
  await openDesignGallery(tools(),{theme:defaultTheme,initial:'admin-table'},undefined,{open:async url=>{
    await page.goto(url);await page.locator('#viewport').selectOption('360');const frame=page.frameLocator('#mobile-preview');
    for(const {id} of adminCatalog){
      await page.locator('[data-id='+id+']').click();await page.waitForFunction(()=>document.querySelector('#mobile-observation').textContent.startsWith('360 ×'));
      assert.match(await page.locator('#mobile-observation').innerText(),/가로 넘침 0px/);
      if(id==='admin-table'){
        assert(await frame.locator('.oc-admin-table-scroll').evaluate(el=>el.scrollWidth>el.clientWidth));
        await frame.getByLabel('상태',{exact:true}).selectOption('pending');assert.equal(await frame.locator('[data-admin-row]:visible').count(),2);
      }
      if(id==='admin-dashboard'){await frame.getByLabel('조회 기간').selectOption('month');assert.equal(await frame.locator('.oc-admin-number').first().innerText(),'1,048');}
    }
    await choose(page);
  }});
});
