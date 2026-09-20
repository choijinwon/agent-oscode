import {inspectElement,elementRepairPrompt} from './ui-inspect.js';
import {findReusable} from './frontend-reuse.js';
import {runStress} from './ui-stress.js';
import {diagnoseHydration} from './ui-hydration.js';
import {exportBug,replayBug} from './bug-bundle.js';
import {saveFrontendReport} from './frontend-browser.js';
import {uiSummary} from './ui-check.js';
export const workbenchHelp=`/inspect URL · 브라우저에서 요소 선택
/inspect URL CSS선택자 · 요소 직접 진단
/inspect fix 수정할 내용 · 마지막 요소 수정 후 재진단
/css URL CSS선택자 · 실제 스타일과 부모 레이아웃
/reuse 검색어 · 기존 컴포넌트 후보
/stress URL [설정.json] · 상황별 검사
/hydrate URL [CSS선택자] · SSR/새로고침 진단
/bug ui-실행ID · 로컬 공유 묶음
/replay URL 묶음폴더/replay.json · 공유 조건 재현`;
export function inspectionText(r){
 return [`선택: ${r.selector} · ${r.viewport}`,`크기: ${Math.round(r.element.rect.width)} × ${Math.round(r.element.rect.height)} · display: ${r.element.computed.display}`,
  `너비 ${r.element.computed.width} · 최소 ${r.element.computed['min-width']} · 최대 ${r.element.computed['max-width']}`,
  ...r.parents.slice(0,2).map(p=>`부모 ${p.tag}${p.id?'#'+p.id:''}: ${p.computed.display} · ${Math.round(p.rect.width)}px · overflow ${p.computed.overflow}`),
  ...r.hypotheses.map(h=>'관찰: '+h),
  r.source.candidates.length?'소스 후보 (연결 확정 아님):':'소스 후보를 찾지 못했습니다. 파일을 직접 지정해 요청하세요.',
  ...r.source.candidates.slice(0,5).map(c=>`  ${c.file}:${c.line} · ${c.matched.join(', ')}`),
  `전체 스타일·근거: ${r.file}`,'수정: /inspect fix 변경할 내용'].join('\n');
}
export class FrontendWorkbench{
 constructor(tools){this.tools=tools;this.last=null;this.pending=null;}
 async beginRepair(request){
  if(!this.last)throw Error('먼저 /inspect 또는 /css로 요소를 선택하세요.');
  if(this.tools.readOnly||this.tools.permissions.write==='deny')throw Error('BUILD 모드와 쓰기 권한이 필요합니다.');
  const before=structuredClone(this.last);this.pending=before;
  return elementRepairPrompt(before.report,request);
 }
 async finishRepair(completed,signal){
  const before=this.pending;this.pending=null;if(!before)throw Error('진행 중인 요소 수정이 없습니다.');
  const result={kind:'element-repair',before:before.report,status:'repair-incomplete',note:'동일 요소 재진단은 요청 충족이나 전체 기능 통과를 자동 판정하지 않습니다.'};
  if(completed){
   try{
    result.after=await inspectElement(this.tools,{url:before.url,selector:before.report.selector,viewport:before.report.viewport},signal);
    result.status=JSON.stringify(before.report.environment)===JSON.stringify(result.after.environment)?'reinspected':'not-comparable';
    this.last={url:before.url,report:result.after};
    result.styleChanges=Object.keys(before.report.element.computed).filter(k=>before.report.element.computed[k]!==result.after.element.computed[k]).map(property=>({property,before:before.report.element.computed[property],after:result.after.element.computed[property]}));
   }catch(error){result.status='reinspection-incomplete';result.error=error.message;}
  }
  const saved=await saveFrontendReport(this.tools,'element-repair',result);
  return `${saved.status==='reinspected'?'같은 선택자로 재진단 완료 · 요구사항 충족 여부는 결과 확인 필요':saved.status}\n변경된 계산 스타일: ${saved.styleChanges?.length||0}개\n전후 근거: ${saved.file}`;
 }
 async command(input,signal){
  const match=/^\/(inspect|css|reuse|stress|hydrate|bug|replay)(?:\s+([\s\S]*))?$/.exec(input.trim());if(!match)return null;
  const [,action,raw='']=match;if(!raw.trim())return workbenchHelp;
  const parts=/^(\S+)(?:\s+([\s\S]+))?$/.exec(raw.trim());const first=parts[1],rest=parts[2];
  if(action==='reuse'){
   const r=await findReusable(this.tools,raw,signal);
   return [`기존 컴포넌트 후보 · ${r.scanned}개 파일 조사${r.partial?' · 일부 범위':''}`,...r.candidates.map(c=>`${c.file} · ${c.framework}\n  exports: ${c.exports.join(', ')||'원본 확인'}${c.api.length?'\n  '+c.api.map(a=>`${a.line}: ${a.text}`).join('\n  '):''}`),r.candidates.length?'재사용 전 props·Provider·사용처를 확인하세요.':'검색 결과 없음 · 파일명이나 프로젝트에서 쓰는 표현으로 검색하세요.'].join('\n');
  }
  if(action==='inspect'||action==='css'){
   if(action==='css'&&!rest)throw Error('/css URL CSS선택자');
   const r=await inspectElement(this.tools,{url:first,selector:rest},signal);this.last={url:first,report:r};return inspectionText(r);
  }
  if(action==='stress'){
   const r=await runStress(this.tools,first,rest,signal);return r.cases.map(c=>`${c.name} · ${c.status} · 진단 ${c.findings}개\n  ${c.report}\n  공유: /bug ${c.run}`).join('\n')+`\n전체 보고서: ${r.file}\nobserved-only: 동작 확인 조건 없이 화면만 관찰`;
  }
  if(action==='hydrate'){
   const r=await diagnoseHydration(this.tools,{url:first,selector:rest||'body'},signal);
   return `SSR 진단: ${r.status}\nJS 전후 DOM 차이: ${r.domChanged?'있음 · 정상적인 클라이언트 렌더링일 수도 있습니다.':'없음'}\n하이드레이션 신호: ${r.hydrationSignals.length}개\n${r.hydrationSignals.map(x=>x.text).join('\n')}\n소스 조사 후보: ${r.sourceCandidates.length}개\n보고서: ${r.file}`;
  }
  if(action==='bug'){if(rest)throw Error('/bug ui-실행ID');const r=await exportBug(this.tools,first,signal);return `공유 묶음 저장: ${r.directory}\n${r.files.join(', ')}\n${r.note}`;}
  if(action==='replay'){if(!rest)throw Error('/replay URL 묶음폴더/replay.json');return uiSummary(await replayBug(this.tools,first,rest,signal));}
 }
}
