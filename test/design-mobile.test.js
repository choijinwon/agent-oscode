import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceTools} from '../src/tools.js';
import {DesignStudio} from '../src/design-studio.js';
import {defaultTheme} from '../src/design-theme.js';
import {mobileCatalog} from '../src/design-mobile.js';
import {designRecipe} from '../src/design-recipes.js';
import {openDesignGallery} from '../src/design-gallery.js';

async function browser(t) {
  let chromium;
  try {chromium=(await import('playwright')).chromium;await fs.access(chromium.executablePath());}
  catch(e){if(process.env.CI)throw e;t.skip('Chromium required');return;}
  const instance=await chromium.launch({headless:true});t.after(()=>instance.close());return instance;
}
const tools=()=>({readOnly:false,permissions:{},approve:async()=>true,onPreview:()=>{}});
async function choose(page){const response=page.waitForResponse(r=>r.url().endsWith('/select'));await page.locator('#choose').click();assert.equal((await response).status(),200);}

test('mobile command opens the phone preview, accepts touch input and applies the selected framework files',async t=>{
  const b=await browser(t);if(!b)return;
  const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-mobile-')));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const workspace=new WorkspaceTools(root,{approve:async()=>true}),studio=new DesignStudio(workspace);
  const page=await b.newPage({viewport:{width:430,height:900},hasTouch:true,isMobile:true});
  await studio.command('mobile svelte',undefined,{open:async url=>{
    await page.goto(url);
    assert.equal(await page.locator('#viewport').inputValue(),'390');
    assert.equal(await page.locator('#framework').inputValue(),'svelte');
    const frame=page.frameLocator('#mobile-preview');
    await frame.getByRole('tab',{name:'저장',exact:true}).tap();
    assert(await frame.getByRole('heading',{name:'저장한 항목'}).isVisible());
    await choose(page);
  }});
  assert.match(await studio.command('code'),/\$props/);
  await studio.command('apply MobileTabs.svelte');
  assert.match(await fs.readFile(path.join(root,'MobileTabs.svelte'),'utf8'),/oc-mobile-tabs/);
  assert.match(await fs.readFile(path.join(root,'MobileTabs.css'),'utf8'),/safe-area-inset-bottom/);
  workspace.readOnly=true;
  await assert.rejects(studio.command('mobile'),/BUILD/);
});

test('mobile recipes share four adapters, preserve safe-area CSS, and avoid adding mobile styles to desktop recipes',()=>{
  assert.equal(mobileCatalog.length,5);
  for(const framework of ['react','vue','angular','svelte'])for(const item of mobileCatalog){
    const recipe=designRecipe({framework,item:item.id});
    assert(recipe.code.includes('data-mobile='));assert(recipe.css.includes('env(safe-area-inset-bottom'));
    assert(!recipe.code.includes('__id__'));assert(!recipe.code.includes('34px'),'simulated inset must not enter source');
    if(item.id==='mobile-form')assert(recipe.code.replaceAll('\\"','"').includes(framework==='react'?'inputMode="tel"':'inputmode="tel"'));
  }
  assert(!designRecipe({framework:'react',item:'button'}).css.includes('.oc-sheet'));
});

test('mobile preview has exact CSS widths, touch targets, isolated tab state and safe-area padding',async t=>{
  const b=await browser(t);if(!b)return;const page=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const selected=await openDesignGallery(tools(),{theme:defaultTheme},undefined,{open:async url=>{
    await page.goto(url);await page.locator('[data-id="mobile-tabs"]').click();
    assert.equal(await page.locator('#viewport').inputValue(),'390');
    const frame=page.frameLocator('#mobile-preview');
    await frame.getByRole('tab',{name:'저장',exact:true}).click();
    assert(await frame.getByRole('heading',{name:'저장한 항목'}).isVisible());
    assert.equal(await page.locator('#states [role=tab]').first().getAttribute('aria-selected'),'true');
    await frame.getByRole('tab',{name:'저장',exact:true}).focus();await page.keyboard.press('End');
    assert.equal(await frame.getByRole('tab',{name:'내 계정',exact:true}).getAttribute('aria-selected'),'true');
    for(const width of ['360','390','430']){
      await page.locator('#viewport').selectOption(width);
      await page.waitForFunction(w=>document.querySelector('#mobile-observation').textContent.startsWith(w+' × 560'),width);
      const contentFrame=await (await page.locator('#mobile-preview').elementHandle()).contentFrame();
      assert.equal(await contentFrame.evaluate(()=>innerWidth),Number(width));
      assert.match(await page.locator('#mobile-observation').innerText(),/가로 넘침 0px · 44px 미만 터치 영역 0개/);
    }
    await page.locator('#size').selectOption('small');await page.locator('#safe-area').check();
    await page.waitForFunction(()=>document.querySelector('#mobile-observation').textContent.startsWith('430 ×'));
    assert.equal(await frame.locator('.oc-mobile-tabs').evaluate(el=>getComputedStyle(el).paddingBottom),'34px');
    assert.match(await page.locator('#mobile-observation').innerText(),/44px 미만 터치 영역 0개/);
    await page.evaluate(()=>window.postMessage({type:'oscode-mobile-observation',width:1,height:1,overflow:999,smallTargets:999},'*'));
    assert(!await page.locator('#mobile-observation').innerText().then(x=>x.includes('999')));
    await page.setViewportSize({width:360,height:800});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await choose(page);
  }});
  assert.equal(selected.item,'mobile-tabs');assert(!('viewport' in selected));assert.deepEqual(errors,[]);
});

