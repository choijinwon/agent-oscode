import path from 'node:path';
import {createHash} from 'node:crypto';
import {readDesignFile,updateDesignFile} from './design-theme.js';
import {designFrameworks,assertDesignCompatibility} from './design-recipes.js';
const namePattern=/^[a-z][a-z0-9-]{0,39}$/;
const digest=value=>createHash('sha256').update(value).digest('hex');
const extensions={react:['.jsx','.tsx'],vue:['.vue'],angular:['.ts'],svelte:['.svelte']};
export function validateRegistry(data){
 if(!data||data.version!==1||Object.keys(data).some(k=>!['version','items'].includes(k))||!Array.isArray(data.items)||data.items.length>24)throw Error('registry version:1, items 최대 24개');
 const names=new Set();for(const item of data.items){
  if(!item||Object.keys(item).some(k=>!['name','framework','extension','cssReference','code','css','description','usage','hash'].includes(k))||!namePattern.test(item.name)||names.has(item.name)||!Object.hasOwn(designFrameworks,item.framework))throw Error('레지스트리 이름·프레임워크 오류');names.add(item.name);
  if(item.extension!==undefined&&!extensions[item.framework].includes(item.extension))throw Error('팀 컴포넌트 확장자 오류');
  if(item.cssReference!==undefined&&(typeof item.cssReference!=='string'||item.cssReference.length>240||!/^\.\.?\/[\w./ -]+\.css$/.test(item.cssReference)))throw Error('팀 CSS 참조 오류');
  for(const [key,limit]of [['code',64000],['css',16000],['description',400],['usage',1000]])if(typeof item[key]!=='string'||item[key].length>limit||item[key].includes('\0'))throw Error(`레지스트리 ${key} 오류`);
  if(!item.code.trim()||item.hash!==digest(item.code+'\n'+item.css))throw Error('컴포넌트 코드 해시가 일치하지 않습니다.');
 }return data;
}
export async function readRegistry(tools){return validateRegistry(await readDesignFile(tools,'design-registry.json',{version:1,items:[]}));}
export async function registerDesign(tools,name,options,signal){
 if(!namePattern.test(name)||!options||Object.keys(options).some(k=>!['framework','path','css','description','usage'].includes(k))||!Object.hasOwn(designFrameworks,options.framework)||typeof options.path!=='string')throw Error('name과 framework/path JSON을 지정하세요.');
 const code=await tools.text(await tools.resolve(options.path)),css=options.css?await tools.text(await tools.resolve(options.css)):'';
 let cssReference=options.css?path.relative(path.dirname(options.path),options.css).split(path.sep).join('/'):undefined;
 if(cssReference&&!cssReference.startsWith('.'))cssReference='./'+cssReference;
 const item={name,framework:options.framework,extension:path.extname(options.path),...(cssReference?{cssReference}:{}),code,css,description:options.description||name,usage:options.usage||'원본 컴포넌트의 props·의존성과 이벤트를 확인하고 연결하세요.',hash:digest(code+'\n'+css)};
 await updateDesignFile(tools,'design-registry.json',{version:1,items:[]},data=>validateRegistry({version:1,items:[...validateRegistry(data).items,item]}),signal);return item;
}
export async function importRegistry(tools,file,signal){
 const incoming=validateRegistry(JSON.parse(await tools.text(await tools.resolve(file))));
 await updateDesignFile(tools,'design-registry.json',{version:1,items:[]},data=>validateRegistry({version:1,items:[...validateRegistry(data).items,...incoming.items]}),signal);return incoming.items.map(x=>x.name);
}
export async function exportRegistry(tools,file,signal){
 const data=await readRegistry(tools);await tools.perform('write_file',{path:file,content:JSON.stringify(data,null,2)+'\n'},signal);return file;
}
export async function applyRegistry(tools,item,file,signal){
 validateRegistry({version:1,items:[item]});if(tools.readOnly||tools.permissions.write==='deny')throw Error('BUILD 모드와 쓰기 권한이 필요합니다.');
 await assertDesignCompatibility(tools,item.framework,false);const extension=item.extension||designFrameworks[item.framework].extension;
 if(path.extname(file)!==extension)throw Error(`출력 확장자는 ${extension}입니다.`);
 const cssFile=file.slice(0,-extension.length)+'.css',cssName=path.basename(cssFile);
 if(item.css&&!/^[A-Za-z0-9_.-]+\.css$/.test(cssName))throw Error('CSS 파일 이름은 영문·숫자·하이픈·밑줄을 사용하세요.');
 const code=item.css&&item.cssReference?rewriteStyleImport(item.code,item.cssReference,'./'+cssName):item.code;
 const files=[[file,code]];if(item.css)files.push([cssFile,item.css]);
 for(const [name]of files){const resolved=await tools.resolve(name,true);try{await tools.text(resolved);throw Error('기존 파일이 있습니다: '+name);}catch(e){if(e.code!=='ENOENT')throw e;}}
 const created=[];try{for(const [name,content]of files){await tools.perform('write_file',{path:name,content},signal);created.push(name);}}catch(e){throw Error(`${e.message} · 생성 완료: ${created.join(', ')||'없음'}`);}
 return {created,guidance:item.usage+' 등록한 CSS의 정적 import/styleUrls/style src는 새 이름으로 연결합니다. 그 외 의존성·자산 경로는 앱에서 확인하세요.'};
}
function rewriteStyleImport(code,from,to){
 const literal=(text)=>text.replace(/(['"])([^'"\r\n]+)\1/g,(all,q,value)=>value===from?q+to+q:all);
 return code.replace(/\bimport\s*(?:[^;\n]*?\sfrom\s*)?(['"])[^'"\r\n]+\1/g,literal)
  .replace(/\bstyleUrls\s*:\s*\[[^\]]*\]/g,literal)
  .replace(/<style\b[^>]*\bsrc\s*=\s*(['"])[^'"\r\n]+\1/g,literal);
}
