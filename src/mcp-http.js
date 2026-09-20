import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {UnauthorizedError} from '@modelcontextprotocol/sdk/client/auth.js';
export function remoteUrl(value){
 const u=new URL(value);
 if(u.username||u.password||u.hash||u.search||(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))throw Error('MCP URL은 HTTPS를 사용하세요. 로컬 테스트만 HTTP를 허용합니다.');
 return u;
}
export async function guardedFetch(input,init={}){
 const u=new URL(input instanceof Request?input.url:input);
 // Discovery URLs may contain query parameters; credentials and insecure remote transport are forbidden.
 const check=new URL(u);check.search='';remoteUrl(check);
 return fetch(input,{...init,signal:AbortSignal.any([...(init.signal?[init.signal]:[]),AbortSignal.timeout(30000)]),redirect:'error'});
}
function openBrowser(url){
 const command=process.platform==='darwin'?'open':process.platform==='win32'?'rundll32':'xdg-open';
 const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];
 return new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:'ignore'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('브라우저 열기 실패')));});
}
export async function oauthSession({signal,open=openBrowser,clientId,timeout=180000}={}){
 signal?.throwIfAborted();
 const state=randomBytes(32).toString('hex');let info,token,verifier,redirectUrl,resolveCode,rejectCode,callbackActive=true;
 const code=new Promise((resolve,reject)=>{resolveCode=resolve;rejectCode=reject;});code.catch(()=>{});
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname!=='/callback'){res.writeHead(404).end();return;}
  if(u.searchParams.get('state')!==state){res.writeHead(400).end('Invalid state');return;}
  if(u.searchParams.has('error')||!u.searchParams.get('code')){res.writeHead(400).end('Authorization failed');rejectCode(Error('OAuth 인증 거절'));return;}
  res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}).end('OSCODE 인증 완료. 터미널로 돌아가세요.');resolveCode(u.searchParams.get('code'));
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 redirectUrl=`http://127.0.0.1:${server.address().port}/callback`;
 const abort=()=>rejectCode(Error('OAuth 취소'));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 const timer=setTimeout(()=>rejectCode(Error('OAuth 인증 시간 초과')),timeout);timer.unref();
 return {
  code,
  provider:{
   get redirectUrl(){return redirectUrl;},
   get clientMetadata(){return {redirect_uris:[redirectUrl],client_name:'OSCODE',grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'};},
   state:()=>state,clientInformation:()=>clientId?{client_id:clientId}:info,saveClientInformation:v=>{info=v;},
   tokens:()=>token,saveTokens:v=>{token=v;},saveCodeVerifier:v=>{verifier=v;},codeVerifier:()=>{if(!verifier)throw Error('Missing verifier');return verifier;},
   redirectToAuthorization:async u=>{if(!callbackActive)throw Error('OAuth 재연결이 필요합니다.');const check=new URL(u);check.search='';remoteUrl(check);await open(u.toString());},
   invalidateCredentials:scope=>{if(scope==='all'||scope==='tokens')token=undefined;if(scope==='all'||scope==='client')info=undefined;if(scope==='all'||scope==='verifier')verifier=undefined;}
  },
  stopCallback(){callbackActive=false;clearTimeout(timer);signal?.removeEventListener('abort',abort);server.close();server.closeAllConnections();},
  close(){this.stopCallback();info=token=verifier=undefined;rejectCode(Error('OAuth 연결 종료'));}
 };
}
export async function connectRemote(s,signal,options={}){
 let session,client,transport,connecting=true;
 const make=()=>{client=new Client({name:'oscode',version:'0.10.0'},{capabilities:{}});transport=new StreamableHTTPClientTransport(remoteUrl(s.url),{authProvider:session?.provider,fetch:(input,init={})=>guardedFetch(input,{...init,signal:AbortSignal.any([...(init.signal?[init.signal]:[]),...(connecting&&signal?[signal]:[])])}),...(s.tokenEnv?{requestInit:{headers:{Authorization:`Bearer ${process.env[s.tokenEnv]}`}}}:{})});};
 try{
  if(s.tokenEnv&&!process.env[s.tokenEnv])throw Error('MCP 토큰 환경변수가 없습니다.');
  if(s.oauth)session=await oauthSession({...options,signal,clientId:s.clientId});
  make();
  try{await client.connect(transport,{timeout:10000,signal});}
  catch(e){
   if(!(e instanceof UnauthorizedError)||!session)throw e;
   const code=await session.code;signal?.throwIfAborted();await transport.finishAuth(code);
   await client.close();make();await client.connect(transport,{timeout:10000,signal});
  }
  connecting=false;session?.stopCallback();return {client,transport,cleanup:()=>session?.close()};
 }catch(e){await client?.close().catch(()=>{});await transport?.close().catch(()=>{});session?.close();throw e;}
}
