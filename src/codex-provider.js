import {randomUUID} from 'node:crypto';
import {startCodex} from './codex-client.js';
import {openLoginBrowser} from './openrouter-login.js';
import {estimateTokens} from './context.js';

export async function chatgptAccount({signal,connect=startCodex}={}) {
 const client=await connect({signal});try{const {account}=await client.request('account/read',{refreshToken:false},signal);return account?.type==='chatgpt' ? {connected:true,plan:account.planType} : {connected:false};}finally{await client.close();}
}
export async function loginChatGPT({signal,onURL=()=>{},onNotice=()=>{},connect=startCodex,openBrowser=openLoginBrowser}={}) {
 const client=await connect({signal});let loginId;
 try {
  const {account}=await client.request('account/read',{refreshToken:false},signal);
  if(account?.type==='chatgpt')return {connected:true,plan:account.planType};
  const completed=client.wait('account/login/completed',()=>true,signal,180000);completed.catch(()=>{});
  const result=await client.request('account/login/start',{type:'chatgpt'},signal);loginId=result.loginId;
  const url=new URL(result.authUrl);
  if(url.protocol!=='https:' || !['auth.openai.com','auth0.openai.com','chatgpt.com'].includes(url.hostname) || url.username || url.password)throw new Error('공식 로그인 주소가 아닙니다. Codex 런타임을 확인하세요.');
  onURL(url.href);Promise.resolve().then(()=>openBrowser(url.href)).catch(()=>{if(!client.closed)onNotice('표시된 주소를 브라우저에서 열어 로그인하세요.');});
  const status=await completed;if(!status.success)throw new Error('ChatGPT 로그인을 완료하지 못했습니다. 다시 시도하세요.');
  const resultAccount=await client.request('account/read',{refreshToken:false},signal);
  if(resultAccount.account?.type!=='chatgpt')throw new Error('ChatGPT 계정 연결을 확인하지 못했습니다.');
  return {connected:true,plan:resultAccount.account.planType};
 } catch(error){if(loginId)await client.request('account/login/cancel',{loginId},undefined,2000).catch(()=>{});throw error;}
 finally{await client.close();}
}
export async function logoutChatGPT({signal,connect=startCodex}={}) {const client=await connect({signal});try{await client.request('account/logout',{},signal);}finally{await client.close();}}
export async function chatgptModels({signal,connect=startCodex}={}) {
 const client=await connect({signal});try{
  const {account}=await client.request('account/read',{refreshToken:false},signal);if(account?.type!=='chatgpt')throw new Error('먼저 ChatGPT 계정으로 로그인하세요.');
  const response=await client.request('model/list',{limit:100,includeHidden:false},signal);
  return {models:[...new Set((response.data||[]).map(item=>item.model).filter(model=>typeof model==='string' && model.length<=200))],partial:Boolean(response.nextCursor)};
 }finally{await client.close();}
}
export function createCodexProvider({connect=startCodex}={}) {
 return {async complete(request,signal) {
  const client=await connect({signal});let threadId,turnId;let usage,final='';
  const receive=({method,params})=>{
   if(params?.threadId!==threadId)return;
   if(method==='turn/started')turnId=params.turn?.id;
   if(method==='thread/tokenUsage/updated')usage=params.tokenUsage?.total;
   if(method==='item/completed' && params.item?.type==='agentMessage')final=params.item.text;
  };
  client.on('notification',receive);
  try{
   const {account}=await client.request('account/read',{refreshToken:false},signal);
   if(account?.type!=='chatgpt')throw new Error('/settings에서 ChatGPT 계정으로 로그인하세요.');
   const result=await client.request('thread/start',{model:request.model,modelProvider:'openai',cwd:client.cwd,ephemeral:true,environments:[],permissions:'oscode-bridge',approvalPolicy:'never',baseInstructions:request.system+'\nYou are the model stage of OSCODE. Do not use native tools. Return a JSON object with content and calls. Each call names an OSCODE tool with arguments encoded as a JSON object string. The host executes those tools with approval and sends their results in the next request. Return calls:[] when the task is done. Do not claim that a proposed call has executed.',config:{web_search:'disabled'}},signal);
   threadId=result.thread.id;
   const completed=client.wait('turn/completed',params=>params.threadId===threadId,signal,180000);completed.catch(()=>{});
   const schema={type:'object',properties:{content:{type:'string'},calls:{type:'array',items:{type:'object',properties:{name:{type:'string',...(request.tools.length ? {enum:request.tools.map(t=>t.name)} : {})},arguments:{type:'string'}},required:['name','arguments'],additionalProperties:false}}},required:['content','calls'],additionalProperties:false};
   const started=await client.request('turn/start',{threadId,input:[{type:'text',text:JSON.stringify({conversation:request.messages,availableTools:request.tools,outputTokenTarget:request.maxOutput}),text_elements:[]}],environments:[],permissions:'oscode-bridge',approvalPolicy:'never',outputSchema:schema},signal);
   turnId=started.turn.id;
   const finished=await completed;
   if(finished.turn?.status!=='completed')throw new Error('ChatGPT 모델 실행이 완료되지 않았습니다. 계정 한도와 연결을 확인하세요.');
   let decoded;try{decoded=JSON.parse(final);}catch{throw new Error('ChatGPT 응답 형식 오류. 도구를 실행하지 않았습니다.');}
   if(typeof decoded.content!=='string' || !Array.isArray(decoded.calls) || decoded.calls.length>16)throw new Error('ChatGPT 응답 구조가 올바르지 않습니다.');
   const calls=decoded.calls.map(call=>{
    if(!request.tools.some(tool=>tool.name===call.name))throw new Error('허용되지 않은 도구 응답입니다.');
    let input;try{input=JSON.parse(call.arguments);}catch{throw new Error('도구 인수 형식 오류');}
    if(!input || typeof input!=='object' || Array.isArray(input))throw new Error('도구 인수는 객체여야 합니다.');
    return {id:randomUUID(),name:call.name,input};
   });
   return {content:decoded.content,calls,streamed:false,truncated:(usage?.outputTokens ?? estimateTokens(final))>request.maxOutput,usage:{input:usage?.inputTokens ?? estimateTokens(request),output:usage?.outputTokens ?? estimateTokens(final),cacheRead:usage?.cachedInputTokens||0,cacheWrite:usage?.cacheWriteInputTokens||0,requests:1,estimated:usage ? 0 : 1}};
  } finally{
   client.off('notification',receive);
   if(signal?.aborted && threadId && turnId)await client.request('turn/interrupt',{threadId,turnId},undefined,2000).catch(()=>{});
   await client.close();
  }
 }};
}
