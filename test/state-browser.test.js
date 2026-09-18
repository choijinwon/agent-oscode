import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createServer} from 'node:http';
import {checkUi} from '../src/ui-check.js';
import {validateScenario} from '../src/ui-workflow.js';
import {parseStateRun,runStateBrowser} from '../src/state-browser.js';
import {WorkspaceTools} from '../src/tools.js';
test('state command requires an explicit URL/scenario and preserves execution policy',async()=>{
 assert.deepEqual(parseStateRun('run http://localhost:3000 test files/states.json'),{url:'http://localhost:3000/',scenario:'test files/states.json',viewport:'all'});
 assert.throws(()=>parseStateRun('run http://localhost:3000'));
 assert.throws(()=>parseStateRun('run file:///tmp/index.html test.json'));
 for(const opts of [{readOnly:true},{permissions:{shell:'deny'}}]) await assert.rejects(runStateBrowser(new WorkspaceTools(process.cwd(),opts),'run http://localhost:3000 test.json'),/Plan mode|Denied/);
 for(const value of [-1,5001,'0',1.2])assert.throws(()=>validateScenario({steps:[{action:'count',selector:'li',value}]}));
});
test('real UI transitions are asserted and failed steps keep screenshot/trace evidence',async t=>{
 const {chromium}=await import('playwright');
 try{await fs.access(chromium.executablePath());}catch{if(process.env.CI)throw Error('Chromium required');t.skip('Chromium unavailable');return;}
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-live-states-')));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const html=`<!doctype html><html><head><link rel="icon" href="data:,"></head><body>
 <input id="query"><button id="submit" onclick="this.disabled=true;document.querySelector('#loading').hidden=false">Search</button>
 <p id="loading" hidden>Loading</p><p id="empty" hidden>No results</p><p id="error" hidden>Error</p><ul></ul>
 <button id="finish" onclick="document.querySelector('#loading').hidden=true;document.querySelector('#empty').hidden=false;document.querySelector('#submit').disabled=false">Finish empty</button>
 <button id="fail" onclick="document.querySelector('#error').hidden=false">Fail</button></body></html>`;
 const server=createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(html);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url=`http://127.0.0.1:${server.address().port}`;
 const scenario={steps:[{action:'fill',selector:'#query',value:'none'},{action:'click',selector:'#submit'},{action:'visible',selector:'#loading'},{action:'disabled',selector:'#submit'},{action:'click',selector:'#finish'},{action:'hidden',selector:'#loading'},{action:'enabled',selector:'#submit'},{action:'text',selector:'#empty',value:'No results'},{action:'count',selector:'li',value:0},{action:'click',selector:'#fail'},{action:'visible',selector:'#error'}]};
 const report=await checkUi({root,url,scenario});
 assert.equal(report.results.length,3);
 for(const result of report.results){assert.equal(result.scenario.passed,true,JSON.stringify(result));assert.equal(result.scenario.assertions,7);assert((await fs.stat(result.trace)).size>0);}
 const failed=await checkUi({root,url,viewport:'mobile',scenario:{steps:[{action:'disabled',selector:'#submit'},{action:'click',selector:'#finish'}]}});
 assert.equal(failed.results[0].scenario.passed,false);assert.equal(failed.results[0].scenario.steps.length,1);assert(failed.findings>0);
 assert((await fs.stat(failed.results[0].screenshot)).size>0);assert((await fs.stat(failed.results[0].trace)).size>0);
 const text=await runStateBrowser({perform:async()=>JSON.stringify({report:'report.json',findings:0,results:report.results})},`run ${url} example.json`);
 assert.match(text,/指定|지정한 조건 통과/);
 const noAssertions=await runStateBrowser({perform:async()=>JSON.stringify({report:'report.json',findings:0,results:[{viewport:'mobile',scenario:{passed:true,assertions:0,steps:[]}}]})},`run ${url} example.json`);
 assert.match(noAssertions,/확인 조건 없음/);
});