test('bottom sheet is confined to the phone viewport, returns focus and emits local actions',async t=>{
  const b=await browser(t);if(!b)return;const page=await b.newPage();
  await openDesignGallery(tools(),{theme:defaultTheme},undefined,{open:async url=>{
    await page.goto(url);await page.locator('[data-id="bottom-sheet"]').click();
    const frame=page.frameLocator('#mobile-preview');await frame.getByRole('button',{name:'작업 선택',exact:true}).click();
    assert(await frame.getByRole('dialog').isVisible());
    assert(await frame.getByRole('dialog').evaluate(el=>Math.abs(el.getBoundingClientRect().bottom-innerHeight)<2));
    await page.keyboard.press('Escape');assert(!await frame.getByRole('dialog').isVisible());
    assert(await frame.getByRole('button',{name:'작업 선택',exact:true}).evaluate(el=>document.activeElement===el));
    await frame.getByRole('button',{name:'작업 선택',exact:true}).click();await frame.getByRole('button',{name:'목록에 저장',exact:true}).click();
    assert(!await frame.getByRole('dialog').isVisible());assert.match(await frame.locator('[data-sheet-result]').innerText(),/목록에 저장 선택됨/);
    await frame.getByRole('button',{name:'작업 선택',exact:true}).click();await frame.getByRole('button',{name:'닫기',exact:true}).click();
    assert(!await frame.getByRole('dialog').isVisible());
    await choose(page);
  }});
});

test('mobile form remains editable in a simulated keyboard viewport; list has separate loading and selection states',async t=>{
  const b=await browser(t);if(!b)return;const page=await b.newPage();
  await openDesignGallery(tools(),{theme:defaultTheme},undefined,{open:async url=>{
    await page.goto(url);await page.locator('[data-id="mobile-form"]').click();await page.locator('#keyboard').check();
    await page.waitForFunction(()=>document.querySelector('#mobile-observation').textContent.startsWith('390 × 320'));
    const frame=page.frameLocator('#mobile-preview');
    await frame.getByLabel('이름',{exact:true}).fill('모바일 사용자');await frame.getByLabel('이메일',{exact:true}).fill('invalid');
    await frame.getByLabel('연락처',{exact:true}).fill('01012345678');
    await page.waitForFunction(()=>document.querySelector('#mobile-observation').textContent.endsWith('입력 가림 없음'));
    await frame.getByRole('button',{name:'입력 완료',exact:true}).click();assert.equal(await frame.locator('[data-feedback]').innerText(),'');
    await frame.getByLabel('이메일',{exact:true}).fill('mobile@example.com');await frame.getByRole('button',{name:'입력 완료',exact:true}).click();
    assert.match(await frame.locator('[data-feedback]').innerText(),/입력을 확인/);
    await page.locator('[data-id="mobile-list"]').click();
    await frame.getByRole('button',{name:/모바일 스토어/}).click();assert.match(await frame.locator('[data-mobile-result]').innerText(),/모바일 스토어 선택됨/);
    const loading=page.locator('#states [aria-busy=true]');assert(await loading.locator('.oc-mobile-skeleton').isVisible());assert(!await loading.locator('.oc-mobile-list').isVisible());
    await page.locator('[data-id="sticky-action"]').click();await frame.getByRole('button',{name:'시작하기',exact:true}).waitFor({state:'visible'});await frame.getByRole('button',{name:'시작하기',exact:true}).click();
    await choose(page);
  }});
});
