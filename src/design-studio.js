import {designCatalog} from './design-catalog.js';
import {projectTheme,validateTheme,updateDesignFile,exportTokens,importTokens} from './design-theme.js';
import {designRecipe,validateSelection,applyDesign,designFrameworks} from './design-recipes.js';
import {readRegistry,registerDesign,importRegistry,exportRegistry,applyRegistry} from './design-registry.js';
import {openDesignGallery} from './design-gallery.js';
export const designHelp=`/design gallery [react|vue|angular|svelte] · 디자인·상태 미리보기
/design mobile [react|vue|angular|svelte] · 모바일 컴포넌트·화면 크기 미리보기
/design admin [react|vue|angular|svelte] · 관리자 디자인·테이블·사용자 화면
/design list · 기본·팀 컴포넌트 목록
/design select 프레임워크/디자인 · 브라우저 없이 선택
/design code · 선택한 코드 확인
/design apply 경로 · 코드·CSS 새 파일 생성
/design theme · 프로젝트 테마 후보 보기
/design theme set {"accent":"#0f766e","radius":"12px"}
/design theme import 파일.json · DTCG 부분 형식 읽기
/design theme export 파일.json · DTCG 부분 형식 내보내기
/design register 이름 {"framework":"react","path":"src/Button.jsx","css":"src/Button.css"}
/design registry import 파일.json · 팀 컴포넌트 등록
/design registry export 파일.json · 팀 공유 파일 생성
/design use 이름 · 팀 컴포넌트 선택`;
export async function designCatalogSummary(tools,signal){
 const theme=await projectTheme(tools,signal),registry=await readRegistry(tools);
 return {components:designCatalog,team:registry.items.map(({name,framework,description,usage,hash})=>({name,framework,description,usage,hash})),theme,frameworks:Object.keys(designFrameworks),next:'Use /design gallery to preview or design_recipe to inspect a native starter. Read existing local components first; do not create duplicates.'};
}
export class DesignStudio{
 constructor(tools){this.tools=tools;this.selection=null;this.team=null;}
 async command(raw,signal,options={}){
  const [,action='',rest='']=/^(\S+)(?:\s+([\s\S]*))?$/.exec(raw.trim())||[];if(!action)return designHelp;
  if(action==='list'){const r=await designCatalogSummary(this.tools,signal);return [...r.components.map(x=>`${x.id} · ${x.name} · ${x.group}`),...r.team.map(x=>`team:${x.name} · ${x.framework} · ${x.description}`)].join('\n');}
  if(action==='gallery'||action==='mobile'||action==='admin'){
   const framework=rest||'react';if(!Object.hasOwn(designFrameworks,framework))throw Error('react/vue/angular/svelte 중 선택하세요.');
   const theme=await projectTheme(this.tools,signal),registry=await readRegistry(this.tools);
   const selected=await openDesignGallery(this.tools,{theme:theme.tokens,framework,registry:registry.items,initial:action==='mobile'?'mobile-tabs':action==='admin'?'admin-dashboard':'button'},signal,options);
   if(selected.team){this.team=registry.items.find(x=>x.name===selected.team);this.selection=null;}
   else{this.selection=selected;this.team=null;}
   return `디자인 선택: ${selected.team||selected.item} · ${selected.framework}\n/design code 로 코드 확인\n/design apply 컴포넌트경로 로 새 파일 생성`;
  }
  if(action==='select'){
   const [framework,item,extra]=rest.split('/');if(extra!==undefined)throw Error('/design select react/form');
   this.selection=validateSelection({framework,item,tokens:(await projectTheme(this.tools,signal)).tokens});this.team=null;return `선택: ${framework}/${item} · /design code → /design apply 경로`;
  }
  if(action==='use'){const r=await readRegistry(this.tools);const item=r.items.find(x=>x.name===rest);if(!item)throw Error('등록된 팀 컴포넌트 이름을 확인하세요.');this.team=item;this.selection=null;return `선택: ${item.name}\n${item.usage}\n/design code → /design apply 경로`;}
  if(action==='code'){
   if(this.team)return `${this.team.code}\n\n/* CSS */\n${this.team.css}\n\n${this.team.usage}`;
   if(!this.selection)throw Error('먼저 디자인을 선택하세요.');const r=designRecipe(this.selection);return `${r.code}\n\n/* ${r.cssFile} */\n${r.css}\n\n${r.guidance}`;
  }
  if(action==='apply'){
   if(!rest)throw Error('/design apply src/컴포넌트경로');if(!this.team&&!this.selection)throw Error('먼저 디자인을 선택하세요.');
   const r=this.team?await applyRegistry(this.tools,this.team,rest,signal):await applyDesign(this.tools,this.selection,rest,signal);
   return `생성: ${r.created.join(', ')}\n${r.guidance}\n앱 import·데이터 연결·실제 프레임워크 렌더링 검증은 다음 단계입니다.`;
  }
  if(action==='theme'){
   const match=/^(set|import|export)\s+([\s\S]+)$/.exec(raw.trim().slice(5).trim());
   if(!match)return JSON.stringify(await projectTheme(this.tools,signal),null,2);
   if(match[1]==='export'){const theme=await projectTheme(this.tools,signal);await this.tools.perform('write_file',{path:match[2],content:JSON.stringify(exportTokens(theme.tokens),null,2)+'\n'},signal);return '디자인 토큰 내보내기: '+match[2];}
   const tokens=match[1]==='set'?validateTheme(JSON.parse(match[2])):importTokens(JSON.parse(await this.tools.text(await this.tools.resolve(match[2]))));
   await updateDesignFile(this.tools,'design-theme.json',{},saved=>validateTheme({...validateTheme(saved),...tokens}),signal);return '프로젝트 디자인 토큰을 저장했습니다. 갤러리나 select로 다시 선택하면 반영됩니다.';
  }
  if(action==='register'){
   const match=/^register\s+(\S+)\s+([\s\S]+)$/.exec(raw.trim());if(!match)throw Error('/design register 이름 JSON');const item=await registerDesign(this.tools,match[1],JSON.parse(match[2]),signal);return `팀 컴포넌트 등록: ${item.name} · /design use ${item.name}`;
  }
  if(action==='registry'){
   const match=/^(import|export)\s+([\s\S]+)$/.exec(raw.trim().slice(8).trim());if(!match)throw Error('/design registry import|export 파일.json');
   return match[1]==='import'?`가져온 컴포넌트: ${(await importRegistry(this.tools,match[2],signal)).join(', ')}`:`공유 파일 생성: ${await exportRegistry(this.tools,match[2],signal)}`;
  }
  throw Error(designHelp);
 }
}
