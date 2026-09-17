import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WorkspaceTools } from '../src/tools.js';
import { frontendSnapshot, renderFrontendContext, compareFrontendContext, summarizeDiagnostics } from '../src/frontend-context.js';

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oscode-context-')));
  t.after(() => fs.rm(root, {recursive:true, force:true}));
  for (const [name, content] of Object.entries({
    'App.tsx': "import Button from './Button'; import './App.css'; export default function App(){return <Button/>}",
    'Button.tsx': 'export default function Button(){return <button>Save</button>}',
    'App.css': ':root { --brand: blue; }',
    'Other.tsx': '// unrelated component\n'.repeat(300),
    'Card.vue': '<script setup>import Button from "./Button"</script><template><Button/></template>',
    'Card.svelte': '<script>import Button from "./Button"</script><Button/>',
    'card.component.ts': "@Component({templateUrl:'./card.html',styleUrls:['./App.css']}) export class Card {}",
    'card.html': '<button>OK</button>',
    '.env': 'DO_NOT_READ=secret'
  })) await fs.writeFile(path.join(root,name),content);
  return new WorkspaceTools(root, {readOnly:true});
}
test('focused context selects direct imports, styles and all four framework formats', async t => {
  const tools = await fixture(t);
  for (const file of ['App.tsx', 'Card.vue', 'Card.svelte']) {
    const snapshot = await frontendSnapshot(tools,file);
    assert(snapshot.selected.includes('Button.tsx'));
    assert(!renderFrontendContext(snapshot).includes('unrelated component'));
    assert(!JSON.stringify(snapshot).includes('DO_NOT_READ'));
  }
  const angular = await frontendSnapshot(tools,'card.component.ts');
  assert(angular.selected.includes('card.html'));
  assert(angular.selected.includes('App.css'));
  await assert.rejects(frontendSnapshot(tools,'../outside.ts'), /outside/);
  await fs.symlink('/etc/passwd',path.join(tools.root,'escape.ts'));
  await assert.rejects(frontendSnapshot(tools,'escape.ts'), /outside/);
});
test('offline A/B records estimates, shared snapshot and unverified quality without provider calls', async t => {
  const tools = await fixture(t);
  const report = await compareFrontendContext({tools,target:'App.tsx'});
  assert(report.arms.A.inputEstimate > report.arms.B.inputEstimate);
  assert.equal(report.quality,'not-evaluated');
  assert.equal(report.kind,'offline-input-estimate');
  assert.equal(JSON.parse(await fs.readFile(report.file)).fingerprint, report.fingerprint);
});
test('live comparison uses same prompt/model and bounded pair; never claims task success', async t => {
  const tools = await fixture(t), calls=[];
  const config={model:'test',provider:'compatible',maxInput:100000,maxOutput:500,budget:300000};
  const provider={complete: async request => {calls.push(request);return {content:'Review answer',usage:{input:100,output:10},truncated:false};}};
  const r=await compareFrontendContext({tools,target:'App.tsx',prompt:'Review',config,provider});
  assert.equal(calls.length,2);assert.equal(calls[0].model,calls[1].model);
  assert(calls.every(x=>x.messages[0].content.startsWith('Review\n')&&x.tools.length===0));
  assert.equal(r.arms.A.usage.input,100);assert.equal(r.quality,'not-evaluated');
  calls.length=0;
  await assert.rejects(compareFrontendContext({tools,target:'App.tsx',config:{...config,budget:10},provider}),/No API calls/);
  assert.equal(calls.length,0);
});
test('failed live request stops remaining arm and reports unknown usage',async t=>{
  const tools=await fixture(t);let calls=0;
  const r=await compareFrontendContext({tools,target:'App.tsx',config:{model:'test',provider:'compatible',maxInput:100000,maxOutput:500,budget:300000},provider:{complete:async()=>{calls++;throw Error('connection lost');}}});
  assert.equal(calls,1);assert.equal(r.arms[r.order[0]].status,'failed-usage-unknown');
});
test('diagnostic summary deduplicates errors and keeps truncation caveat',()=>{
  const s=summarizeDiagnostics('progress\n'.repeat(400)+'App.vue:12 error: bad prop\n'.repeat(20));
  assert(s.includes('App.vue:12 error: bad prop'));
  assert.equal(s.match(/bad prop/g).length,1);
  assert(s.includes('Omitted lines'));
});

test('frontend agent exposes focused tool only in focused mode and preserves source read guard', async t => {
  const { runTurn } = await import('../src/agent.js');
  const { newSession } = await import('../src/session.js');
  const { resolveConfig } = await import('../src/config.js');
  const tools = await fixture(t);
  for (const mode of ['focused', 'standard']) {
    const config=resolveConfig({}, {agent:'frontend','context-mode':mode,model:'test',plan:true});
    let calls=0;
    const provider={complete:async request=>{
      assert.equal(request.tools.some(t=>t.name==='frontend_context'),mode==='focused');
      calls++;
      if(calls===1 && mode==='focused') return {content:'',calls:[{id:'ctx',name:'frontend_context',input:{path:'App.tsx'}}],usage:{input:100,output:30}};
      return {content:'Plan: inspect and verify source before changing it.',calls:[],usage:{input:100,output:30}};
    }};
    const session=newSession(tools.root);
    const turn=await runTurn({session,prompt:'Review App.tsx',config,provider,tools,signal:new AbortController().signal});
    assert.equal(turn.status,'done');assert.equal(turn.contextMode,mode);
    if(mode==='focused') assert(turn.messages.find(m=>m.role==='tool').content.includes('Button.tsx'));
    assert.equal(tools.reads.size,0);
  }
});
