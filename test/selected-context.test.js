import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SelectedContext, mentions, fileCompletions } from '../src/selected-context.js';
import { WorkspaceTools } from '../src/tools.js';
import { buildMessages } from '../src/context.js';
import { RepairFlow } from '../src/repair.js';

test('mentions support spaces and completion preserves prompt prefix', () => {
 assert.deepEqual(mentions('update @src/a.ts and @"src/my file.vue" user@example.com'), ['src/a.ts','src/my file.vue']);
 assert.deepEqual(fileCompletions('fix @src/m',['src/my file.vue']), ['fix @"src/my file.vue"']);
});
test('selected source refreshes, clips and rejects secret/outside/symlink paths', async t => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(),'oscode-context-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.writeFile(path.join(root,'a.ts'),'first');
 const selected = new SelectedContext(new WorkspaceTools(root));await selected.add('a.ts');
 await fs.writeFile(path.join(root,'a.ts'),'updated'.repeat(1000));
 const result = await selected.prepare('fix @a.ts');assert.equal(result.files.length,1);assert.match(result.prompt,/updated/);assert.match(result.prompt,/truncated/);assert(result.prompt.length<2400);
 await assert.rejects(selected.add('.env'));await assert.rejects(selected.add('../outside'));
 await fs.symlink('/etc/passwd',path.join(root,'escape'));await assert.rejects(selected.add('escape'));
});
test('history exclusion keeps current tool pairs and omits historical memory', () => {
 const current = [{role:'user',content:'new'},{role:'assistant',content:'',tool_calls:[{id:'1'}]},{role:'tool',tool_call_id:'1',content:'result'}];
 const session={contextHistory:false,omitted:1,memory:'old secret',turns:[{messages:[{role:'user',content:'old'}]},{messages:current}]};
 assert.deepEqual(buildMessages(session),current);
});
test('repair requires observed script failure and preserves verification choice', async () => {
 const seen=[];const config={plan:false,verify:{url:'http://localhost:3000',scripts:['lint']}};
 const flow=new RepairFlow({},config,async options=>{seen.push(options);return {steps:[{script:'lint',command:'npm run lint',status:'failed',output:'a.ts error'}],status:'failed'};});
 assert.throws(()=>flow.prompt(),/diagnose/);
 await flow.diagnose('lint');assert.match(flow.prompt(),/a.ts error/);assert.deepEqual(seen[0].config.verify,{scripts:['lint']});
 await assert.rejects(flow.diagnose('lint; echo hello'));
 config.plan=true;assert.throws(()=>flow.prompt(),/PLAN/);await assert.rejects(flow.diagnose('lint'),/PLAN/);
});
test('repair never treats blocked, timeout or cancelled runs as fixable failures', async () => {
 const flow=new RepairFlow({},{});
 for(const step of [{status:'blocked',script:'lint'},{status:'failed',script:'lint',reason:'Cancelled.'},{status:'failed',script:'lint',reason:'Timed out.'}]) {
  flow.last={report:{steps:[step]}};assert.throws(()=>flow.prompt(),/실패/);
 }
});
test('real diagnostic records failure then passes the same script after a fix', async t => {
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-repair-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.writeFile(path.join(root,'package.json'),JSON.stringify({packageManager:'npm@10.9.4',scripts:{check:'node check.cjs'}}));
 await fs.writeFile(path.join(root,'check.cjs'),"console.error('fixture error');process.exit(1)");
 const approvals=[];const tools=new WorkspaceTools(root,{approve:async(kind,command)=>{approvals.push({kind,command});return true;}});
 const flow=new RepairFlow(tools,{verify:{},permissions:{shell:'ask'}});
 assert.equal((await flow.diagnose('check')).status,'failed');assert.match(flow.prompt(),/fixture error/);
 await fs.writeFile(path.join(root,'check.cjs'),"console.log('fixture fixed')");
 assert.equal((await flow.diagnose(flow.last.script)).status,'passed');assert.equal(approvals.length,2);
 assert(approvals.every(a=>a.kind==='shell' && a.command.includes('npm run check')));assert.throws(()=>flow.prompt(),/실패/);
});
