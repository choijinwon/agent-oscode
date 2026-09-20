import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {erpCsvCell,erpCleanView} from '../src/design-erp-professional.js';
import {openDesignGallery} from '../src/design-gallery.js';
import {defaultTheme} from '../src/design-theme.js';
import {designRecipe} from '../src/design-recipes.js';
import {validateRegistry} from '../src/design-registry.js';
import {createHash} from 'node:crypto';

async function gallery(t,item,run){
 let chromium;try{chromium=(await import('playwright')).chromium;await fs.access(chromium.executablePath());}catch(e){if(process.env.CI)throw e;t.skip('Chromium required');return;}
 const b=await chromium.launch({headless:true});t.after(()=>b.close());const page=await b.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openDesignGallery({readOnly:false,permissions:{},approve:async()=>true,onPreview:()=>{}},{theme:defaultTheme,initial:item},undefined,{open:async url=>{
  await page.goto(url);await run(page,page.locator('#preview'));const response=page.waitForResponse(r=>r.url().endsWith('/select'));await page.locator('#choose').click();assert.equal((await response).status(),200);
 }});assert.deepEqual(errors,[]);
}
async function paste(input,text){await input.evaluate((el,text)=>{const data=new DataTransfer();data.setData('text/plain',text);el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));},text);}
const config={query:'',company:'all',currency:'all',status:'all',density:'comfortable',sort:'',direction:'ascending',hidden:[]};
test('expanded ERP recipes remain shareable in bounded team registries',()=>{
 for(const framework of ['react','vue','angular','svelte'])for(const id of ['erp-ledger','erp-journal']){const {code,css}=designRecipe({framework,item:id});const item={name:id,framework,code,css,description:'ERP',usage:'Local UI',hash:createHash('sha256').update(code+'\n'+css).digest('hex')};assert.doesNotThrow(()=>validateRegistry({version:1,items:[item]}));assert.throws(()=>validateRegistry({version:1,items:[{...item,code:'x'.repeat(64001)}]}),/code/);}
});
test('CSV escaping neutralizes spreadsheet formulas and preserves decimal strings; stored views accept only known configuration',()=>{
 for(const text of ['=1+1','+cmd','-cmd','@cmd','\tcmd','\rcmd','\ncmd','  =HYPERLINK("x")','\u0001=1'])assert(erpCsvCell(text).startsWith('"\''));
 assert.equal(erpCsvCell('999999999999999999.99'),'"999999999999999999.99"');assert.equal(erpCsvCell('한글,"메모"\n다음'),'"한글,""메모""\n다음"');
 assert.deepEqual(erpCleanView(JSON.stringify({...config,rows:['secret'],hidden:['date','date']})),{...config,hidden:['date']});
 for(const value of [null,[],{...config,query:'a'.repeat(101)},{...config,hidden:['company']},{...config,sort:'__proto__'},{...config,currency:'XXX'}])assert.equal(erpCleanView(JSON.stringify(value)),null);
});
test('saved views survive reload with column/density/sort settings, clear selection, isolate instances, and restore default order',async t=>{
 await gallery(t,'erp-ledger',async(page,p)=>{
  await p.locator('summary').click();await p.getByLabel('보기 이름').fill('기본');await p.getByRole('button',{name:'보기 저장',exact:true}).click();
  await p.getByLabel('회사 코드',{exact:true}).selectOption('1000');await p.getByLabel('통화',{exact:true}).selectOption('USD');await p.getByLabel('전기일',{exact:true}).uncheck();await p.getByLabel('행 간격').selectOption('compact');
  await p.getByRole('button',{name:'계정 ↕'}).click();await p.getByRole('button',{name:'계정 ↕'}).click();await p.getByLabel('보기 이름').fill('USD 마감');await p.getByRole('button',{name:'보기 저장',exact:true}).click();
  assert.equal(await p.locator('[data-erp-col=date]:visible').count(),0);assert.equal(await page.locator('#states [data-erp-view] option[value="USD 마감"]').count(),0);
  const stored=await page.evaluate(()=>Object.values(localStorage).join(''));assert(stored.includes('USD 마감'));assert(!stored.includes('190000001'));assert(!stored.includes('1250.50'));
  await page.reload();await p.locator('summary').click();await p.getByLabel('저장한 보기').selectOption('USD 마감');await p.getByRole('button',{name:'보기 적용',exact:true}).click();
  assert.equal(await p.locator('[data-erp-row]:visible').count(),2);assert.equal(await p.getByLabel('행 간격').inputValue(),'compact');assert.equal(await p.locator('[data-erp-col=date]:visible').count(),0);assert.equal(await p.locator('[data-erp-row]:visible').first().getAttribute('data-account'),'610200');
  await p.getByRole('checkbox',{name:'표시 행 전체 선택'}).check();await p.getByLabel('저장한 보기').selectOption('기본');await p.getByRole('button',{name:'보기 적용',exact:true}).click();assert.equal(await p.locator('[data-erp-select]:checked').count(),0);assert.equal(await p.locator('[data-erp-row]').first().getAttribute('data-row-id'),'l1');assert.equal(await p.locator('[data-erp-col=date]:visible').count(),7);
  await p.getByRole('button',{name:'필터 초기화'}).click();assert.equal(await p.getByLabel('행 간격').inputValue(),'comfortable');
  await p.getByLabel('저장한 보기').selectOption('USD 마감');await p.getByRole('button',{name:'보기 삭제',exact:true}).click();await page.reload();await p.locator('summary').click();assert.equal(await p.locator('[data-erp-view] option[value="USD 마감"]').count(),0);
 });
});
test('view count is bounded and unavailable browser storage falls back honestly without persisting journal values',async t=>{
 await gallery(t,'erp-ledger',async(page,p)=>{
  await p.locator('summary').click();for(let i=0;i<9;i++){await p.getByLabel('보기 이름').fill('보기'+i);await p.getByRole('button',{name:'보기 저장',exact:true}).click();}assert.match(await p.locator('[data-erp-status]').innerText(),/최대 8개/);assert.equal(await p.locator('[data-erp-view] option').count(),9);
  await page.locator('#viewport').selectOption('360');const frame=page.frameLocator('#mobile-preview');await frame.locator('summary').click();await frame.getByLabel('보기 이름').fill('임시');await frame.getByRole('button',{name:'보기 저장',exact:true}).click();assert.match(await frame.locator('[data-erp-status]').innerText(),/현재 화면에서만/);assert.equal(await frame.locator('[data-erp-view] option').count(),2);
 });
});
test('CSV download exports current filtered/selected rows, all accounting columns, escaped formulas and exact amounts including sandbox preview',async t=>{
 await gallery(t,'erp-ledger',async(page,p)=>{
  await p.getByLabel('통화',{exact:true}).selectOption('USD');await p.locator('[data-erp-select]').nth(2).check();
  await p.locator('[data-erp-row]').nth(2).evaluate(row=>{row.children[6].textContent='=HYPERLINK("test")';row.setAttribute('data-debit','999999999999999999.99');});
  const pending=page.waitForEvent('download');await p.getByRole('button',{name:'CSV 내보내기'}).click();const download=await pending;assert.equal(download.suggestedFilename(),'oscode-ledger.csv');const csv=await fs.readFile(await download.path(),'utf8');
  assert(csv.startsWith('\uFEFF'));assert.equal(csv.split('\r\n').length,3);assert(csv.includes('"\'=HYPERLINK(""test"")"'));assert(csv.includes('"999999999999999999.99"'));assert(csv.includes('"1000","2026"'));assert(csv.includes('"USD"'));
  await p.getByLabel('전표·계정·적요 검색').fill('없음');await p.getByRole('button',{name:'CSV 내보내기'}).click();assert.match(await p.locator('[data-erp-status]').innerText(),/내보낼 표시 행이 없습니다/);
  await page.locator('#viewport').selectOption('360');const frame=page.frameLocator('#mobile-preview');await frame.getByLabel('통화',{exact:true}).selectOption('USD');const next=page.waitForEvent('download');await frame.getByRole('button',{name:'CSV 내보내기'}).click();const mobileCsv=await fs.readFile(await (await next).path(),'utf8');assert.equal(mobileCsv.split('\r\n').length,4);assert(mobileCsv.includes('"1250.50"'));
 });
});
test('journal history coalesces typing, undoes paste/add/delete atomically, invalidates redo, preserves focus and navigates errors',async t=>{
 await gallery(t,'erp-journal',async(page,p)=>{
  const account=()=>p.getByLabel('1행 계정',{exact:true});await account().pressSequentially('600100');await page.keyboard.press('Control+z');assert.equal(await account().inputValue(),'');assert(await account().evaluate(el=>el===document.activeElement));await page.keyboard.press('Control+Shift+z');assert.equal(await account().inputValue(),'600100');
  await p.getByLabel('1행 적요',{exact:true}).fill('지출');await p.getByRole('button',{name:'되돌리기',exact:true}).click();await p.getByLabel('1행 적요',{exact:true}).fill('새 지출');assert(await p.getByRole('button',{name:'다시 실행',exact:true}).isDisabled());
  const before=await p.locator('[data-erp-cell]').evaluateAll(inputs=>inputs.map(el=>el.value));await paste(account(),Array(4).fill('600100\t비용\tCC100\t10\t').join('\n'));assert.equal(await p.locator('[data-journal-row]').count(),4);await p.getByRole('button',{name:'되돌리기',exact:true}).click();assert.equal(await p.locator('[data-journal-row]').count(),3);assert.deepEqual(await p.locator('[data-erp-cell]').evaluateAll(inputs=>inputs.map(el=>el.value)),before);await p.getByRole('button',{name:'다시 실행',exact:true}).click();assert.equal(await p.locator('[data-journal-row]').count(),4);
  const ids=await p.locator('[data-journal-row]').evaluateAll(rows=>rows.map(row=>row.dataset.lineId));await p.getByRole('button',{name:'2행 삭제',exact:true}).click();await p.getByRole('button',{name:'되돌리기',exact:true}).click();assert.deepEqual(await p.locator('[data-journal-row]').evaluateAll(rows=>rows.map(row=>row.dataset.lineId)),ids);
  await p.getByRole('button',{name:'행 추가',exact:true}).click();const count=await p.locator('[data-journal-row]').count();await p.getByRole('button',{name:'되돌리기',exact:true}).click();assert.equal(await p.locator('[data-journal-row]').count(),count-1);
  await p.getByRole('button',{name:'다음 오류',exact:true}).click();assert(await p.getByLabel('회사 코드',{exact:true}).evaluate(el=>el===document.activeElement));await p.getByRole('button',{name:'다음 오류',exact:true}).click();assert(await p.getByLabel('전기일',{exact:true}).evaluate(el=>el===document.activeElement));
  await p.getByLabel('1행 차변',{exact:true}).fill('bad');await p.getByRole('button',{name:'이전 오류',exact:true}).click();assert(await account().evaluate(el=>el===document.activeElement));assert.match(await p.locator('[data-erp-dirty]').innerText(),/저장 전/);assert.equal(await page.locator('#states [data-erp-cell]').first().inputValue(),'');
  assert.equal(await page.evaluate(()=>Object.values(localStorage).length),0);
 });
});
test('journal history retains only twenty operations and never treats a draft event as saved',async t=>{
 await gallery(t,'erp-journal',async(page,p)=>{
  for(let i=1;i<=25;i++){await p.getByLabel('1행 적요',{exact:true}).fill(String(i));await p.getByLabel('2행 적요',{exact:true}).focus();}
  for(let i=0;i<20;i++)await p.getByRole('button',{name:'되돌리기',exact:true}).click();assert.equal(await p.getByLabel('1행 적요',{exact:true}).inputValue(),'5');assert(await p.getByRole('button',{name:'되돌리기',exact:true}).isDisabled());
  await p.getByLabel('회사 코드',{exact:true}).fill('1000');await p.getByLabel('전기일',{exact:true}).fill('2026-09-20');await paste(p.getByLabel('1행 계정',{exact:true}),'600100\t비용\tCC100\t100\t\n210100\t미지급\tCC100\t\t100');await p.getByRole('button',{name:'검증된 초안 전달'}).click();assert.match(await p.locator('[data-erp-dirty]').innerText(),/저장 전/);assert.match(await p.locator('[data-erp-status]').innerText(),/실제 SAP 전기·저장 완료가 아닙니다/);
 });
});
