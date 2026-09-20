import {randomUUID} from 'node:crypto';
import {validateUiUrl} from './ui-check.js';
import {validateScenario} from './ui-workflow.js';

// Runs inside the isolated browser page, not inside the model runtime.
export function recorderPanel(){
 if(window.top!==window)return;
 const host=document.createElement('div');host.id='oscode-recorder';
 const shadow=host.attachShadow({mode:'open'});
 shadow.innerHTML=`<style>:host{all:initial;position:fixed;z-index:2147483647;right:16px;top:16px;font:14px system-ui;color:#eef5f4}section{width:300px;padding:18px;background:#172323;border:1px solid #72dabb;border-radius:14px;box-shadow:0 8px 32px #0006}h2{font-size:17px;margin:0 0 10px}p{line-height:1.5}button,select{font:inherit;padding:8px;margin:3px;border-radius:6px;border:1px solid #779;background:#263b3b;color:white}button:disabled{opacity:.4}output{display:block;margin:12px 0;font-size:13px}</style>
 <section><h2>OSCODE · 화면 테스트 녹화</h2><p>테스트 데이터만 입력하세요. 클릭·입력을 기록합니다. 비밀번호 입력은 지원하지 않습니다.</p>
 <label>선택할 검증 조건 <select aria-label="검증 조건"><option value="record">클릭·입력 녹화</option><option value="visible">요소가 보임</option><option value="text">현재 텍스트 포함</option><option value="disabled">버튼 비활성</option><option value="enabled">버튼 활성</option><option value="count">선택자 요소 수</option></select></label>
 <p>검증 조건을 고른 뒤 화면의 요소를 클릭하세요.</p><output>0/20 단계 · 확인 조건을 하나 이상 추가하세요.</output><button id="oscode-undo">마지막 단계 취소</button><button id="oscode-save" disabled>녹화 완료</button><button id="oscode-cancel">취소</button></section>`;
 document.documentElement.append(host);
 const mode=shadow.querySelector('select'),status=shadow.querySelector('output'),save=shadow.querySelector('#oscode-save');
 let queue=Promise.resolve(),stopped=false;
 function send(payload){queue=queue.then(async()=>{
  const result=await window.oscodeRecord(payload);
  status.textContent=result.message;save.disabled=!result.canSave;
  if(result.invalid){stopped=true;mode.disabled=true;}
 }).catch(()=>{status.textContent='녹화 연결이 종료되었습니다.';stopped=true;save.disabled=true;});return queue;}
 function selector(el){
  if(!(el instanceof Element)||el.getRootNode()!==document)throw Error('iframe·Shadow DOM은 지원하지 않습니다.');
  const unique=s=>document.querySelectorAll(s).length===1;
  const testid=el.getAttribute('data-testid');
  if(testid){const s='[data-testid='+CSS.escape(testid)+']';if(unique(s))return s;}
  if(el.id){const s='#'+CSS.escape(el.id);if(unique(s))return s;}
  const parts=[];
  for(let node=el;node&&node!==document.documentElement;node=node.parentElement){
   const siblings=[...node.parentElement.children].filter(n=>n.tagName===node.tagName);
   parts.unshift(node.tagName.toLowerCase()+':nth-of-type('+(siblings.indexOf(node)+1)+')');
   if(unique(parts.join(' > ')))return parts.join(' > ');
  }
  throw Error('요소 선택자를 만들 수 없습니다.');
 }
 const internal=event=>event.composedPath().includes(host);
 const sensitive=el=>el.matches('input[type=password],input[type=file],input[autocomplete*=password],input[autocomplete^="cc-"],input[autocomplete="one-time-code"]');
 function step(event,action,value){
  const el=event.target;
  try{
   if(sensitive(el)){send({type:'invalid',message:'민감 입력은 녹화할 수 없습니다. 취소 후 비밀 정보가 없는 시나리오를 사용하세요.'});return;}
   send({type:'step',step:{action,selector:selector(el),...(value!==undefined?{value}:{})}});
  }catch(error){status.textContent=error.message;}
 }
 let selectedTarget=null,selectedAt=0;
 document.addEventListener('pointerdown',event=>{
  if(internal(event)||stopped||mode.value==='record')return;
  event.preventDefault();event.stopImmediatePropagation();
  const action=mode.value,el=event.target;
  if(action==='text'&&!el.innerText?.trim()){status.textContent='텍스트가 있는 요소를 선택하세요.';return;}
  const value=action==='text'?el.innerText.trim().slice(0,2000):action==='count'?1:undefined;
  step(event,action,value);selectedTarget=el;selectedAt=Date.now();mode.value='record';
 },true);
 document.addEventListener('click',event=>{
  if(internal(event)||stopped)return;
  if(event.target===selectedTarget&&Date.now()-selectedAt<800){event.preventDefault();event.stopImmediatePropagation();selectedTarget=null;return;}
  if(event.target.closest('a[href],input[type=file]')){event.preventDefault();event.stopImmediatePropagation();send({type:'invalid',message:'페이지 이동·파일 업로드는 지원하지 않습니다. 녹화를 취소하세요.'});return;}
  step(event,'click');
 },true);
 document.addEventListener('input',event=>{
  if(internal(event)||stopped)return;
  if(event.target.matches('input[type=checkbox],input[type=radio]'))return;
  if(!event.target.matches('input:not([type=checkbox]):not([type=radio]),textarea')){send({type:'invalid',message:'이 입력 유형은 지원하지 않습니다. 녹화를 취소하세요.'});return;}
  step(event,'fill',event.target.value);
 },true);
 document.addEventListener('keydown',event=>{
  if(internal(event)||stopped||event.key!=='Enter')return;
  try{send({type:'step',step:{action:'press',selector:selector(event.target),key:'Enter'}});}catch{}
 },true);
 shadow.querySelector('#oscode-undo').onclick=()=>send({type:'undo'});
 shadow.querySelector('#oscode-cancel').onclick=()=>send({type:'cancel'});
 save.onclick=()=>{stopped=true;send({type:'finish'});};
}

