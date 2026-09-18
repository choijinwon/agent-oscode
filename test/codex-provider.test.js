import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {createCodexProvider,loginChatGPT,chatgptModels,logoutChatGPT} from '../src/codex-provider.js';
import {runTurn} from '../src/agent.js';import {newSession} from '../src/session.js';import {resolveConfig} from '../src/config.js';
import {WorkspaceTools} from '../src/tools.js';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';

function fixture({loggedIn=true,reply={content:'완료',calls:[]},output=20}={}) {
 const client=new EventEmitter();client.cwd='/isolated';client.closed=false;client.requests=[];
 client.wait=async(method,predicate,signal)=>new Promise((resolve,reject)=>{
  const listener=message=>{if(message.method===method && predicate(message.params)){client.off('notification',listener);resolve(message.params);}};
  client.on('notification',listener);signal?.addEventListener('abort',()=>reject(new Error('Cancelled')),{once:true});
 });
 client.request=async(method,params)=>{
  client.requests.push({method,params});
  if(method==='account/read')return {account:loggedIn ? {type:'chatgpt',planType:'plus'} : null};
  if(method==='account/login/start') {
   queueMicrotask(()=>{loggedIn=true;client.emit('notification',{method:'account/login/completed',params:{success:true,loginId:'login'}});});
   return {loginId:'login',authUrl:'https://auth.openai.com/authorize?state=fixture'};
  }
  if(method==='account/logout'){loggedIn=false;return {};}
  if(method==='model/list')return {data:[{model:'test-model'}],nextCursor:null};
  if(method==='thread/start')return {thread:{id:'thread'}};
  if(method==='turn/start') {
   queueMicrotask(()=>{
    client.emit('notification',{method:'thread/tokenUsage/updated',params:{threadId:'thread',tokenUsage:{total:{inputTokens:50,outputTokens:output,cachedInputTokens:10}}}});
    client.emit('notification',{method:'item/completed',params:{threadId:'thread',item:{type:'agentMessage',text:JSON.stringify(reply)}}});
    client.emit('notification',{method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});
   });return {turn:{id:'turn'}};
  }
  return {};
 };
 client.close=async()=>{client.closed=true;};return client;
}
const request={model:'test-model',system:'instructions',messages:[{role:'user',content:'hello'}],tools:[{name:'read_file',parameters:{}}],maxOutput:100};
test('ChatGPT login opens official browser URL and never returns tokens',async()=>{
 const client=fixture({loggedIn:false});let opened;
 const result=await loginChatGPT({connect:async()=>client,openBrowser:async url=>{opened=url;}});
 assert.equal(result.connected,true);assert(!('token' in result));assert.match(opened,/^https:\/\/auth.openai.com\//);assert(client.closed);
});
test('model discovery and logout use official account protocol',async()=>{
 const client=fixture();assert.deepEqual(await chatgptModels({connect:async()=>client}),{models:['test-model'],partial:false});
 const other=fixture();await logoutChatGPT({connect:async()=>other});assert(other.requests.some(x=>x.method==='account/logout'));
});
test('model bridge confines native environment and returns host tool actions with usage',async()=>{
 const client=fixture({reply:{content:'읽겠습니다',calls:[{name:'read_file',arguments:'{"path":"a.txt"}'}]}});
 const response=await createCodexProvider({connect:async()=>client}).complete(request,new AbortController().signal);
 assert.equal(response.calls[0].input.path,'a.txt');assert.equal(response.usage.input,50);assert.equal(response.usage.cacheRead,10);assert(client.closed);
 const start=client.requests.find(x=>x.method==='thread/start').params;assert.equal(start.sandbox,'read-only');assert.equal(start.ephemeral,true);assert.deepEqual(start.environments,[]);
 const turn=client.requests.find(x=>x.method==='turn/start').params;assert.equal(turn.sandboxPolicy.access.includePlatformDefaults,false);assert.deepEqual(turn.sandboxPolicy.access.readableRoots,['/isolated']);assert(turn.outputSchema);
});
test('invalid/unknown actions fail closed; output over target is marked truncated',async()=>{
 const signal=new AbortController().signal;
 for(const reply of [{content:'',calls:[{name:'shell',arguments:'{}'}]},{content:'',calls:[{name:'read_file',arguments:'bad'}]}]) {
  const client=fixture({reply});await assert.rejects(createCodexProvider({connect:async()=>client}).complete(request,signal));assert(client.closed);
 }
 const response=await createCodexProvider({connect:async()=>fixture({output:101})}).complete(request,signal);assert(response.truncated);
});
test('signed-out model calls fail without starting a turn',async()=>{
 const client=fixture({loggedIn:false});await assert.rejects(createCodexProvider({connect:async()=>client}).complete(request,new AbortController().signal),/로그인/);assert(!client.requests.some(x=>x.method==='turn/start'));
});
test('ChatGPT action bridge keeps OSCODE file approval and PLAN enforcement',async t=>{
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-chatgpt-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 for(const plan of [false,true]) {
  let approvals=0,round=0;
  const tools=new WorkspaceTools(root,{readOnly:plan,approve:async()=>{approvals++;return false;}});
  const provider=createCodexProvider({connect:async()=>fixture({reply:round++===0 ? {content:'',calls:[{name:'write_file',arguments:JSON.stringify({path:'new.txt',content:'change'})}]} : {content:'변경하지 않았습니다.',calls:[]}})});
  const config=resolveConfig({provider:'chatgpt',model:'test-model',plan});const session=newSession(root);
  if(plan)await assert.rejects(runTurn({session,prompt:'create',config,provider,tools,signal:new AbortController().signal}),/허용되지 않은/);
  else await runTurn({session,prompt:'create',config,provider,tools,signal:new AbortController().signal});
  assert.equal(approvals,plan ? 0 : 1);await assert.rejects(fs.stat(path.join(root,'new.txt')));
 }
});
