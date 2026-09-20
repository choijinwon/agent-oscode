import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceTools} from '../src/tools.js';
import {DesignStudio} from '../src/design-studio.js';
import {designRecipe} from '../src/design-recipes.js';
import {themeComponentRecipe,themeComponentCss,applyThemeComponent} from '../src/design-theme-component.js';
import {designTokenStyle} from '../src/design-token-values.js';
import {defaultTheme} from '../src/design-theme.js';
import {openDesignGallery} from '../src/design-gallery.js';
import {registerDesign,applyRegistry} from '../src/design-registry.js';

async function fixture(t){
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-shared-style-')));
 t.after(()=>fs.rm(root,{force:true,recursive:true}));
 return {root,tools:new WorkspaceTools(root,{approve:async()=>true})};
}
async function browser(t){
 let chromium;
 try{chromium=(await import('playwright')).chromium;await fs.access(chromium.executablePath());}
 catch(e){if(process.env.CI)throw e;t.skip('Chromium required');return;}
 const b=await chromium.launch({headless:true});t.after(()=>b.close());return b;
}

test('theme code is available in PLAN in bounded chunks, and mutations retain preflight/approval gates',async t=>{
 const {tools,root}=await fixture(t),studio=new DesignStudio(tools);
 tools.readOnly=true;tools.outputLimit=1100;
 assert.match(await studio.command('theme code react'),/DesignTheme/);
 for(const section of ['code','css']){
  let actual='',offset=0;
  do{
   const r=await tools.execute('design_recipe',{component:'theme',framework:'react',section,offset});assert.equal(r.is_error,false);assert(r.content.length<=1100);
   actual+=r.content.split('\n').slice(2).join('\n');
   const next=/nextOffset: (\d+|done)/.exec(r.content)[1];if(next==='done')break;offset=+next;
  }while(offset<10000);
  assert.equal(actual,themeComponentRecipe('react')[section]);
 }
 await assert.rejects(studio.command('theme component react Theme.jsx'),/BUILD/);
 await assert.rejects(fs.access(path.join(root,'Theme.jsx')),{code:'ENOENT'});
 tools.readOnly=false;
 await fs.writeFile(path.join(root,'Occupied.css'),'existing styles');
 await assert.rejects(studio.command('theme component react Occupied.jsx'),/덮어쓰지/);
 await assert.rejects(fs.access(path.join(root,'Occupied.jsx')),{code:'ENOENT'});
 await fs.writeFile(path.join(root,'package.json'),JSON.stringify({dependencies:{vue:'^3.5.0'}}));
 await assert.rejects(applyThemeComponent(tools,'react','Wrong.jsx'),/다릅니다/);
 await fs.unlink(path.join(root,'package.json'));
 await assert.rejects(applyThemeComponent(tools,'react','../Escape.jsx'),/outside/);
 tools.approve=async(_,name)=>name!=='Partial.css';
 await assert.rejects(applyThemeComponent(tools,'react','Partial.jsx'),/생성 완료: Partial.jsx/);
 await assert.rejects(fs.access(path.join(root,'Partial.css')),{code:'ENOENT'});
 for(const command of ['theme code other','theme component vue','theme component unknown Theme.jsx','theme code vue extra'])await assert.rejects(studio.command(command));
});

test('all theme components retain portable CSS imports through team registration and renamed application',async t=>{
 const {root,tools}=await fixture(t);
 for(const [framework,ext]of [['react','jsx'],['vue','vue'],['svelte','svelte'],['angular','ts']]){
  const filename=`${framework}Theme.${ext}`,r=await applyThemeComponent(tools,framework,filename);
  assert.equal(r.created.length,2);
  const item=await registerDesign(tools,framework+'-theme',{framework,path:filename,css:`${framework}Theme.css`});
  await applyRegistry(tools,item,`Shared${framework}.${ext}`);
  assert.match(await fs.readFile(path.join(root,`Shared${framework}.${ext}`),'utf8'),new RegExp('Shared'+framework+'\\.css'));
 }
});

