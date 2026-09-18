import {openLoginBrowser} from './openrouter-login.js';
export function previewUrl(value) {
 let url;try {url=new URL(value);}catch{throw new Error('전체 개발 서버 주소를 입력하세요. 예: http://localhost:3000');}
 if(!['http:','https:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password)throw new Error('미리보기는 localhost, 127.0.0.1, [::1]의 HTTP(S) 주소를 사용하세요.');
 return url.href;
}
export async function openWebPreview(value,{open=openLoginBrowser}={}) {
 const url=previewUrl(value);await open(url);return url;
}

export class AutoWebPreview {
 constructor({open=openLoginBrowser,fetchImpl=fetch,onOpen=()=>{}}={}) {
  this.open=open;this.fetch=fetchImpl;this.onOpen=onOpen;this.opened=new Set();this.pending=new Set();this.controller=new AbortController();
 }
 async show(value) {
  if(!value||this.controller.signal.aborted)return false;
  let url;try{url=previewUrl(value);}catch{return false;}
  if(this.opened.has(url)||this.pending.has(url))return false;
  this.pending.add(url);
  try {
   const response=await this.fetch(url,{redirect:'manual',signal:AbortSignal.any([this.controller.signal,AbortSignal.timeout(1500)])});
   await response.body?.cancel();
   if(response.status<200||response.status>=400||this.controller.signal.aborted)return false;
   await this.open(url);this.opened.add(url);
   if(!this.controller.signal.aborted)this.onOpen(url);
   return true;
  }catch{return false;}finally{this.pending.delete(url);}
 }
 close(){this.controller.abort();}
}
