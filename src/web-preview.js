import {openLoginBrowser} from './openrouter-login.js';
export function previewUrl(value) {
 let url;try {url=new URL(value);}catch{throw new Error('전체 개발 서버 주소를 입력하세요. 예: http://localhost:3000');}
 if(!['http:','https:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password)throw new Error('미리보기는 localhost, 127.0.0.1, [::1]의 HTTP(S) 주소를 사용하세요.');
 return url.href;
}
export async function openWebPreview(value,{open=openLoginBrowser}={}) {
 const url=previewUrl(value);await open(url);return url;
}