export function recordingState(){
 const steps=[];let invalid='';
 return {
  get scenario(){return {steps:structuredClone(steps)};},
  accept(event){
   if(event?.type==='invalid')invalid=String(event.message||'지원하지 않는 동작').slice(0,200);
   if(!invalid&&event?.type==='step'){
    try{
     validateScenario({steps:[event.step]});
     const last=steps.at(-1);
     if(event.step.action==='fill'&&last?.action==='fill'&&last.selector===event.step.selector)steps[steps.length-1]=event.step;
     else if(steps.length<20)steps.push(event.step);
     else invalid='20단계를 초과했습니다. 녹화를 취소하고 짧게 나누세요.';
    }catch{invalid='지원하지 않는 단계입니다. 녹화를 취소하세요.';}
   }
   if(!invalid&&event?.type==='undo')steps.pop();
   const assertions=steps.filter(s=>['visible','text','disabled','enabled','count'].includes(s.action)).length;
   return {invalid:Boolean(invalid),canSave:!invalid&&assertions>0,message:invalid||`${steps.length}/20 단계 · 확인 조건 ${assertions}개`};
  }
 };
}

export async function captureScenario({url,signal,chromium:injected,onPage,timeoutMs=300000}){
 url=validateUiUrl(url);if(signal?.aborted)throw Error('Cancelled.');
 let chromium=injected;
 if(!chromium){try{({chromium}=await import('playwright'));}catch{throw Error('Playwright와 Chromium을 설치하세요.');}}
 const browser=await chromium.launch({headless:!injected?false:true,timeout:15000});
 let timer,abort;
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block',acceptDownloads:false});
  const page=await context.newPage(),state=recordingState();let resolveDone,rejectDone;
  const done=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});
  // A handler is attached immediately so cancellation during navigation cannot leak rejection.
  done.catch(()=>{});
  abort=()=>rejectDone(Error('Cancelled.'));signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>rejectDone(Error('녹화 시간이 5분을 초과했습니다.')),timeoutMs);
  page.on('close',()=>rejectDone(Error('녹화 창이 닫혔습니다.')));
  context.on('page',popup=>{if(popup!==page){state.accept({type:'invalid',message:'새 창 이동은 지원하지 않습니다.'});popup.close().catch(()=>{});}});
  page.on('dialog',dialog=>{state.accept({type:'invalid',message:'대화상자 동작은 지원하지 않습니다.'});dialog.dismiss().catch(()=>{});});
  await page.exposeBinding('oscodeRecord',({frame},event)=>{
   if(frame!==page.mainFrame())return {invalid:true,canSave:false,message:'하위 프레임은 지원하지 않습니다.'};
   const result=state.accept(event);
   if(event?.type==='cancel')rejectDone(Error('녹화를 취소했습니다.'));
   if(event?.type==='finish'&&result.canSave)resolveDone(state.scenario);
   return result;
  });
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:15000});
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())rejectDone(Error('페이지 이동은 지원하지 않습니다. 한 화면에서 녹화하세요.'));});
  await page.evaluate(recorderPanel);
  if(signal?.aborted)abort();
  if(onPage)await onPage(page);
  return await done;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);await browser.close();}
}

export async function recordUi(tools,url,signal,options={}){
 url=validateUiUrl(url);
 if(tools.readOnly)throw Error('PLAN 모드에서는 브라우저 녹화를 실행할 수 없습니다.');
 if(tools.permissions.shell==='deny'||tools.permissions.write==='deny')throw Error('프로젝트 실행·쓰기 권한이 필요합니다.');
 if(!await tools.approve('shell',`브라우저에서 클릭·입력을 녹화합니다: ${url}`,signal))throw Error('브라우저 실행이 승인되지 않았습니다.');
 const scenario=await captureScenario({url,signal,...options});
 validateScenario(scenario);
 if(signal?.aborted)throw Error('Cancelled.');
 const file=`oscode-scenario-${randomUUID()}.json`;
 await tools.perform('write_file',{path:file,content:JSON.stringify(scenario,null,2)+'\n'},signal);
 return `녹화 저장: ${file}\n${scenario.steps.length}개 단계 · 아직 재생 검증하지 않았습니다.\n실행: /states run ${url} ${file}`;
}
