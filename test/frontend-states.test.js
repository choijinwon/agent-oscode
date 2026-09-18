import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceTools} from '../src/tools.js';
import {inspectStates,statesText} from '../src/frontend-states.js';
import {planReadTools} from '../src/plans.js';
async function setup(t){
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-states-')));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 return {root,tools:new WorkspaceTools(root,{readOnly:true})};
}
test('state evidence supports four framework source forms without passing runtime checks',async t=>{
 const {root,tools}=await setup(t);
 for(const [file,source] of Object.entries({
  'React.tsx':'<Suspense fallback={<Spinner/>}>\n{error && <Alert/>}{items.length === 0 && <Empty/>}<button disabled={pending}/></Suspense>',
  'Vue.vue':'<template>\n<div v-if="loading"/><div v-if="error"/><div v-if="isEmpty"/><button :disabled="busy"/></template>',
  'Angular.html':'@if (loading) {}\n@if (error) {} @if (items.length === 0) {} <button [disabled]="saving"/>',
  'Svelte.svelte':'{#await request}<p>loading</p>{:catch error}<p>error</p>{/await}\n{#if empty}<p/>{/if}<button disabled={busy}/>'
 })){
  await fs.writeFile(path.join(root,file),source);
  const result=JSON.parse((await tools.execute('frontend_states',{path:file})).content);
  assert.equal(result.states.length,4);assert(result.states.every(s=>s.status==='candidate'));
  assert(result.states.every(s=>s.evidence.length<=3&&s.evidence[0].line>0));
  assert.match(statesText(result),/구현 완료가 아니며/);
 }
 assert(planReadTools.has('frontend_states'));
});
test('state scan is bounded, omits comments and leaves unknown states unverified',async t=>{
 const {root,tools}=await setup(t);
 await fs.writeFile(path.join(root,'Button.tsx'),'/* loading\n error */\n// disabled\n<!-- empty -->\n<div/>\n'+' '.repeat(32000)+'loading');
 const report=await inspectStates(tools,'Button.tsx');
 assert(report.truncated);assert.equal(report.scannedCharacters,32000);
 assert(report.states.every(s=>s.status==='unverified'));
 assert.match(statesText(report),/결함 판정이 아닙니다/);
 await fs.writeFile(path.join(root,'Button.tsx'),'/* loading\n error */\n<div aria-busy="true"/>');
 assert.equal((await inspectStates(tools,'Button.tsx')).states[0].evidence[0].line,3);
});
test('state scan rejects unsupported, excluded and escaped paths and supports cancellation',async t=>{
 const {root,tools}=await setup(t);
 await fs.writeFile(path.join(root,'.env'),'loading');
 await fs.writeFile(path.join(root,'data.json'),'{}');
 for(const file of ['../outside.tsx','.env','data.json']) assert.equal((await tools.execute('frontend_states',{path:file})).is_error,true);
 await assert.rejects(inspectStates(tools,''),/使用法|사용법/);
 await assert.rejects(inspectStates(tools,'any.tsx',AbortSignal.abort()),/Cancelled/);
});
