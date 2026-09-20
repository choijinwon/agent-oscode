import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {sessionDirectory} from './session.js';
export const defaultTheme={accent:'#0f766e',accentText:'#ffffff',surface:'#ffffff',background:'#f6f8fa',text:'#202b36',muted:'#626f7c',border:'#dce2e8',danger:'#b42318',radius:'12px',spacing:'16px',font:'Pretendard, -apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Noto Sans KR, Segoe UI, sans-serif'};
export const darkTheme={...defaultTheme,surface:'#18212c',background:'#101720',text:'#edf2f7',muted:'#a7b3c2',border:'#344253',accent:'#62d5b6',accentText:'#0d241c',danger:'#ffaaa2'};
export function validateTheme(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!Object.hasOwn(defaultTheme,k)))throw Error('지원하는 디자인 토큰 이름을 확인하세요.');
 for(const [key,v]of Object.entries(value)){
  if(typeof v!=='string'||v.length>120)throw Error(`잘못된 ${key}`);
  const valid=key==='font'?/^[a-zA-Z0-9 ,'"-]+$/.test(v)&&v.trim():['radius','spacing'].includes(key)?/^(?:0|\d+(?:\.\d+)?(?:px|rem|em))$/.test(v)&&parseFloat(v)<=100:/^(?:#[\da-fA-F]{3,4}|#[\da-fA-F]{6}|#[\da-fA-F]{8}|(?:rgb|hsl)a?\([\d\s.,%/+\-deg]+\)|oklch\([\d\s.%/+\-]+\)|transparent|currentColor|black|white)$/.test(v);
  if(!valid)throw Error(`${key}: 단순 색상·길이·글꼴 값만 지원합니다.`);
 }
 return value;
}
export async function readDesignFile(tools,name,fallback){
 const dir=path.join(tools.root,'.oscode');
 try{if((await fs.lstat(dir)).isSymbolicLink())throw Error('.oscode must not be a symlink.');}catch(e){if(e.code==='ENOENT')return fallback;throw e;}
 const file=path.join(dir,name);
 try{const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>512000)throw Error('디자인 설정 파일 크기 또는 링크 오류');return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}
}
// Serialize read-modify-write across agent tabs without locking nested file tools.
const designWrites=new Map();
export async function updateDesignFile(tools,name,fallback,update,signal){
 const key=await fs.realpath(tools.root),previous=designWrites.get(key)||Promise.resolve();
 const operation=previous.catch(()=>{}).then(async()=>{
  signal?.throwIfAborted();
  const next=update(await readDesignFile(tools,name,fallback));
  await saveDesignFile(tools,name,next,signal);return next;
 });
 designWrites.set(key,operation);
 try{return await operation;}finally{if(designWrites.get(key)===operation)designWrites.delete(key);}
}
export async function saveDesignFile(tools,name,data,signal){
 if(tools.readOnly||tools.permissions.write==='deny')throw Error('BUILD 모드와 쓰기 권한이 필요합니다.');
 signal?.throwIfAborted();await readDesignFile(tools,name,null);
 const body=JSON.stringify(data,null,2);if(Buffer.byteLength(body)>512000)throw Error('디자인 설정은 512 KB 이내여야 합니다.');
 tools.onPreview(body.slice(0,3000));if(!await tools.approve('write',`디자인 설정 저장: .oscode/${name}`,signal))throw Error('설정 저장 취소');
 signal?.throwIfAborted();const dir=await sessionDirectory(tools.root),temp=path.join(dir,`design-${randomUUID()}.tmp`);
 try{await fs.writeFile(temp,body,{mode:0o600,flag:'wx'});await fs.rename(temp,path.join(dir,name));}finally{await fs.rm(temp,{force:true});}
}
const aliases={accent:['--color-primary','--color-brand','--primary'],accentText:['--primary-foreground'],surface:['--color-surface','--card'],background:['--color-background','--background'],text:['--color-text','--foreground'],muted:['--color-muted','--muted-foreground'],border:['--color-border','--border'],danger:['--color-danger','--destructive'],radius:['--radius'],spacing:['--spacing'],font:['--font-sans']};
export async function projectTheme(tools,signal){
 const detected={},origins=[],files=(await tools.files('.',signal)).filter(f=>f.endsWith('.css')).slice(0,40);
 for(const file of files){signal?.throwIfAborted();let text;try{text=(await tools.text(await tools.resolve(file))).slice(0,32000);}catch{continue;}
  for(const block of text.matchAll(/(?::root|@theme)\s*\{([^{}]*)\}/g))for(const m of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)){
   const role=Object.keys(aliases).find(k=>aliases[k].includes(m[1]));if(!role||Object.hasOwn(detected,role))continue;
   let value=m[2].trim();if(/^[\d.]+\s+[\d.]+%\s+[\d.]+%$/.test(value))value=`hsl(${value})`;
   try{validateTheme({[role]:value});detected[role]=value;origins.push({role,variable:m[1],file});}catch{}
  }
 }
 const saved=await readDesignFile(tools,'design-theme.json',{});validateTheme(saved);
 return {tokens:{...defaultTheme,...detected,...saved},origins,overrides:Object.keys(saved),note:'첫 40개 CSS의 단순 :root/@theme 값 후보입니다. cascade·조건부 테마·var 참조를 해석하지 않습니다. 생성 CSS는 컴포넌트 범위에만 적용됩니다.'};
}
export function themeCss(tokens){validateTheme(tokens);return Object.entries({...defaultTheme,...tokens}).map(([key,value])=>`--oc-${key}:${value}`).join(';');}
export function exportTokens(tokens){
 validateTheme(tokens);const group={};
 for(const [key,value]of Object.entries(tokens)){
  if(['radius','spacing'].includes(key)){const m=/^(\d+(?:\.\d+)?)(px|rem)$/.exec(value);if(!m)throw Error('DTCG 길이 내보내기는 px/rem 값만 지원합니다.');group[key]={$type:'dimension',$value:{value:+m[1],unit:m[2]}};}
  else if(key==='font')group[key]={$type:'fontFamily',$value:value.split(',').map(x=>x.trim().replace(/^['"]|['"]$/g,''))};
  else{let h=value.replace(/^#/,'');if(!/^([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(h))throw Error('DTCG 색상 내보내기는 HEX 색상만 지원합니다.');if(h.length<5)h=[...h].map(x=>x+x).join('');group[key]={$type:'color',$value:{colorSpace:'srgb',components:[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255),alpha:h.length===8?parseInt(h.slice(6),16)/255:1}};}
 }
 return {oscode:group};
}
export function importTokens(data){
 if(!data||Object.keys(data).some(k=>k!=='oscode')||!data.oscode||typeof data.oscode!=='object'||Array.isArray(data.oscode))throw Error('oscode 그룹의 $type/$value 토큰 파일을 사용하세요.');
 const tokens={};for(const [key,token]of Object.entries(data.oscode)){
  if(!Object.hasOwn(defaultTheme,key)||!token||typeof token!=='object'||Object.keys(token).some(k=>!['$type','$value','$description'].includes(k)))throw Error('지원하지 않는 디자인 토큰');
  const value=token.$value,expected=['radius','spacing'].includes(key)?'dimension':key==='font'?'fontFamily':'color';if(token.$type!==expected)throw Error('디자인 토큰 타입 불일치');
  if(expected==='dimension'){if(!value||!Number.isFinite(value.value)||!['px','rem'].includes(value.unit))throw Error('px/rem dimension을 지정하세요.');tokens[key]=value.value+value.unit;}
  else if(expected==='fontFamily'){if(typeof value!=='string'&&(!Array.isArray(value)||value.some(x=>typeof x!=='string')))throw Error('fontFamily 오류');tokens[key]=Array.isArray(value)?value.join(', '):value;}
  else{if(!value||value.colorSpace!=='srgb'||!Array.isArray(value.components)||value.components.length!==3||value.components.some(v=>!Number.isFinite(v)||v<0||v>1)||value.alpha!==undefined&&(!Number.isFinite(value.alpha)||value.alpha<0||value.alpha>1))throw Error('0–1 srgb 색상만 지원합니다.');const bytes=[...value.components];if(value.alpha!==undefined&&value.alpha!==1)bytes.push(value.alpha);tokens[key]='#'+bytes.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');}
 }return validateTheme(tokens);
}
