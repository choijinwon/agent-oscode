import test from 'node:test';
import assert from 'node:assert/strict';
import {listModels,chooseModel} from '../src/model-list.js';
test('model discovery filters IDs, deduplicates and indicates pagination',async()=>{
 const result=await listModels({provider:'compatible',baseUrl:'http://localhost:9999/v1'},async(url,options)=>{
  assert.equal(url,'http://localhost:9999/v1/models');assert.equal(options.redirect,'error');
  return Response.json({data:[{id:'vendor/model-b'},{id:'model-a'},{id:'model-a'},{id:'bad\nmodel'}],has_more:true});
 });assert.deepEqual(result,{models:['model-a','vendor/model-b'],partial:true});
});
test('discovery returns safe failures without server response contents',async()=>{
 await assert.rejects(listModels({provider:'compatible',baseUrl:'http://localhost:9999/v1'},async()=>new Response('secret server data',{status:401})),/HTTP 401/);
 await assert.rejects(listModels({provider:'compatible',baseUrl:'http://localhost:9999/v1'},async()=>new Response('not json')),/응답 형식/);
});
test('numbered selection supports current model, selection, and manual input',async()=>{
 const choices=['','2','3','custom-model'];
 const rl={question:async()=>choices.shift()};
 for(const expected of ['current','other','','custom-model'])assert.equal(await chooseModel(rl,['current','other'],'current',undefined,()=>{}),expected);
});
