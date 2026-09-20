import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceTools} from '../src/tools.js';
import {DesignStudio} from '../src/design-studio.js';
import {designRecipe} from '../src/design-recipes.js';
import {erpCatalog} from '../src/design-erp.js';
import {erpScale,erpParseAmount,erpFormatAmount,erpValidateJournal} from '../src/design-erp-money.js';
import {openDesignGallery} from '../src/design-gallery.js';
import {defaultTheme} from '../src/design-theme.js';

async function browser(t){let chromium;try{chromium=(await import('playwright')).chromium;await fs.access(chromium.executablePath());}catch(e){if(process.env.CI)throw e;t.skip('Chromium required');return;}const b=await chromium.launch({headless:true});t.after(()=>b.close());return b;}
const tools=()=>({readOnly:false,permissions:{},approve:async()=>true,onPreview:()=>{}});
async function choose(page){const response=page.waitForResponse(r=>r.url().endsWith('/select'));await page.locator('#choose').click();assert.equal((await response).status(),200);}
async function paste(locator,text){await locator.evaluate((input,text)=>{const data=new DataTransfer();data.setData('text/plain',text);input.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));},text);}
const line=(id,debit='',credit='',account='600100')=>({id,account,description:'예시',costCenter:'CC100',debit,credit});

test('ERP amounts retain precision, reject malformed grouping and never round unsupported fractions',()=>{
 assert.equal(erpParseAmount('0.10',2)+erpParseAmount('0.20',2),30n);
 assert.equal(erpFormatAmount(erpParseAmount('999,999,999,999,999,999.99',2),2),'999,999,999,999,999,999.99');
 assert.equal(erpFormatAmount(-1n,2),'-0.01');assert.equal(erpParseAmount('1,234',0),1234n);
 for(const value of ['-1','+1','1e3','NaN','Infinity','12,34','1,234,56','1.001','1.','1 000','1'.repeat(19)])assert.equal(erpParseAmount(value,2),null,value);
 assert.equal(erpParseAmount('1.0',0),null);assert.equal(erpParseAmount('',2),0n);assert.equal(erpScale('JPY'),0);assert.throws(()=>erpScale('XXX'));
});

test('journal validation requires two positive single-sided lines and exact balance',()=>{
 const result=erpValidateJournal([line('a','0.10'),line('b','0.20'),line('c','','0.30')],'USD');
 assert(result.valid);assert.equal(result.debitMinor,'30');assert.equal(result.creditMinor,'30');assert.equal(result.differenceMinor,'0');assert.doesNotThrow(()=>JSON.stringify(result));
 assert(!erpValidateJournal([line('a','10'),line('b','','9')]).valid);
 assert(!erpValidateJournal([line('a','10','10')]).valid);
 assert(!erpValidateJournal([line('a','0'),line('b','','0')]).valid);
 assert(!erpValidateJournal([line('a','10','',''),line('b','','10')]).valid);
 assert(!erpValidateJournal([line('a','10.01'),line('b','','10')],'KRW').valid);
 const invalid=erpValidateJournal([line('a','bad'),line('b','','10')]);assert.equal(invalid.debitMinor,null);assert.equal(invalid.differenceMinor,null);
 assert(erpValidateJournal([line('a','100'),line('b','','100'),{id:'empty',account:'',description:'',costCenter:'',debit:'',credit:''}]).valid);
});

test('ERP command selects and generates four-framework starters under existing write protection',async t=>{
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-erp-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const workspace=new WorkspaceTools(root,{approve:async()=>true}),studio=new DesignStudio(workspace),b=await browser(t);if(!b)return;const page=await b.newPage();
 await studio.command('erp vue',undefined,{open:async url=>{await page.goto(url);assert.equal(await page.locator('.catalog-item').count(),2);await page.locator('[data-id=erp-journal]').click();await choose(page);}});
 await studio.command('apply Journal.vue');assert.match(await fs.readFile(path.join(root,'Journal.vue'),'utf8'),/erp-draft/);await assert.rejects(studio.command('apply Journal.vue'),/덮어쓰지/);
 const catalog=await workspace.execute('design_catalog',{query:'회계'});assert.equal(catalog.is_error,false);assert(catalog.content.includes('erp-journal'));
 workspace.readOnly=true;await assert.rejects(studio.command('erp'),/BUILD/);
 for(const framework of ['react','vue','angular','svelte'])for(const {id} of erpCatalog){const recipe=designRecipe({framework,item:id});assert(!recipe.code.includes('__id__'));assert(recipe.code.includes('function erpAction'));assert(recipe.css.includes('.oc-erp-scroll'));}
 assert(!designRecipe({framework:'react',item:'button'}).code.includes('function erpAction'));
});

