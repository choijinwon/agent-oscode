import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WorkspaceTools } from '../src/tools.js';
import { newSession, saveSession, loadSession } from '../src/session.js';
import { compact } from '../src/context.js';
import { analysisCheckpointContext, elideDuplicateRead } from '../src/analysis-memory.js';
import { runTurn } from '../src/agent.js';
import { resolveConfig } from '../src/config.js';

async function setup(t) {
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-notes-')));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.writeFile(path.join(root,'App.vue'),'const enabled = false;\n'+'// long source\n'.repeat(60));
 const tools=new WorkspaceTools(root,{readOnly:true});
 const session=newSession(root);tools.analysisSession=session;
 return {root,tools,session};
}
const note={path:'App.vue',quote:'const enabled = false;',summary:'Button may be disabled by initial state.',question:'Where is enabled updated?'};
test('checkpoint requires visible unchanged evidence, survives persistence and compaction, invalidates edited/deleted source',async t=>{
 const {root,tools,session}=await setup(t);
 assert((await tools.execute('analysis_checkpoint',note)).is_error);
 await tools.execute('read_file',{path:'App.vue'});
 assert(!(await tools.execute('analysis_checkpoint',note)).is_error);
 session.turns=[{messages:[{role:'user',content:'Analyze'}]},{messages:[{role:'user',content:'Continue'}]}];
 compact(session,1);await saveSession(session);
 const restored=await loadSession(root,session.id);
 assert((await analysisCheckpointContext(tools,restored)).includes(note.summary));
 await fs.writeFile(path.join(root,'App.vue'),'const enabled = true;');
 const stale=await analysisCheckpointContext(tools,restored);
 assert(stale.includes('STALE'));assert(!stale.includes(note.summary));assert(stale.includes(note.question));
 assert((await tools.execute('analysis_checkpoint',note)).is_error);
 await fs.unlink(path.join(root,'App.vue'));
 assert((await analysisCheckpointContext(tools,restored)).includes('STALE'));
});
test('checkpoint bounds notes and rejects fabricated quotes and denied paths',async t=>{
 const {tools,session}=await setup(t);
 await tools.execute('read_file',{path:'App.vue',start:2,lines:1});
 assert((await tools.execute('analysis_checkpoint',note)).is_error);
 await tools.execute('read_file',{path:'App.vue'});
 assert((await tools.execute('analysis_checkpoint',{...note,path:'../outside'})).is_error);
 assert((await tools.execute('analysis_checkpoint',{...note,summary:'x'.repeat(501)})).is_error);
 for(let i=0;i<7;i++) assert(!(await tools.execute('analysis_checkpoint',{...note,question:`Question ${i}`})).is_error);
 assert.equal(session.analysisCheckpoints.length,4);
});
test('duplicate reads elide only exact content still visible and archive the original',()=>{
 const call={id:'one',name:'read_file',input:{path:'App.vue'}};
 const content='source content\n'.repeat(60);
 const first={messages:[{role:'assistant',tool_calls:[call]},{role:'tool',tool_call_id:'one',content}]};
 const turn={messages:[]};const session={turns:[first,turn]};
 const result={content,is_error:false};
 assert(elideDuplicateRead(session,turn,{...call,id:'two'},result));
 assert(result.content.includes('tool call one'));assert.equal(turn.toolArchive[0].message.content,content);
 assert(!elideDuplicateRead(session,turn,call,{content:content+'changed'}));
 first.messages[1].content='[older tool payload omitted]';
 assert(!elideDuplicateRead(session,turn,call,{content}));
});
test('agent saves checkpoint in plan mode and rechecks source before next model call',async t=>{
 const {root,tools,session}=await setup(t);let step=0;
 const provider={complete:async req=>{
 step++;
 if(step===1)return {content:'',calls:[{id:'read',name:'read_file',input:{path:'App.vue'}}],usage:{input:10,output:10}};
 if(step===2)return {content:'',calls:[{id:'note',name:'analysis_checkpoint',input:note}],usage:{input:10,output:10}};
 assert(req.system.includes('source-unchanged'));
 return {content:'Plan ready.',calls:[],usage:{input:10,output:10}};
 }};
 const turn=await runTurn({session,prompt:'Analyze',config:resolveConfig({}, {model:'mock',plan:true}),tools,provider,signal:new AbortController().signal,save:saveSession});
 assert.equal(turn.status,'done');assert.equal(session.analysisCheckpoints.length,1);
 assert((await fs.readFile(path.join(root,'App.vue'),'utf8')).includes(note.quote));
});
