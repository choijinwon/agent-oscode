import test from 'node:test';import assert from 'node:assert/strict';
import {settingsUI} from '../src/settings-ui.js';
function fixture(actions, answers=[]) {return {render(){},choose:async()=>actions.shift(),question:async()=>answers.shift(),questionHidden:async()=>answers.shift()};}
test('settings stages key and model and commits only after apply',async()=>{
 const config={provider:'compatible',baseUrl:'http://localhost:1234/v1',model:'old'};const writes=[];
 const ui=fixture(['key','model','new-model','apply'],['fake-test-key']);
 const applied=await settingsUI(ui,config,undefined,{readKey:()=>undefined,writeKey:(...args)=>writes.push(args),discover:async draft=>{assert.equal(config.model,'old');assert.equal(writes.length,0);assert.equal(draft.key,'fake-test-key');return {models:['new-model']};}});
 assert(applied);assert.equal(config.model,'new-model');assert.equal(writes.length,1);assert.equal(ui.settingsView,null);
});
test('cancel discards provider and pending key changes',async()=>{
 const config={provider:'anthropic',model:'old'};const original={...config};
 const ui=fixture(['provider','local','key','cancel'],['fake-test-key']);
 assert.equal(await settingsUI(ui,config,undefined,{readKey:()=>undefined,writeKey:()=>assert.fail('must not persist')}),false);
 assert.deepEqual(config,original);
});
test('catalog failure allows manual model input',async()=>{
 const config={provider:'compatible',model:'old'};const ui=fixture(['model','','apply'],['custom-model']);
 await settingsUI(ui,config,undefined,{readKey:()=>undefined,discover:async()=>{throw new Error('offline');}});
 assert.equal(config.model,'custom-model');
});
test('aborted settings clear panel without committing',async()=>{
 const controller=new AbortController();const config={provider:'compatible',model:'old'};
 const ui=fixture([]);ui.choose=async()=>{controller.abort();return 'apply';};
 await assert.rejects(settingsUI(ui,config,controller.signal,{readKey:()=>undefined}),/Cancelled/);assert.equal(config.model,'old');assert.equal(ui.settingsView,null);
});
test('browser login stages the OpenRouter key and applies it only on confirmation',async()=>{
 const config={provider:'anthropic',model:'old'};const writes=[];const ui=fixture(['login','model','test/model','apply']);
 await settingsUI(ui,config,undefined,{readKey:()=>undefined,writeKey:(...args)=>writes.push(args),login:async()=>{assert.equal(writes.length,0);return 'fake-oauth-key';},discover:async draft=>{assert.equal(draft.key,'fake-oauth-key');assert.equal(config.provider,'anthropic');return {models:['test/model']};}});
 assert.equal(config.provider,'compatible');assert.equal(config.baseUrl,'https://openrouter.ai/api/v1');assert.equal(config.model,'test/model');assert.equal(writes[0][2],'fake-oauth-key');
});
test('ChatGPT login discovers models and applies provider without storing a raw key',async()=>{
 const config={provider:'anthropic',model:'old'};const ui=fixture(['chatgpt','test-model','apply']);
 await settingsUI(ui,config,undefined,{readKey:()=>undefined,writeKey:()=>assert.fail('No key copy'),chatLogin:async()=>({connected:true}),chatModels:async()=>({models:['test-model']})});
 assert.equal(config.provider,'chatgpt');assert.equal(config.model,'test-model');assert.equal(config.baseUrl,undefined);
});
