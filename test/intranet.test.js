import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';
import {createProvider,endpoint} from '../src/providers.js';import {resolveConfig} from '../src/config.js';
const request={model:'internal-model',system:'Test',messages:[{role:'user',content:'hello'}],tools:[],maxOutput:32};
const answer={choices:[{message:{content:'OK'},finish_reason:'stop'}],usage:{prompt_tokens:3,completion_tokens:1}};
test('intranet requires explicit compatible endpoint and does not loosen normal HTTP rules',()=>{
 assert.throws(()=>resolveConfig({}, {intranet:true},{}),/explicit/);
 assert.throws(()=>createProvider({provider:'chatgpt',intranet:true,baseUrl:'http://10.0.0.1/v1'}));
 assert.throws(()=>endpoint('http://10.0.0.1/v1','chat/completions'));
 assert.equal(endpoint('http://10.0.0.1/v1','chat/completions',true),'http://10.0.0.1/v1/chat/completions');
 for(const url of ['http://user:pass@internal/v1','http://internal/v1?key=secret','file:///v1'])assert.throws(()=>endpoint(url,'chat/completions',true));
 const cfg=resolveConfig({}, {intranet:true,'base-url':'http://llm.internal:8000/v1',model:'internal'},{});assert.equal(cfg.provider,'compatible');assert(cfg.intranet);
});
test('internal provider never inherits cloud credentials and supports dedicated auth/non-streaming',async t=>{
 const old=process.env.OSCODE_API_KEY,oldInternal=process.env.OSCODE_INTRANET_API_KEY;
 process.env.OSCODE_API_KEY='cloud-key';delete process.env.OSCODE_INTRANET_API_KEY;
 t.after(()=>{if(old===undefined)delete process.env.OSCODE_API_KEY;else process.env.OSCODE_API_KEY=old;if(oldInternal===undefined)delete process.env.OSCODE_INTRANET_API_KEY;else process.env.OSCODE_INTRANET_API_KEY=oldInternal;});
 let count=0;
 const fake=async(url,options)=>{assert.equal(url,'http://10.0.0.1/v1/chat/completions');assert.equal(options.headers.authorization,count++?'Bearer internal-key':undefined);assert.equal(options.redirect,'error');const body=JSON.parse(options.body);assert.equal(body.stream,false);assert(!body.stream_options);assert(!body.tools);return new Response(JSON.stringify(answer),{headers:{'content-type':'application/json'}});};
 const config={provider:'compatible',baseUrl:'http://10.0.0.1/v1',intranet:true};
 await createProvider(config,fake).complete(request,new AbortController().signal);
 process.env.OSCODE_INTRANET_API_KEY='internal-key';await createProvider(config,fake).complete(request,new AbortController().signal);assert.equal(count,2);
});
test('local compatible server returns tool calls; redirect is rejected without fallback',async t=>{
 let calls=0;const server=createServer((req,res)=>{calls++;if(req.url.startsWith('/redirect')){res.writeHead(302,{location:'/external'});res.end();return;}res.setHeader('content-type','application/json');res.end(JSON.stringify({...answer,choices:[{message:{content:'',tool_calls:[{id:'1',type:'function',function:{name:'list_files',arguments:'{}'}}]},finish_reason:'tool_calls'}]}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const provider=createProvider({provider:'compatible',intranet:true,baseUrl:base+'/v1'});
 const result=await provider.complete({...request,tools:[{name:'list_files',description:'List',parameters:{type:'object',properties:{}}}]},new AbortController().signal);
 assert.equal(result.calls[0].name,'list_files');
 await assert.rejects(createProvider({provider:'compatible',intranet:true,baseUrl:base+'/redirect'}).complete(request,new AbortController().signal));assert.equal(calls,2);
});
