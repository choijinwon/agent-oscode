import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createServer} from 'node:http';
import {validateScenario} from '../src/ui-workflow.js';
import {checkUi} from '../src/ui-check.js';
import {runStateBrowser} from '../src/state-browser.js';
const route={path:'/api/items',method:'GET',responses:[{status:500,json:{error:'unavailable'},delayMs:700},{status:200,json:[]},{status:200,json:['Ready']}]};
test('network scenario accepts bounded JSON sequences and rejects unsafe or ambiguous routes',()=>{
 const steps=[{action:'visible',selector:'body'}];
 assert(validateScenario({steps,routes:[route]}));
 for(const bad of [{...route,path:'https://other.test/api'},{...route,path:'//other.test/api'},{...route,path:'/x/../api'},{...route,method:'DELETE'},{...route,responses:[{status:200,json:[],delayMs:3001}]},{...route,responses:[{status:200,json:'x'.repeat(16001)}]}])assert.throws(()=>validateScenario({steps,routes:[bad]}));
 assert.throws(()=>validateScenario({steps,routes:[route,route]}));
});
test('real browser reproduces loading, failure, empty and recovered results without calling API server',async t=>{
 const {chromium}=await import('playwright');try{await fs.access(chromium.executablePath());}catch{if(process.env.CI)throw Error('Chromium required');t.skip('Chromium unavailable');return;}
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-network-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 let apiRequests=0;
 const server=createServer((req,res)=>{
 if(req.url.startsWith('/api/')){apiRequests++;res.setHeader('content-type','application/json');res.end('["real"]');return;}
 res.setHeader('content-type','text/html');res.end(`<!doctype html><link rel="icon" href="data:,"><button id="load">Load</button><p id="status">Idle</p><script>
 document.querySelector('#load').onclick=async function(){this.disabled=true;document.querySelector('#status').textContent='Loading';try{const res=await fetch('/api/items');const data=await res.json();document.querySelector('#status').textContent=!res.ok?'Error':data.length?data[0]:'Empty';}finally{this.disabled=false;}};
 </script>`);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const url=`http://127.0.0.1:${server.address().port}`;
 const scenario={routes:[route],steps:[{action:'click',selector:'#load'},{action:'text',selector:'#status',value:'Loading'},{action:'disabled',selector:'#load'},{action:'text',selector:'#status',value:'Error'},{action:'enabled',selector:'#load'},{action:'click',selector:'#load'},{action:'text',selector:'#status',value:'Empty'},{action:'click',selector:'#load'},{action:'text',selector:'#status',value:'Ready'}]};
 const report=await checkUi({root,url,scenario});
 for(const result of report.results){assert.equal(result.scenario.passed,true,JSON.stringify(result));assert(result.simulation.complete);assert.deepEqual(result.simulation.events.map(e=>e.status),[500,200,200]);assert(result.requests.some(r=>r.status===500&&r.simulated));}
 assert.equal(apiRequests,0);
 const unused=await checkUi({root,url,viewport:'mobile',scenario:{routes:[route],steps:[{action:'visible',selector:'#load'}]}});
 assert(unused.incomplete);assert(!unused.results[0].simulation.complete);
 const text=await runStateBrowser({perform:async()=>JSON.stringify({...unused,report:unused.file})},`run ${url} example.json`);assert.match(text,/검증 미완료/);assert.match(text,/실제 서버 응답 검증 아님/);
});
