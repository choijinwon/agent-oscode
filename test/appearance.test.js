import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {appearance,appearanceUI,readAppearance,saveAppearance} from '../src/appearance.js';
import {conversationRows} from '../src/chat-layout.js';
import {wrapText} from '../src/tui.js';
test('appearance persists independently and validates stored values',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'oscode-style-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 assert.equal((await readAppearance(root)).theme,'dark');await saveAppearance(root,{theme:'light',weight:'bold',format:'plain'});
 assert.deepEqual(await readAppearance(root),{theme:'light',weight:'bold',format:'plain'});
 await assert.rejects(()=>saveAppearance(root,{theme:'invalid'}));assert.equal((await readAppearance(root)).theme,'light');
});
test('style preview cancels cleanly and failed save restores original style',async()=>{
 for(const fails of [false,true]){
  const actions=['theme','contrast',fails?'apply':'cancel'];let sawPreview=false;
  const ui={appearance:appearance(),render(){if(this.appearance.theme==='contrast')sawPreview=true;},async choose(){return actions.shift();}};
  const run=()=>appearanceUI(ui,{save:async()=>{throw new Error('disk full');}});
  if(fails)await assert.rejects(run,/disk full/);else await run();
  assert(sawPreview);assert.equal(ui.appearance.theme,'dark');
 }
});
test('plain answers preserve markdown source while formatted answers render headings',()=>{
 const entries=[{type:'assistant',text:'# Title\n**bold**'}];
 assert(conversationRows(entries,60,wrapText,false,'plain').some(row=>row.text==='# Title'));
 assert(conversationRows(entries,60,wrapText).some(row=>row.text==='Title'&&row.kind==='heading'));
});