test('ledger filters and sorts rows with separate company/currency totals and resets hidden selection',async t=>{
 const b=await browser(t);if(!b)return;const page=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openDesignGallery(tools(),{theme:defaultTheme,initial:'erp-ledger'},undefined,{open:async url=>{
  await page.goto(url);const p=page.locator('#preview');assert.equal(await p.locator('[data-erp-totals] p').count(),3);
  await p.getByRole('checkbox',{name:'표시 행 전체 선택'}).check();assert.match(await p.getByRole('status').innerText(),/선택 6행/);
  await p.getByLabel('회사 코드',{exact:true}).selectOption('1000');assert.equal(await p.locator('[data-erp-row]:visible').count(),4);assert.equal(await p.locator('[data-erp-select]:checked').count(),0);assert.equal(await p.locator('[data-erp-totals] p').count(),2);
  await p.getByLabel('통화',{exact:true}).selectOption('USD');assert.equal(await p.locator('[data-erp-row]:visible').count(),2);assert.equal(await p.locator('[data-erp-totals]').innerText(),'1000 · USD · 차변 1,250.50 · 대변 1,250.50 · 차이 0.00');
  await p.getByLabel('전표·계정·적요 검색').fill('610200');assert.equal(await p.locator('[data-erp-row]:visible').count(),1);assert.match(await p.locator('[data-erp-totals]').innerText(),/대변 0.00 · 차이 1,250.50/);
  await p.getByRole('checkbox',{name:'표시 행 전체 선택'}).check();await p.getByRole('button',{name:'선택 행 검토'}).click();assert.match(await p.getByRole('status').innerText(),/1행 검토/);assert.equal(await page.locator('#states [data-erp-select]:checked').count(),0);
  await p.getByLabel('전표·계정·적요 검색').fill('없음');assert(await p.locator('[data-erp-empty]').isVisible());assert(await p.getByRole('button',{name:'선택 행 검토'}).isDisabled());assert.equal(await p.locator('[data-erp-totals]').innerText(),'표시 행 없음 · 합계 없음');
  await p.getByRole('button',{name:'필터 초기화'}).click();await p.getByRole('button',{name:'전기일 ↕'}).click();await p.getByRole('button',{name:'전기일 ↕'}).click();assert.equal(await p.locator('[data-erp-row]').first().getAttribute('data-date'),'2026-09-05');
  await p.getByLabel('전표 상태').selectOption('draft');assert.equal(await p.locator('[data-erp-row]:visible').count(),2);await choose(page);
 }});assert.deepEqual(errors,[]);
});

test('journal edits, validation, keyboard navigation, currency lock and independent totals work in the browser',async t=>{
 const b=await browser(t);if(!b)return;const page=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openDesignGallery(tools(),{theme:defaultTheme,initial:'erp-journal'},undefined,{open:async url=>{
  await page.goto(url);const p=page.locator('#preview');await p.getByLabel('회사 코드',{exact:true}).fill('1000');await p.getByLabel('전기일',{exact:true}).fill('2026-09-20');await p.getByLabel('전표 통화').selectOption('USD');
  await p.getByLabel('1행 계정',{exact:true}).fill('600100');await p.getByLabel('1행 차변',{exact:true}).fill('0.10');assert(await p.getByLabel('전표 통화').isDisabled());
  await p.getByLabel('2행 계정',{exact:true}).fill('600200');await p.getByLabel('2행 차변',{exact:true}).fill('0.20');await p.getByLabel('3행 계정',{exact:true}).fill('210100');await p.getByLabel('3행 대변',{exact:true}).fill('0.30');
  assert.equal(await p.locator('[data-journal-debit]').innerText(),'0.30 USD');assert.equal(await p.locator('[data-journal-difference]').innerText(),'0.00 USD');assert(await p.getByRole('button',{name:'검증된 초안 전달'}).isEnabled());
  assert.equal(await page.locator('#states [data-journal-debit]').first().innerText(),'0 KRW');
  await p.getByLabel('2행 차변',{exact:true}).fill('0.21');assert(await p.getByRole('button',{name:'검증된 초안 전달'}).isDisabled());assert.equal(await p.locator('[data-journal-difference]').innerText(),'0.01 USD');
  await p.getByLabel('2행 차변',{exact:true}).fill('0.20');await p.getByLabel('1행 대변',{exact:true}).fill('1');assert.match(await p.locator('[data-line-error]').first().innerText(),/한쪽만/);assert(await p.getByRole('button',{name:'검증된 초안 전달'}).isDisabled());
  await p.getByLabel('1행 대변',{exact:true}).fill('');await p.getByLabel('1행 계정',{exact:true}).focus();await page.keyboard.press('Enter');assert(await p.getByLabel('2행 계정',{exact:true}).evaluate(el=>el===document.activeElement));await page.keyboard.press('Alt+ArrowRight');assert(await p.getByLabel('2행 적요',{exact:true}).evaluate(el=>el===document.activeElement));
  await p.getByRole('button',{name:'검증된 초안 전달'}).click();assert.match(await p.locator('[data-erp-status]').innerText(),/실제 SAP 전기·저장 완료가 아닙니다/);
  await p.getByLabel('회사 코드',{exact:true}).fill('A');assert(await p.getByRole('button',{name:'검증된 초안 전달'}).isDisabled());await choose(page);
 }});assert.deepEqual(errors,[]);
});

