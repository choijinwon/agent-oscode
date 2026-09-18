import test from 'node:test';import assert from 'node:assert/strict';import {PassThrough,Writable} from 'node:stream';
import {AgentTabs} from '../src/agent-tabs.js';import {chatPrompt} from '../src/terminal-view.js';
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(t,run) {
 const input=new PassThrough();input.isRaw=false;input.setRawMode=v=>{input.isRaw=v;};let written='';
 const output=new Writable({write(c,e,cb){written+=c;cb();}});output.columns=100;output.rows=24;
 const manager=new AgentTabs({input,output,run});t.after(()=>{manager.end();manager.close();});return {manager,input,output,text:()=>written,clear:()=>{written='';}};
}
test('plus starts independently running sessions and switching preserves drafts and hidden output',async t=>{
 const received=[];const {manager,input,text,clear}=fixture(t,async(args,host)=>{
  const ui=host.createUI({status:()=>({budget:100})},args);received.push(await ui.question(chatPrompt));
 });
 const first=manager.add(['--cwd','/project']);await tick();input.write('draft one');first.ui.emit('newAgent');await tick();
 const second=manager.selected;assert.notEqual(first.id,second.id);input.write('draft two');assert.equal(first.ui.buffer,'draft one');
 clear();first.ui.appendAnswer('background result');assert(!text().includes('background result'));
 second.ui.emit('nextAgent',-1);assert.equal(manager.selected,first);assert(text().includes('background result'));assert.equal(first.ui.buffer,'draft one');
 input.write('\r');await first.task;assert.equal(manager.selected,second);assert.equal(second.ui.buffer,'draft two');input.write('\r');await second.task;
 assert.deepEqual(received,['draft one','draft two']);assert.equal(input.isRaw,false);assert.equal(manager.tabs.length,0);
});
test('tab cap blocks fifth session and approvals stay pending in their owning tab',async t=>{
 const {manager}=fixture(t,async(args,host)=>{const ui=host.createUI({},args);await ui.question('승인 y/n').catch(()=>{});});
 for(let n=0;n<4;n++){manager.add([]);await tick();}
 assert.equal(manager.add([]),undefined);assert.equal(manager.tabs.length,4);assert.match(manager.selected.ui.hint,/최대 4/);
 assert(manager.tabs.every(tab=>tab.ui.pending && !tab.ui.pending.normal));
 manager.end();await Promise.all(manager.tabs.map(tab=>tab.task));
});
test('same-project mutations serialize while independent roots can run concurrently',async()=>{
 const manager=new AgentTabs();const events=[];let release;
 const first=manager.exclusive('/a',async()=>{events.push('first');await new Promise(r=>release=r);});await tick();
 const second=manager.exclusive('/a',async()=>events.push('second'));
 await manager.exclusive('/b',async()=>events.push('other'));assert.deepEqual(events,['first','other']);release();await Promise.all([first,second]);assert.deepEqual(events,['first','other','second']);
});

test('queued cancellation returns promptly without letting later writes bypass an active writer',async()=>{
 const manager=new AgentTabs();let release;const first=manager.exclusive('/a',()=>new Promise(r=>release=r));await tick();
 const controller=new AbortController();const second=manager.exclusive('/a',()=>assert.fail('cancelled task ran'),controller.signal);controller.abort();await assert.rejects(second,/Cancelled/);
 let ran=false;const third=manager.exclusive('/a',async()=>{ran=true;});await tick();assert.equal(ran,false);release();await Promise.all([first,third]);assert.equal(ran,true);
});
