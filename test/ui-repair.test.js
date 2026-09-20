import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {UiRepair} from '../src/ui-repair.js';import {WorkspaceTools} from '../src/tools.js';
const result=(passed,key='same')=>({captureKey:key,environment:{browser:'test'},incomplete:false,results:[{viewport:'mobile',errors:[],console:[],scenario:{passed,assertions:passed?1:0,steps:[{action:'visible',selector:'<script>',passed}]}}]});
async function fixture(t,check){const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-ui-repair-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.writeFile(path.join(root,'scenario.json'),JSON.stringify({steps:[{action:'visible',selector:'#result'}]}));return {root,flow:new UiRepair(new WorkspaceTools(root,{approve:async()=>true}),check)};}
test('UI repair preserves original scenario, compares evidence and escapes HTML',async t=>{
 let calls=0;const {root,flow}=await fixture(t,async options=>{assert.equal(options.scenario.steps[0].selector,'#result');options.scenario.steps[0].selector='mutated';return result(++calls>1);});
 await flow.begin('http://localhost:3000','scenario.json');assert(flow.canFix);assert.match(flow.prompt(),/UNTRUSTED/);
 await fs.writeFile(path.join(root,'scenario.json'),'{}');await flow.finish(true);
 assert.equal(flow.status,'resolved');assert.equal(calls,2);const html=await fs.readFile(flow.html,'utf8');assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert(JSON.parse(await fs.readFile(flow.json)).after);
});
test('no repair on a passing baseline; stopped or incomparable runs cannot claim resolution',async t=>{
 const good=await fixture(t,async()=>result(true));await good.flow.begin('http://localhost','scenario.json');assert(!good.flow.canFix);assert.equal(good.flow.status,'already-passed');
 let calls=0;const a=await fixture(t,async()=>result(++calls>1,calls>1?'changed':'same'));await a.flow.begin('http://localhost','scenario.json');await a.flow.finish(true);assert.equal(a.flow.status,'not-comparable');
 const b=await fixture(t,async()=>result(false));await b.flow.begin('http://localhost','scenario.json');await b.flow.finish(false);assert.equal(b.flow.status,'repair-incomplete');assert(!b.flow.after);
});
test('browser denial prevents UI repair execution',async t=>{
 const {flow}=await fixture(t,async()=>{throw Error('Should not run');});flow.tools.approve=async()=>false;await assert.rejects(flow.begin('http://localhost','scenario.json'),/승인/);
});
