import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer} from 'node:http';
import {recordingState,captureScenario,recordUi} from '../src/ui-recorder.js';
import {runScenario} from '../src/ui-workflow.js';
import {WorkspaceTools} from '../src/tools.js';

test('recorder coalesces input, requires assertions, bounds steps and rejects malformed events',()=>{
 const state=recordingState();
 state.accept({type:'step',step:{action:'fill',selector:'#name',value:'a'}});
 assert.equal(state.accept({type:'step',step:{action:'fill',selector:'#name',value:'abc'}}).canSave,false);
 assert.equal(state.scenario.steps.length,1);assert.equal(state.scenario.steps[0].value,'abc');
 assert(state.accept({type:'step',step:{action:'visible',selector:'#result'}}).canSave);
 assert.equal(state.accept({type:'undo'}).canSave,false);
 for(let i=0;i<20;i++)state.accept({type:'step',step:{action:'click',selector:'button'}});
 assert.equal(state.scenario.steps.length,20);assert.equal(state.accept({type:'finish'}).invalid,true);
 assert(recordingState().accept({type:'step',step:{action:'eval',selector:'body'}}).invalid);
});
test('record command obeys PLAN and project permission denials before browser launch',async()=>{
 for(const options of [{readOnly:true},{permissions:{shell:'deny'}},{permissions:{write:'deny'}}]){
  await assert.rejects(recordUi(new WorkspaceTools(process.cwd(),options),'http://localhost:3000'),/PLAN|권한/);
 }
});
test('real browser records interactions, selected assertions, saves and replays a scenario',async t=>{
 const {chromium}=await import('playwright');
 try{await fs.access(chromium.executablePath());}catch{if(process.env.CI)throw Error('Chromium required');t.skip('Chromium unavailable');return;}
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-recorder-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const server=createServer((req,res)=>{res.setHeader('content-type','text/html');res.end('<input id="name"><button id="save" onclick="document.querySelector(\'#result\').textContent=\'Saved\'">Save</button><p id="result">Ready</p><button id="disabled" disabled>Disabled</button><input id="password" type="password">');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const url=`http://127.0.0.1:${server.address().port}/`;
 const result=await recordUi(new WorkspaceTools(root,{approve:async()=>true}),url,undefined,{chromium,onPage:async page=>{
  await page.locator('#name').fill('Ada');await page.locator('#save').click();
  await page.getByLabel('검증 조건').selectOption('text');await page.locator('#result').click();
  await page.getByLabel('검증 조건').selectOption('disabled');
  const box=await page.locator('#disabled').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await page.getByLabel('검증 조건').selectOption('enabled');await page.locator('#save').click();
  await page.getByLabel('검증 조건').selectOption('visible');await page.locator('#result').click();
  await page.locator('#oscode-recorder').getByRole('button',{name:'녹화 완료',exact:true}).click();
 }});
 const file=(await fs.readdir(root)).find(f=>f.startsWith('oscode-scenario-'));
 assert(file);assert.match(result,/아직 재생 검증하지 않았습니다/);
 const scenario=JSON.parse(await fs.readFile(path.join(root,file),'utf8'));
 assert(scenario.steps.some(s=>s.action==='text'&&s.value==='Saved'));
 assert(scenario.steps.some(s=>s.action==='disabled'));assert(scenario.steps.some(s=>s.action==='enabled'));
 assert(!scenario.steps.some(s=>s.selector.includes('oscode-recorder')));
 const browser=await chromium.launch();try{const page=await browser.newPage();await page.goto(url);assert.equal((await runScenario(page,scenario)).passed,true);}finally{await browser.close();}
 await assert.rejects(captureScenario({url,chromium,onPage:async page=>{
  await page.locator('#password').fill('not-a-real-secret');
  await page.waitForFunction(()=>document.querySelector('#oscode-recorder').shadowRoot.querySelector('output').textContent.includes('민감'));
  assert(await page.locator('#oscode-recorder').getByRole('button',{name:'녹화 완료',exact:true}).isDisabled());
  await page.locator('#oscode-recorder').getByRole('button',{name:'취소',exact:true}).click();
 }}),/취소/);
 const controller=new AbortController();
 await assert.rejects(captureScenario({url,chromium,signal:controller.signal,onPage:async()=>controller.abort()}),/Cancelled/);
 assert.equal((await fs.readdir(root)).filter(f=>f.startsWith('oscode-scenario-')).length,1);
});