test('page token overrides accept only supported literal CSS values and never mutate caller objects',()=>{
 const input=Object.freeze({accent:'#4338ca',radius:'20px'});
 assert.deepEqual(designTokenStyle(input),{'--oc-theme-accent':'#4338ca','--oc-theme-radius':'20px'});
 assert.deepEqual(designTokenStyle(),{});
 for(const value of [null,[],{unknown:'red'},{accent:'url(https://example.com)'},{font:'x; color:red'},{spacing:'-2px'},{accent:123}])assert.throws(()=>designTokenStyle(value));
 assert.throws(()=>themeComponentCss(defaultTheme,'bad"scope'));
 assert.throws(()=>themeComponentRecipe('react',defaultTheme,'Bad.vue'));
});

test('one shared theme updates siblings, page overrides remain local, nested themes inherit and unwrapped UI stays independent',async t=>{
 const b=await browser(t);if(!b)return;
 const page=await b.newPage({reducedMotion:'reduce'}),component=designRecipe({framework:'react',item:'button'}),scope=/data-design="([^"]+)/.exec(component.code)[1];
 const markup=id=>`<section id="${id}" class="oc-design" data-design="${scope}"><button>저장</button></section>`;
 await page.setContent(`<style id="common">${themeComponentCss({...defaultTheme,accent:'#0f766e'},'shared')}</style><style>${themeComponentCss({...defaultTheme,accent:'#ff0000'},'nested')}${component.css}</style>
 <div data-oc-theme="shared">${markup('home')}</div>
 <div id="page" data-oc-theme="shared" style="--oc-theme-accent:#4338ca;--oc-theme-radius:20px">${markup('account')}
  <div data-oc-theme="nested" style="--oc-theme-spacing:24px">${markup('nested')}</div>
 </div>${markup('outside')}<button id="unrelated">외부 버튼</button>`);
 const color=id=>page.locator('#'+id+' button').evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.equal(await color('home'),'rgb(15, 118, 110)');assert.equal(await color('account'),'rgb(67, 56, 202)');assert.equal(await color('nested'),'rgb(67, 56, 202)');
 assert.equal(await page.locator('#nested').evaluate(el=>getComputedStyle(el).borderRadius),'20px');
 assert.equal(await page.locator('#nested').evaluate(el=>getComputedStyle(el).padding),'24px');
 const unrelated=await page.locator('#unrelated').evaluate(el=>getComputedStyle(el).backgroundColor);
 await page.locator('#common').evaluate((el,css)=>el.textContent=css,themeComponentCss({...defaultTheme,accent:'#c2410c',radius:'8px'},'shared'));
 assert.equal(await color('home'),'rgb(194, 65, 12)');assert.equal(await color('account'),'rgb(67, 56, 202)');assert.equal(await color('outside'),'rgb(15, 118, 110)');
 await page.locator('#page').evaluate(el=>el.removeAttribute('style'));
 assert.equal(await color('account'),'rgb(194, 65, 12)');assert.equal(await color('nested'),'rgb(194, 65, 12)');
 assert.equal(await page.locator('#nested').evaluate(el=>getComputedStyle(el).borderRadius),'8px');
 assert.equal(await page.locator('#unrelated').evaluate(el=>getComputedStyle(el).backgroundColor),unrelated);
});

test('gallery previews shared and page styles independently, and offers matching framework usage and copy',async t=>{
 const b=await browser(t);if(!b)return;const {tools}=await fixture(t),context=await b.newContext({permissions:['clipboard-read','clipboard-write']}),page=await context.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await openDesignGallery(tools,{theme:defaultTheme},undefined,{open:async url=>{
  await page.goto(url);await page.locator('#reuse-styles>summary').click();
  const color=key=>page.locator(`[data-reuse-page="${key}"] button`).evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.equal(await color('shared'),'rgb(15, 118, 110)');
  await page.locator('#page-accent').fill('#c2410c');
  assert.equal(await color('page'),'rgb(194, 65, 12)');assert.equal(await color('shared'),'rgb(15, 118, 110)');
  for(const [f,ext]of [['react','jsx'],['vue','vue'],['angular','ts'],['svelte','svelte']]){
   await page.locator('#framework').selectOption(f);
   assert.match(await page.locator('#theme-command').innerText(),new RegExp(f+' src/components/DesignTheme\\.'+ext));
   await page.locator('#copy-theme-command').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),await page.locator('#theme-command').innerText());
  }
  await page.setViewportSize({width:360,height:800});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#choose').click();
 }});
 assert.deepEqual(errors,[]);
});
