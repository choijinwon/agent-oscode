import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {repositoryMap} from '../src/repository-map.js';
import {WorkspaceTools} from '../src/tools.js';
import {estimateTokens} from '../src/context.js';
import {planReadTools} from '../src/plans.js';
async function setup(t){
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-map-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 for(const [file,text] of Object.entries({'App.tsx':"import {Button} from './Button'; export function App() {return null}",'Button.tsx':'export function Button() {return "DO_NOT_SEND_BODY"}', 'Card.vue':'<template>card</template>\n<script setup lang="ts">\nconst count = 1;\n</script>', 'Page.svelte':'<script>let title="hello";</script>','service.ts':'export class AngularService {}','.env':'SECRET=hidden'}))await fs.writeFile(path.join(root,file),text);
 return {root,tools:new WorkspaceTools(root,{readOnly:true,outputLimit:10000})};
}
test('map indexes four framework source shapes, excludes bodies and resolves imports',async t=>{
 const {tools}=await setup(t),result=await repositoryMap(tools);
 for(const name of ['Button','App','Card','Page','AngularService'])assert(result.includes(name));
 assert(result.includes('imports: Button.tsx'));assert(!result.includes('DO_NOT_SEND_BODY'));assert(!result.includes('SECRET'));assert(result.includes('3: binding count'));
 assert(planReadTools.has('repository_map'));assert.equal((await tools.execute('repository_map',{})).is_error,false);
});
test('map ranks relevant files, stays within budget and invalidates changed symbols',async t=>{
 const {root,tools}=await setup(t);const result=await repositoryMap(tools,'Button',400);
 assert(estimateTokens(result)<=400);assert(result.indexOf('\nButton.tsx')<result.indexOf('\nApp.tsx')||!result.includes('\nApp.tsx'));
 await repositoryMap(tools);assert((await repositoryMap(tools)).includes('cache 5'));
 await fs.writeFile(path.join(root,'Button.tsx'),'export function NewButton() {}');const next=await repositoryMap(tools);assert(next.includes('Function NewButton'));assert(!next.includes('Function Button\n'));
 assert(estimateTokens(await repositoryMap(tools,'',256))<=256);
});
test('map validates input and honors cancellation',async t=>{
 const {tools}=await setup(t);await assert.rejects(()=>repositoryMap(tools,'',1));await assert.rejects(()=>repositoryMap(tools,'x'.repeat(513)));
 const controller=new AbortController();controller.abort();await assert.rejects(()=>repositoryMap(tools,'',1600,controller.signal));
});