test('spreadsheet paste is bounded and atomic; new/deleted rows retain stable unique IDs',async t=>{
 const b=await browser(t);if(!b)return;const page=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openDesignGallery(tools(),{theme:defaultTheme,initial:'erp-journal'},undefined,{open:async url=>{
  await page.goto(url);const p=page.locator('#preview'),first=p.getByLabel('1행 계정',{exact:true});
  const data='600100\t비용\tCC100\t1,000\t\r\n210100\t미지급금\tCC100\t\t1,000\r\n';await paste(first,data);assert.equal(await p.getByLabel('2행 대변',{exact:true}).inputValue(),'1,000');assert.equal(await p.locator('[data-journal-difference]').innerText(),'0 KRW');
  const before=await p.locator('[data-erp-cell]').evaluateAll(inputs=>inputs.map(input=>input.value));
  for(const text of ['600200\tbad\tCC100\t12,34\t','x\tx\tx\t1\t0\textra',Array(201).fill('600100\tx\tCC100\t1\t').join('\n')]){await paste(first,text);assert.match(await p.locator('[data-erp-status]').innerText(),/붙여넣기 취소/);assert.deepEqual(await p.locator('[data-erp-cell]').evaluateAll(inputs=>inputs.map(input=>input.value)),before);}
  await paste(first,Array(4).fill('600100\t<img src=x>\tCC100\t1\t').join('\n'));assert.equal(await p.locator('[data-journal-row]').count(),4);assert.equal(await p.locator('img').count(),0);
  await p.getByRole('button',{name:'2행 삭제',exact:true}).click();await p.getByRole('button',{name:'행 추가',exact:true}).click();assert.equal(await p.locator('[data-journal-row]').count(),4);
  const ids=await p.locator('[data-journal-row]').evaluateAll(rows=>rows.map(row=>row.dataset.lineId));assert.equal(new Set(ids).size,4);assert.deepEqual(ids,['line-1','line-3','line-4','line-5']);
  assert(await p.getByLabel('4행 계정',{exact:true}).evaluate(el=>el===document.activeElement));await choose(page);
 }});assert.deepEqual(errors,[]);
});

test('ERP tables scroll within the phone viewport and mobile grid uses exact totals',async t=>{
 const b=await browser(t);if(!b)return;const page=await b.newPage({viewport:{width:1440,height:1000}});
 await openDesignGallery(tools(),{theme:defaultTheme,initial:'erp-ledger'},undefined,{open:async url=>{
  await page.goto(url);await page.locator('#viewport').selectOption('360');const frame=page.frameLocator('#mobile-preview');
  for(const {id} of erpCatalog){await page.locator('[data-id='+id+']').click();await page.waitForFunction(()=>document.querySelector('#mobile-observation').textContent.startsWith('360 ×'));assert.match(await page.locator('#mobile-observation').innerText(),/가로 넘침 0px/);assert(await frame.locator('.oc-erp-scroll').evaluate(el=>el.scrollWidth>el.clientWidth));
   await frame.locator('.oc-erp-scroll').evaluate(async el=>{el.scrollLeft=400;await new Promise(requestAnimationFrame);});
   const pinned=frame.locator(id==='erp-ledger'?'thead th:nth-child(2)':'thead th:first-child');
   const header=await pinned.boundingBox(),row=await frame.locator('tbody th').first().boundingBox();assert(Math.abs(header.x-row.x)<2,'frozen header must align with its cells');
  }
  await paste(frame.getByLabel('1행 계정',{exact:true}),'600100\t비용\tCC100\t100\t\n210100\t미지급\tCC100\t\t100');assert.equal(await frame.locator('[data-journal-debit]').innerText(),'100 KRW');assert.equal(await frame.locator('[data-journal-difference]').innerText(),'0 KRW');await choose(page);
 }});
});
