import { endpoint } from './providers.js';
import { defaultBase, getCredential } from './credentials.js';

export async function listModels({provider, baseUrl, signal}, fetchImpl=fetch) {
  const base=baseUrl || defaultBase(provider);
  const url=endpoint(base,'models');
  const key=(provider==='anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OSCODE_API_KEY) || getCredential(provider,base);
  const headers=provider==='anthropic' ? {'anthropic-version':'2023-06-01',...(key ? {'x-api-key':key} : {})} : key ? {authorization:`Bearer ${key}`} : {};
  const response=await fetchImpl(url,{headers,redirect:'error',signal:AbortSignal.any([...(signal ? [signal] : []),AbortSignal.timeout(10000)])});
  if(!response.ok) { await response.body?.cancel();throw new Error(`모델 목록 HTTP ${response.status}. 직접 입력하거나 키·주소를 확인하세요.`); }
  const reader=response.body.getReader();const chunks=[];let size=0;
  try { while(true) { const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4000000)throw new Error('모델 목록이 너무 큽니다. 직접 입력하세요.');chunks.push(Buffer.from(value)); } }
  finally { await reader.cancel(); }
  let data;try {data=JSON.parse(Buffer.concat(chunks).toString());}catch {throw new Error('모델 목록 응답 형식이 올바르지 않습니다.');}
  if(!Array.isArray(data.data))throw new Error('모델 목록을 제공하지 않는 서버입니다. 직접 입력하세요.');
  const models=[...new Set(data.data.map(item=>item?.id).filter(id=>typeof id==='string' && id.length<=200 && /^[\w./:@+-]+$/.test(id)))].sort().slice(0,1000);
  return {models,partial:Boolean(data.has_more || data.data.length>1000)};
}

export async function chooseModel(rl, models, current, signal, print) {
  const choices=[...(current ? [{value:current,label:`${current} (현재 모델)`}] : []),...models.filter(id=>id!==current).map(id=>({value:id,label:id})),{value:'',label:'직접 입력'}];
  if(rl.choose)return rl.choose('모델 검색 · ↑↓ 선택 · Enter 확정',choices,{signal});
  choices.forEach((item,i)=>print(`${i+1}. ${item.label}`));
  const text=(await rl.question('모델 번호 또는 ID (Enter: 현재 모델): ',{signal})).trim();
  if(!text)return current;
  if(/^\d+$/.test(text)) { if(!choices[Number(text)-1])throw new Error('목록의 번호를 선택하세요.');return choices[Number(text)-1].value; }
  return text;
}
