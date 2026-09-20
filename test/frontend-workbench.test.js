import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {WorkspaceTools} from '../src/tools.js';
import {findReusable,locateElementSource} from '../src/frontend-reuse.js';
import {inspectElement,elementRepairPrompt} from '../src/ui-inspect.js';
import {diagnoseHydration,hydrationFindings} from '../src/ui-hydration.js';
import {runStress,validateStress} from '../src/ui-stress.js';
import {validateScenario} from '../src/ui-workflow.js';
import {checkUi} from '../src/ui-check.js';
import {exportBug,replayBug,validateReplay} from '../src/bug-bundle.js';
import {FrontendWorkbench} from '../src/frontend-workbench.js';
async function fixture(t){
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-workbench-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const tools=new WorkspaceTools(root,{approve:async()=>true});return {root,tools};
}
async function chromium(t){try{const c=(await import('playwright')).chromium;await fs.access(c.executablePath());return c;}catch(e){if(process.env.CI)throw e;t.skip('Chromium required');}}
async function server(t){
 let fixed=false;const s=http.createServer((req,res)=>{
  if(req.url.startsWith('/api/search')){res.writeHead(200,{'Content-Type':'application/json'}).end('{"label":"real"}');return;}
  const warning=req.url.includes('hydrate');res.writeHead(200,{'Content-Type':'text/html'}).end(`<!doctype html><html><head><link rel="icon" href="data:,"><style>#card{width:${fixed?'200':'800'}px;display:flex}#title{white-space:nowrap}body{background:white}@media(prefers-color-scheme:dark){body{background:black;color:white}}</style></head><body><div id="card"><span id="title" data-testid="title">Title</span></div><button id="go">Search</button><p id="result">ready</p><script>let latest=0;document.querySelector('#go').onclick=async()=>{const id=++latest;const r=await fetch('/api/search?request='+id).then(r=>r.json());if(${fixed}&&id!==latest)return;document.querySelector('#result').textContent=r.label;};${warning?'console.error("Hydration failed: server rendered HTML did not match the client");document.querySelector("#title").textContent="Client";':''}</script></body></html>`);
 });await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>{s.closeAllConnections();s.close();});return {url:`http://127.0.0.1:${s.address().port}`,fix:()=>fixed=true};
}
test('reuse finds all four frameworks and source candidates stay inside allowed files',async t=>{
 const {root,tools}=await fixture(t);
 const sources={'Button.tsx':'export default function Button(){return <button data-testid="save">Save</button>}','Button.vue':'<script setup>defineProps({disabled:Boolean})</script><template><button>Save</button></template>','Button.svelte':'<script>export let disabled=false</script><button>Save</button>','button.component.ts':'@Component({selector:"app-button"}) export class Button { @Input() disabled=false; }'};
 for(const [file,text]of Object.entries(sources))await fs.writeFile(path.join(root,file),text);
 await fs.writeFile(path.join(root,'.env'),'Button SUPER_SECRET');
 const r=await findReusable(tools,'button');assert.deepEqual(new Set(r.candidates.map(c=>c.framework)),new Set(['react','vue','svelte','angular']));assert(!JSON.stringify(r).includes('SUPER_SECRET'));
 const matches=await locateElementSource(tools,{testId:'save'});assert.equal(matches.candidates[0].file,'Button.tsx');
 assert((await tools.execute('frontend_reuse',{query:'button'})).is_error===false);
});
test('validation rejects unbounded fixtures and runtime tools honor PLAN and denial',async t=>{
 const {tools}=await fixture(t);
 for(const config of [{cases:[]},{cases:[{name:'x',probe:{width:50000}}]},{cases:[{name:'x',probe:{text:[{selector:'body',value:'x'.repeat(2001)}]}}]}])assert.throws(()=>validateStress(config));
 assert.throws(()=>validateScenario({steps:[{action:'clickMany',selector:'#x',value:100}]}));assert.throws(()=>validateScenario({steps:[{action:'wait',value:5000}]}));
 assert.throws(()=>validateReplay({version:1,url:'file:///etc/passwd',viewport:'mobile'}));
 for(const options of [{readOnly:true},{readOnly:false,permissions:{shell:'deny'}}]){
  Object.assign(tools,options);for(const name of ['ui_inspect','ui_hydration','ui_stress'])assert((await tools.execute(name,{url:'http://127.0.0.1',...(name==='ui_inspect'?{selector:'body'}:{})})).is_error);
 }
});
test('real element picker, matching CSS, source evidence and post-edit inspection',async t=>{
 const c=await chromium(t);if(!c)return;const {root,tools}=await fixture(t),app=await server(t);
 await fs.writeFile(path.join(root,'Card.tsx'),'<div id="card" className="card">Card</div>');
 const r=await inspectElement(tools,{url:app.url,viewport:'mobile'},undefined,{chromium:c,headless:true,onPage:p=>p.click('#card')});
 assert.equal(r.selector,'#card');assert.equal(r.element.computed.width,'800px');assert(r.hypotheses.length);assert(r.styles.rules.some(x=>x.selector==='#card'));assert.equal(r.source.candidates[0].file,'Card.tsx');
 const workbench=new FrontendWorkbench(tools);workbench.last={url:app.url,report:r};assert.match(await workbench.beginRepair('카드 너비 수정'),/Read exact source/);
 app.fix();const text=await workbench.finishRepair(true);assert.match(text,/재진단 완료/);assert.equal(workbench.last.report.element.computed.width,'200px');
 assert.throws(()=>elementRepairPrompt(r,''));await assert.rejects(inspectElement(tools,{url:app.url,selector:'div,span'},{aborted:false,throwIfAborted(){},addEventListener(){},removeEventListener(){}}),/하나/);
});
test('stress catches stale response overwrites and fixed app passes same sequence; replay bundle works',async t=>{
 const c=await chromium(t);if(!c)return;const {root,tools}=await fixture(t),app=await server(t);
 const scenario={routes:[{path:'/api/search',method:'GET',responses:[{status:200,json:{label:'old'},delayMs:700},{status:200,json:{label:'new'},delayMs:10}]}],steps:[{action:'clickMany',selector:'#go',value:2},{action:'wait',value:900},{action:'text',selector:'#result',value:'new'}]};
 await fs.writeFile(path.join(root,'stress.json'),JSON.stringify({cases:[{name:'race',viewport:'desktop',scenario}]}));
 const fail=await runStress(tools,app.url,'stress.json');assert.equal(fail.cases[0].status,'findings');
 const exported=await exportBug(tools,fail.cases[0].run);assert(exported.files.some(f=>f.endsWith('.png')));assert(exported.files.some(f=>f.endsWith('.zip')));
 const manifest=JSON.parse(await fs.readFile(path.join(exported.directory,'manifest.json')));for(const item of manifest.files)assert.equal(createHash('sha256').update(await fs.readFile(path.join(exported.directory,item.name))).digest('hex'),item.sha256);
 const target=path.join(root,'shared');await fs.cp(exported.directory,target,{recursive:true});
 const before=await replayBug(tools,app.url,'shared/replay.json');assert.equal(before.results[0].scenario.passed,false);
 app.fix();const after=await runStress(tools,app.url,'stress.json');assert.equal(after.cases[0].status,'passed');
 const replay=await replayBug(tools,app.url,'shared/replay.json');assert.equal(replay.results[0].scenario.passed,true);
 await fs.unlink(path.join(root,'.oscode',fail.cases[0].run,'desktop.png'));await fs.symlink(path.join(root,'stress.json'),path.join(root,'.oscode',fail.cases[0].run,'desktop.png'));await assert.rejects(exportBug(tools,fail.cases[0].run),/링크/);
 tools.permissions.write='deny';await assert.rejects(exportBug(tools,after.cases[0].run),/권한/);
});
test('long text stress flags overflow, exposes no assertion verdict, and hydration diagnoses framework signals',async t=>{
 const c=await chromium(t);if(!c)return;const {root,tools}=await fixture(t),app=await server(t);app.fix();
 const report=await checkUi({root,url:app.url,viewport:'mobile',probe:{width:320,colorScheme:'dark',text:[{selector:'#title',value:'LongTitle'.repeat(30)}],textScale:1.5}});
 assert(report.results[0].overflow.pixels>0);assert.deepEqual(report.results[0].probe.text,['#title']);
 const hydration=await diagnoseHydration(tools,{url:app.url+'/hydrate',selector:'#title'});assert.equal(hydration.status,'hydration-signal');assert(hydration.domChanged);assert.equal(hydration.client.text,'Client');
 const plain=await diagnoseHydration(tools,{url:app.url,selector:'#title'});assert.equal(plain.status,'no-hydration-signal');assert.equal(plain.domChanged,false);
 assert.equal(hydrationFindings(['NG0500: Hydration Node Mismatch','hydration_mismatch','Hydration node mismatch','Minified React error #418'].map(text=>({text}))).length,4);
});
test('picker cancellation closes the browser and PLAN exposes only read-only reuse',async t=>{
 const {root,tools}=await fixture(t);
 const {runTurn}=await import('../src/agent.js');const {newSession}=await import('../src/session.js');const {resolveConfig}=await import('../src/config.js');
 let seen=false;
 await runTurn({session:newSession(root),prompt:'Plan frontend work',config:resolveConfig({}, {agent:'frontend',plan:true},{}),tools,signal:new AbortController().signal,provider:{complete:async req=>{
  seen=true;assert(req.tools.some(x=>x.name==='frontend_reuse'));assert(!req.tools.some(x=>['ui_inspect','ui_stress','ui_hydration'].includes(x.name)));return {content:'Plan only',calls:[],usage:{input:1,output:1,requests:1}};
 }}});assert(seen);
 const c=await chromium(t);if(!c)return;const app=await server(t),controller=new AbortController();tools.readOnly=false;
 await assert.rejects(inspectElement(tools,{url:app.url},controller.signal,{chromium:c,headless:true,onPage:async()=>controller.abort()}),/종료|closed|abort/i);
});
