import {themeCss,defaultTheme} from './design-theme.js';
import {mobileCatalog,mobileMarkup,mobileStyles} from './design-mobile.js';
import {adminCatalog,adminMarkup,adminStyles} from './design-admin.js';
export const designCatalog=[
 {id:'button',name:'액션 버튼',group:'기본',description:'중요한 작업을 위한 버튼'},
 {id:'form',name:'입력 폼',group:'입력',description:'이메일 검증과 제출 이벤트'},
 {id:'checkbox',name:'체크박스',group:'입력',description:'선택 상태와 설명'},
 {id:'tabs',name:'탭',group:'탐색',description:'방향키·Home·End 이동'},
 {id:'dialog',name:'모달',group:'피드백',description:'네이티브 dialog·Esc·포커스 복귀'},
 {id:'tooltip',name:'툴팁',group:'피드백',description:'마우스와 키보드 도움말'},
 {id:'toast',name:'토스트',group:'피드백',description:'상태 안내와 닫기'},
 {id:'combobox',name:'검색형 선택',group:'입력',description:'네이티브 datalist 검색·입력'},
 {id:'table',name:'데이터 테이블',group:'데이터',description:'제목·열 구분과 가로 스크롤'},
 {id:'search-results',name:'검색 + 결과 목록',group:'화면 조합',description:'검색어·빈 결과·결과 개수'},
 {id:'settings-form',name:'설정 화면',group:'화면 조합',description:'계정·알림 설정 폼'},
 {id:'login-form',name:'로그인 화면',group:'화면 조합',description:'이메일·비밀번호·검증 상태'},
 ...mobileCatalog, ...adminCatalog
];
const field=(label,name,type='text')=>`<label for="__id__-${name}">${label}</label><input id="__id__-${name}" name="${name}" type="${type}" required autocomplete="${name==='email'?'email':type==='password'?'current-password':'off'}">`;
const submit='<button type="submit" data-action="submit">저장하기</button><p class="oc-feedback" role="status" data-feedback></p>';
const form=(body,title='프로젝트 정보')=>`<form><h2>${title}</h2>${body}${submit}</form>`;
export const designMarkup={
 ...mobileMarkup,
 ...adminMarkup,
 button:'<button type="button" data-action="primary">변경 사항 저장</button>',
 form:form(field('이름','name')+field('이메일','email','email')),
 checkbox:'<label class="oc-check"><input type="checkbox" name="updates"> 새로운 소식을 이메일로 받기</label><p class="oc-muted">언제든지 설정에서 변경할 수 있습니다.</p>',
 tabs:'<div role="tablist" aria-label="프로젝트 정보"><button type="button" role="tab" id="__id__-tab-0" aria-controls="__id__-panel-0" aria-selected="true" tabindex="0" data-tab="0">개요</button><button type="button" role="tab" id="__id__-tab-1" aria-controls="__id__-panel-1" aria-selected="false" tabindex="-1" data-tab="1">활동</button><button type="button" role="tab" id="__id__-tab-2" aria-controls="__id__-panel-2" aria-selected="false" tabindex="-1" data-tab="2">설정</button></div><div role="tabpanel" id="__id__-panel-0" aria-labelledby="__id__-tab-0" tabindex="0">프로젝트를 한눈에 확인하세요.</div><div role="tabpanel" id="__id__-panel-1" aria-labelledby="__id__-tab-1" tabindex="0" hidden>최근 활동이 없습니다.</div><div role="tabpanel" id="__id__-panel-2" aria-labelledby="__id__-tab-2" tabindex="0" hidden>프로젝트 설정을 관리합니다.</div>',
 dialog:'<button type="button" data-action="open-dialog">프로젝트 만들기</button><dialog aria-labelledby="__id__-dialog-title"><h2 id="__id__-dialog-title">새 프로젝트</h2><p>프로젝트를 만들 준비가 되었나요?</p><form method="dialog"><button type="submit" value="cancel" data-action="close-dialog">닫기</button></form></dialog>',
 tooltip:'<span class="oc-tooltip"><button type="button" aria-describedby="__id__-tip">공유 권한 안내</button><span id="__id__-tip" role="tooltip">초대한 사람만 프로젝트를 볼 수 있습니다.</span></span>',
 toast:'<div class="oc-toast" role="status"><span>변경 사항이 저장되었습니다.</span><button type="button" data-action="close-toast" aria-label="알림 닫기">×</button></div>',
 combobox:'<label for="__id__-city">지역 검색</label><input id="__id__-city" name="city" list="__id__-cities" placeholder="지역을 입력하세요"><datalist id="__id__-cities"><option value="서울"></option><option value="부산"></option><option value="제주"></option></datalist><p class="oc-muted">목록에 없는 값도 입력할 수 있습니다.</p>',
 table:'<div class="oc-table-scroll" tabindex="0" role="region" aria-label="프로젝트 표"><table><caption>프로젝트 현황</caption><thead><tr><th scope="col">프로젝트</th><th scope="col">담당자</th><th scope="col">상태</th></tr></thead><tbody><tr><th scope="row">디자인 시스템</th><td>지민</td><td><span class="oc-badge">진행 중</span></td></tr><tr><th scope="row">고객 포털</th><td>서연</td><td><span class="oc-badge">검토 중</span></td></tr></tbody></table></div>',
 'search-results':'<label for="__id__-query">프로젝트 검색</label><input id="__id__-query" data-search placeholder="프로젝트 이름을 입력하세요"><p role="status" data-count>3개 프로젝트</p><ul class="oc-results"><li data-result>디자인 시스템</li><li data-result>고객 포털</li><li data-result>모바일 화면</li></ul><p data-empty hidden>검색 결과가 없습니다.</p>',
 'settings-form':form(field('표시 이름','name')+'<label class="oc-check"><input type="checkbox" name="notifications" value="enabled"> 이메일 알림 받기</label>','계정 설정'),
 'login-form':form(field('이메일','email','email')+field('비밀번호','password','password'),'다시 만나 반가워요')
};
// Shared DOM behavior is deliberately small and delegates business actions to the host.
export function designAction(event,emit=()=>{}){
 const origin=event.target,root=event.currentTarget;if(!(origin instanceof Element)||!(root instanceof HTMLElement)||origin.closest('.oc-design')!==root)return;
 if(event.type==='focusin'&&origin instanceof HTMLInputElement&&root.hasAttribute('data-mobile')){requestAnimationFrame(()=>{if(origin.isConnected&&document.activeElement===origin)origin.scrollIntoView({block:'nearest',inline:'nearest'});});return;}
 const tooltip=origin.closest('.oc-tooltip');
 if(event instanceof KeyboardEvent&&event.key==='Escape'&&tooltip){tooltip.setAttribute('data-dismissed','');return;}
 if((event instanceof FocusEvent||event instanceof MouseEvent)&&['focusout','mouseout'].includes(event.type)){
  if(tooltip&&!(event.relatedTarget instanceof Node&&tooltip.contains(event.relatedTarget)))tooltip.removeAttribute('data-dismissed');return;
 }
 if(event.type==='submit'){
  if(!(origin instanceof HTMLFormElement)||origin.getAttribute('method')==='dialog')return;
  event.preventDefault();const feedback=root.querySelector('[data-feedback]');if(feedback)feedback.textContent='입력을 확인했습니다. 실제 저장은 앱에서 연결하세요.';
  emit({type:'submit',form:origin});return;
 }
 if(event.type==='input'){
  if(origin instanceof HTMLInputElement&&origin.hasAttribute('data-search')){
   let count=0;for(const item of root.querySelectorAll('[data-result]')){const show=(item.textContent||'').includes(origin.value);item.toggleAttribute('hidden',!show);if(show)count++;}
   const output=root.querySelector('[data-count]'),empty=root.querySelector('[data-empty]');if(output)output.textContent=count+'개 프로젝트';empty?.toggleAttribute('hidden',count!==0);
  }emit({type:'input',control:origin});return;
 }
 const tab=origin.closest('[role="tab"]');
 if(tab&&(event.type==='click'||event instanceof KeyboardEvent&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key))){
  const tabs=[...root.querySelectorAll('[role="tab"]')];let index=tabs.indexOf(tab);
  if(event instanceof KeyboardEvent){event.preventDefault();if(event.key==='Home')index=0;else if(event.key==='End')index=tabs.length-1;else index=(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;}
  tabs.forEach((item,i)=>{item.setAttribute('aria-selected',String(i===index));item.setAttribute('tabindex',i===index?'0':'-1');});
  [...root.querySelectorAll('[role="tabpanel"]')].forEach((item,i)=>item.toggleAttribute('hidden',i!==index));
  const active=tabs[index];if(active instanceof HTMLElement)active.focus();emit({type:'tab',index});return;
 }
 if(event.type!=='click')return;
 const button=origin.closest('[data-action]');if(!button)return;const action=button.getAttribute('data-action');
 if(action==='open-dialog'){const dialog=root.querySelector('dialog');if(dialog instanceof HTMLDialogElement)dialog.showModal();}
 if(action==='close-toast')button.closest('[role="status"]')?.setAttribute('hidden','');
 if(action==='primary')emit({type:'primary'});
 if(action==='sheet-option'&&button instanceof HTMLButtonElement){const output=root.querySelector('[data-sheet-result]');if(output)output.textContent=button.textContent+' 선택됨';emit({type:'sheet',value:button.value});}
 if(action==='mobile-card'){const output=root.querySelector('[data-mobile-result]');if(output)output.textContent=(button.querySelector('strong')?.textContent||'항목')+' 선택됨';emit({type:'select',value:button.getAttribute('data-value')});}
}
export const designStyles=`
.oc-design{box-sizing:border-box;color:var(--oc-text);font-family:var(--oc-font);font-size:15px;line-height:1.55;padding:var(--oc-spacing);background:var(--oc-surface);border:1px solid var(--oc-border);border-radius:var(--oc-radius);max-width:100%;min-width:0}
.oc-design *{box-sizing:border-box}.oc-design [hidden]{display:none!important}.oc-design h2{margin:0 0 18px;font-size:1.25em;line-height:1.3}.oc-design p{margin:10px 0}.oc-design form{display:grid;gap:10px}.oc-design label{font-weight:600}.oc-design button,.oc-design input{font:inherit}.oc-design input:not([type=checkbox]){width:100%;min-width:0;padding:10px 12px;border:1px solid var(--oc-border);background:var(--oc-background);color:var(--oc-text);border-radius:calc(var(--oc-radius)*.65)}
.oc-design button{cursor:pointer;border:1px solid transparent;border-radius:calc(var(--oc-radius)*.65);padding:10px 16px;background:var(--oc-accent);color:var(--oc-accentText);font-weight:600;min-height:42px}.oc-design button:hover{filter:brightness(.94)}.oc-design :focus-visible{outline:3px solid var(--oc-accent);outline-offset:3px}.oc-design button:disabled{opacity:.45;cursor:not-allowed}.oc-design[data-size=small] button{padding:6px 12px;min-height:34px}.oc-design[data-size=large] button{padding:14px 22px;min-height:48px}.oc-design[data-variant=outline] button{background:transparent;color:var(--oc-accent);border-color:var(--oc-accent)}.oc-design[data-variant=soft] button{background:color-mix(in srgb,var(--oc-accent) 12%,var(--oc-surface));color:var(--oc-accent)}
.oc-design .oc-muted{color:var(--oc-muted);font-size:.9em}.oc-design .oc-check{display:flex;align-items:center;gap:9px}.oc-design input[type=checkbox]{width:18px;height:18px;accent-color:var(--oc-accent)}.oc-design [role=tablist]{display:flex;gap:6px;border-bottom:1px solid var(--oc-border);padding-bottom:10px;flex-wrap:wrap}.oc-design [role=tab][aria-selected=false]{background:transparent;color:var(--oc-muted)}.oc-design [role=tabpanel]{padding:20px 0}.oc-design dialog{max-width:min(480px,90vw);border:1px solid var(--oc-border);border-radius:var(--oc-radius);padding:28px;background:var(--oc-surface);color:var(--oc-text)}.oc-design dialog::backdrop{background:#07151080}.oc-design .oc-toast{display:flex;align-items:center;justify-content:space-between;gap:16px}.oc-design .oc-tooltip{position:relative;display:inline-block}.oc-design [role=tooltip]{display:none;position:absolute;left:0;bottom:calc(100% + 8px);width:min(260px,70vw);background:var(--oc-text);color:var(--oc-surface);padding:10px;border-radius:8px;font-size:13px;z-index:2}.oc-design .oc-tooltip:not([data-dismissed]):hover [role=tooltip],.oc-design .oc-tooltip:not([data-dismissed]):focus-within [role=tooltip]{display:block}
.oc-design .oc-table-scroll{overflow:auto}.oc-design table{border-collapse:collapse;width:100%;text-align:left}.oc-design caption{text-align:left;font-weight:700;padding:0 0 14px}.oc-design th,.oc-design td{padding:12px;border-bottom:1px solid var(--oc-border);white-space:nowrap}.oc-design .oc-badge{padding:4px 8px;border-radius:99px;background:var(--oc-background);font-size:12px}.oc-design .oc-results{list-style:none;padding:0;margin:0}.oc-design .oc-results li{padding:14px 0;border-top:1px solid var(--oc-border)}.oc-design .oc-feedback{color:var(--oc-muted)}
`;
export function previewMarkup(id,uid='preview'){if(!Object.hasOwn(designMarkup,id))throw Error('알 수 없는 디자인');return designMarkup[id].replaceAll('__id__',uid);}
export function designCss(tokens=defaultTheme,scope="",mobile=false,admin=false){return `.oc-design${scope?`[data-design="${scope}"]`:""}{${themeCss(tokens)}}\n${designStyles}${mobile?mobileStyles:''}${admin?adminStyles:''}`;}
