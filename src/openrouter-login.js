import http from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

export function openLoginBrowser(url) {
 return new Promise((resolve,reject)=>{
  const command=process.platform==='darwin' ? 'open' : process.platform==='win32' ? 'rundll32' : 'xdg-open';
  const args=process.platform==='win32' ? ['url.dll,FileProtocolHandler',url] : [url];
  const child=spawn(command,args,{stdio:'ignore'});child.once('error',()=>reject(new Error('브라우저를 열지 못했습니다. 표시된 주소를 직접 여세요.')));child.once('exit',code=>code===0 ? resolve() : reject(new Error('브라우저를 열지 못했습니다. 표시된 주소를 직접 여세요.')));
 });
}
export async function loginOpenRouter({signal,onURL=()=>{},onNotice=()=>{},openBrowser=openLoginBrowser,fetchImpl=fetch,timeoutMs=180000}={}) {
 const verifier=randomBytes(32).toString('base64url');
 const challenge=createHash('sha256').update(verifier).digest('base64url');
 const callbackPath=`/callback/${randomBytes(24).toString('hex')}`;
 const controller=new AbortController();
 const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
 if(signal?.aborted)controller.abort();
 const timer=setTimeout(abort,timeoutMs);
 let server, rejectCode, accepted=false;
 const cancel=()=>rejectCode?.(new Error('로그인이 취소되었거나 시간이 만료되었습니다.'));
 const codePromise=new Promise((resolve,reject)=>{
  rejectCode=reject;
  server=http.createServer((req,res)=>{
   res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
   const url=new URL(req.url,'http://localhost');
   if(req.method!=='GET' || url.pathname!==callbackPath || accepted) {res.writeHead(404);res.end('Not found');return;}
   if(url.searchParams.has('error')) {accepted=true;res.end('로그인이 취소되었습니다. OSCODE로 돌아가세요.');reject(new Error('OpenRouter 로그인이 거절되었습니다.'));return;}
   const code=url.searchParams.get('code');
   if(!code || code.length>4096 || /[\s\x00-\x1f\x7f]/.test(code)){res.writeHead(400);res.end('Invalid authorization code');return;}
   accepted=true;res.end('승인 코드를 받았습니다. OSCODE에서 연결 결과를 확인하세요.');resolve(code);
  });
 });
 // Attach immediately so cancellation during server/browser startup cannot leak a rejection.
 codePromise.catch(()=>{});
 controller.signal.addEventListener('abort',cancel,{once:true});
 try {
  controller.signal.throwIfAborted();
  await new Promise((resolve,reject)=>{server.once('error',()=>reject(new Error('로그인 콜백 서버를 열지 못했습니다.')));server.listen(0,'127.0.0.1',resolve);});
  controller.signal.throwIfAborted();
  const callback=`http://localhost:${server.address().port}${callbackPath}`;
  const url=new URL('https://openrouter.ai/auth');url.search=new URLSearchParams({callback_url:callback,code_challenge:challenge,code_challenge_method:'S256',key_label:'OSCODE'}).toString();
  onURL(url.href);
  // Browser launch must not block cancellation or the callback.
  Promise.resolve().then(()=>openBrowser(url.href)).catch(()=>{if(!controller.signal.aborted)onNotice('브라우저에서 표시된 로그인 주소를 직접 여세요.');});
  const code=await codePromise;
  const response=await fetchImpl('https://openrouter.ai/api/v1/auth/keys',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,code_verifier:verifier,code_challenge_method:'S256'}),signal:controller.signal});
  if(!response.ok){await response.body?.cancel();throw new Error(`OpenRouter 인증 교환 실패 (HTTP ${response.status}). 다시 로그인하세요.`);}
  const reader=response.body.getReader();const chunks=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw new Error('인증 응답 크기가 올바르지 않습니다.');chunks.push(Buffer.from(value));}}
  finally {await reader.cancel();}
  let data;try {data=JSON.parse(Buffer.concat(chunks).toString());}catch {throw new Error('인증 응답 형식이 올바르지 않습니다.');}
  if(typeof data.key!=='string' || !data.key || data.key.length>8192 || /[\s\x00-\x1f\x7f]/.test(data.key))throw new Error('인증 키를 받지 못했습니다.');
  controller.signal.throwIfAborted();return data.key;
 } finally {
  clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',cancel);controller.abort();
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 }
}
