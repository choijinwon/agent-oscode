import {galleryStyles} from './design-gallery-styles.js';
import {erpCsvCell,erpCleanView,erpReadView,erpDisplayColumns,erpRefreshViews,erpSnapshot,erpHistoryUi,erpErrorTargets,erpInit,erpRestore,erpProAction} from './design-erp-professional.js';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {openWebPreview} from './web-preview.js';
import {designCatalog,designMarkup,designStyles,designAction} from './design-catalog.js';
import {defaultTheme,darkTheme,themeCss} from './design-theme.js';
import {validateSelection} from './design-recipes.js';
import {designMotion,designMotionStyles} from './design-motion.js';
import {adminStyles} from './design-admin.js';
import {adminAction} from './design-admin-behavior.js';
import {patternAction} from './design-pattern-behavior.js';
import {patternStyles} from './design-patterns.js';
import {erpStyles} from './design-erp.js';
import {erpScale,erpParseAmount,erpFormatAmount,erpValidateJournal} from './design-erp-money.js';
import {erpAction,erpUpdateGrid,erpAppendRow,erpUpdateLedger} from './design-erp-behavior.js';
import {mobileStyles} from './design-mobile.js';
import {mobilePreviewHtml,mobilePreviewRuntime} from './design-mobile-preview.js';
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
export function galleryClient(data){
 const $=selector=>document.querySelector(selector),list=$('#catalog'),preview=$('#preview'),states=$('#states');
 let selected=data.initial||'button',search=data.initial?.startsWith('admin-')?'관리자':data.items.find(x=>x.id===data.initial)?.platform==='interaction-web'?'인터랙션':data.initial?.startsWith('erp-')?'erp':'',variant='solid',size='medium',motion='auto',framework=data.framework||'react',viewport=data.initial==='mobile-tabs'?'390':'fit',frame=null;const tokens={...data.theme};
 $('#search').value=search;
 $('#framework').value=framework;
 $('#viewport').value=viewport;
 const names={default:'기본',focus:'포커스',disabled:'비활성',loading:'로딩',error:'오류',dark:'다크'};
 function vars(values){return Object.entries(values).map(([k,v])=>'--oc-'+k+':'+v).join(';');}
 function renderList(){
  list.replaceChildren();for(const item of data.items.filter(x=>(x.id+' '+x.name+' '+x.description+' '+x.group+' '+(x.platform||'')).toLowerCase().includes(search))){
   const button=document.createElement('button');button.className='catalog-item';button.dataset.id=item.id;button.setAttribute('aria-pressed',String(item.id===selected));
   const title=document.createElement('strong'),caption=document.createElement('span');title.textContent=item.name;caption.textContent=item.description;caption.className='catalog-caption';const copy=document.createElement('span'),icon=document.createElement('span');copy.className='catalog-copy';icon.className='catalog-icon';icon.setAttribute('aria-hidden','true');icon.textContent=item.platform==='erp-web'?'▤':item.platform==='mobile-web'?'▯':item.platform==='admin-web'?'◫':'◇';copy.append(title,caption);button.append(icon,copy);button.onclick=()=>{selected=item.id;if(item.platform==='mobile-web'&&viewport==='fit'){viewport='390';$('#viewport').value=viewport;}render();};list.append(button);
  }
 }
 function makePreview(id,state,uid){
  const host=document.createElement('section');host.className='oc-design';host.dataset.variant=variant;host.dataset.size=size;host.dataset.motion=motion;host.setAttribute('style',vars(state==='dark'?{...data.dark,accent:tokens.accent,accentText:tokens.accentText}:tokens));
  if(data.items.find(x=>x.id===id)?.platform==='mobile-web')host.dataset.mobile='true';
  if(data.items.find(x=>x.id===id)?.platform==='admin-web')host.dataset.admin='true';
  if(data.items.find(x=>x.id===id)?.platform==='interaction-web')host.dataset.interaction='true';
  if(data.items.find(x=>x.id===id)?.platform==='erp-web')host.dataset.erp='true';
  host.innerHTML=data.markup[id].replaceAll('__id__',uid);erpInit(host);
  for(const type of ['click','keydown','submit','input','change','focusin','focusout','mouseout','toggle','paste'])host.addEventListener(type,event=>{const emit=()=>{$('#activity').textContent='미리보기 동작을 확인했습니다. 실제 저장·인증 요청은 보내지 않습니다.';};designAction(event,emit);adminAction(event,emit);patternAction(event,emit);erpProAction(event,emit);},type==='toggle');
  if(state==='disabled'||state==='loading'){host.inert=true;host.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);}
  if(state==='loading'){host.setAttribute('aria-busy','true');if(id!=='mobile-list'){const notice=document.createElement('p');notice.setAttribute('role','status');notice.textContent='처리 중…';host.append(notice);}}
  if(state==='error'){const notice=document.createElement('p');notice.style.color='var(--oc-danger)';notice.textContent='입력 내용을 확인해주세요.';host.append(notice);const input=host.querySelector('input');if(input)input.setAttribute('aria-invalid','true');}
  if(state==='focus'){host.classList.add('preview-focus');}
  return host;
 }
 function mobilePreview(item){
  const width=Number(viewport),height=$('#keyboard').checked?320:560,scroller=document.createElement('div'),device=document.createElement('div'),label=document.createElement('div');
  scroller.className='device-scroll';device.className='device';label.className='device-label';label.textContent=width+' × '+height+' CSS px';
  frame=document.createElement('iframe');frame.id='mobile-preview';frame.title='모바일 디자인 동작 미리보기';frame.setAttribute('sandbox','allow-scripts allow-forms allow-downloads');frame.style.width=width+'px';frame.style.height=height+'px';
  frame.srcdoc=mobilePreviewHtml(data.markup[selected],'.oc-design{'+vars(tokens)+'}'+data.styles,{variant,size,motion,mobile:item.platform==='mobile-web',admin:item.platform==='admin-web',interaction:item.platform==='interaction-web',erp:item.platform==='erp-web',safeArea:$('#safe-area').checked,parentOrigin:location.origin},data.nonce);
  device.append(label,frame);
  if($('#keyboard').checked){const keyboard=document.createElement('div');keyboard.className='keyboard-demo';keyboard.textContent='키보드 영역 · 시뮬레이션';device.append(keyboard);}
  scroller.append(device);return scroller;
 }
 addEventListener('message',event=>{
  if(!frame||event.source!==frame.contentWindow||!event.data||typeof event.data!=='object')return;
  const value=event.data;
  if(value.type==='oscode-mobile-dialog')frame.scrollIntoView({block:'start',inline:'nearest',behavior:'instant'});
  if(value.type==='oscode-mobile-action')$('#activity').textContent='모바일 미리보기 동작을 확인했습니다. 실제 저장·공유 요청은 보내지 않습니다.';
  if(value.type==='oscode-mobile-observation'&&['width','height','overflow','smallTargets'].every(k=>Number.isFinite(value[k])&&value[k]>=0)){
   $('#mobile-observation').textContent=value.width+' × '+value.height+' · 가로 넘침 '+value.overflow+'px · 44px 미만 터치 영역 '+value.smallTargets+'개 · '+(value.obscured===null?'포커스된 입력 없음':value.obscured?'입력 가림 관찰됨':'입력 가림 없음');
  }
 });
 function render(){
  renderList();const item=data.items.find(x=>x.id===selected);$('#item-title').textContent=item.name;$('#item-description').textContent=item.description;
  frame=null;preview.replaceChildren();states.replaceChildren();
  $('#motion').disabled=Boolean(item.team);
  $('#safe-area').disabled=$('#keyboard').disabled=viewport==='fit'||Boolean(item.team);
  $('#mobile-observation').hidden=viewport==='fit'||Boolean(item.team);$('#mobile-observation').textContent='모바일 크기 관찰 중…';
  if(item.team){const p=document.createElement('p');p.className='team-notice';p.textContent='팀 컴포넌트는 원본 코드를 실행하지 않습니다. '+item.framework+' 프로젝트에 적용한 뒤 앱에서 미리보기·검증하세요.';preview.append(p);$('#choose').disabled=item.framework!==framework;}
  else{preview.append(viewport==='fit'?makePreview(selected,'default','main'):mobilePreview(item));for(const state of Object.keys(names)){const card=document.createElement('article'),label=document.createElement('h3');label.textContent=names[state];card.append(label,makePreview(selected,state,'state-'+state));states.append(card);}$('#choose').disabled=false;}
  $('#choose').textContent='이 디자인 선택';
 }
 $('#search').oninput=e=>{search=e.target.value.toLowerCase();renderList();};
 $('#framework').onchange=e=>{framework=e.target.value;render();};
 $('#motion').onchange=e=>{motion=e.target.value;render();};
 $('#variant').onchange=e=>{variant=e.target.value;render();};$('#size').onchange=e=>{size=e.target.value;render();};
 $('#viewport').onchange=e=>{viewport=e.target.value;render();};$('#safe-area').onchange=render;$('#keyboard').onchange=render;
 function syncControls(){
  $('#accent').value=/^#[0-9a-f]{6}$/i.test(tokens.accent)?tokens.accent:'#0f766e';
  $('#radius-value').textContent=tokens.radius;
  $('#radius').value=/^\d+(?:\.\d+)?px$/.test(tokens.radius)?String(Math.min(28,parseFloat(tokens.radius))):'12';
 }
 syncControls();
 $('#accent').oninput=e=>{tokens.accent=e.target.value;render();};$('#radius').oninput=e=>{tokens.radius=e.target.value+'px';$('#radius-value').textContent=tokens.radius;render();};
 $('#theme-reset').onclick=()=>{Object.assign(tokens,data.theme);syncControls();render();};
 $('#choose').onclick=async()=>{
  $('#choose').disabled=true;const item=data.items.find(x=>x.id===selected);
  try{const response=await fetch(location.pathname+'/select',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item.team?{team:item.team,framework}:{item:selected,framework,variant,size,tokens,motion})});if(!response.ok)throw Error();$('#activity').textContent='선택했습니다. 터미널에서 /design apply 파일경로로 코드를 확인하고 적용하세요.';$('#choose').textContent='선택 완료';}
  catch{$('#activity').textContent='선택 연결이 종료되었습니다. 터미널에서 갤러리를 다시 열어주세요.';}
 };
 render();
}
export function galleryHtml({theme=defaultTheme,framework='react',registry=[],initial='button'},nonce){
 if(!Object.hasOwn(designMarkup,initial))throw Error('알 수 없는 디자인');
 const items=[...designCatalog,...registry.map(item=>({id:'team:'+item.name,team:item.name,name:item.name,description:item.description,group:'팀 라이브러리',framework:item.framework}))];
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>OSCODE · 디자인 라이브러리</title><style>${galleryStyles}\n.oc-design{${themeCss(theme)}}${designStyles}${designMotionStyles}${mobileStyles}${adminStyles}${patternStyles}${erpStyles}\n</style></head><body><div class="shell"><aside class="sidebar"><div class="brand"><i aria-hidden="true"></i>OSCODE <span style="color:#738177;font-size:12px;font-weight:500">/ Studio</span></div><p class="kicker">Design library</p><label for="search" class="kicker">컴포넌트 검색</label><input id="search" placeholder="폼, 탭, 검색…"><nav id="catalog" aria-label="디자인 컴포넌트"></nav><p class="library-note">React · Vue · Angular · Svelte</p></aside><main class="main"><header class="gallery-heading"><div><div class="eyebrow">COMPONENT STUDIO</div><h1 id="item-title"></h1><p id="item-description"></p></div><span class="pill">로컬 미리보기</span></header><div class="toolbar"><label class="control">프레임워크<select id="framework"><option value="react">React</option><option value="vue">Vue</option><option value="angular">Angular</option><option value="svelte">Svelte</option></select></label><label class="control">스타일<select id="variant"><option value="solid">Solid</option><option value="soft">Soft</option><option value="outline">Outline</option></select></label><label class="control">크기<select id="size"><option value="medium">기본</option><option value="small">작게</option><option value="large">크게</option></select></label><label class="control">인터랙션<select id="motion"><option value="auto">기본</option><option value="reduced">은은하게</option><option value="off">끄기</option></select></label><label class="control">포인트 컬러<input id="accent" type="color"></label><label class="control">모서리 <span id="radius-value">12px</span><input id="radius" type="range" min="0" max="28" value="12"></label><button id="theme-reset">프로젝트 테마로 복원</button></div><div class="preview-controls"><label>미리보기 화면<select id="viewport"><option value="fit">자동 너비</option><option value="360">모바일 360px</option><option value="390">모바일 390px</option><option value="430">모바일 430px</option></select></label><label><input type="checkbox" id="safe-area">하단 여백 34px</label><label><input type="checkbox" id="keyboard">키보드 영역 예시</label></div><div id="preview" class="stage"></div><p id="mobile-observation" role="status" hidden></p><p class="scope-note">모바일 선택은 CSS 화면 크기 미리보기입니다. 하단 여백·키보드는 시뮬레이션이며 실제 기기와 다를 수 있습니다. 관찰 수치는 전체 접근성 통과 판정이 아닙니다.</p><div class="section-heading"><h2>상태별로 확인하세요</h2><span>스타일 예시 · 실제 입력과 버튼도 조작할 수 있습니다</span></div><div id="states" class="states"></div><div class="footer"><p id="activity" role="status">마음에 드는 디자인을 선택하면 터미널에서 생성할 코드를 확인할 수 있습니다.</p><button id="choose">이 디자인 선택</button></div><p class="scope-note">공통 HTML·브라우저 동작 미리보기입니다. 선택한 프레임워크의 실제 렌더링은 생성 후 앱에서 검증하세요. 상태 예시는 코드에 자동 저장되지 않습니다.</p></main></div><script nonce="${nonce}">${designAction.toString()}\n${designMotion.toString()}\n${adminAction.toString()}\n${patternAction.toString()}\nconst erpStates=new WeakMap();\n${[erpScale,erpParseAmount,erpFormatAmount,erpValidateJournal,erpUpdateGrid,erpAppendRow,erpUpdateLedger,erpAction,erpCsvCell,erpCleanView,erpReadView,erpDisplayColumns,erpRefreshViews,erpSnapshot,erpHistoryUi,erpErrorTargets,erpInit,erpRestore,erpProAction].map(fn=>fn.toString()).join('\n')}\n${mobilePreviewRuntime.toString()}\n${mobilePreviewHtml.toString()}\n(${galleryClient.toString()})(${json({theme,dark:darkTheme,framework,items,initial,markup:designMarkup,styles:designStyles+designMotionStyles+mobileStyles+adminStyles+patternStyles+erpStyles,nonce})});</script></body></html>`;
}
export async function openDesignGallery(tools,{theme,framework='react',registry=[],initial='button'},signal,{open=openWebPreview,timeout=300000}={}){
 if(tools.readOnly||tools.permissions.shell==='deny')throw Error('BUILD 모드와 브라우저 실행 권한이 필요합니다.');
 signal?.throwIfAborted();if(!await tools.approve('shell','로컬 디자인 갤러리 열기 · 외부 리소스/프로젝트 코드 실행 없음',signal))throw Error('갤러리 실행 취소');
 const key=randomBytes(24).toString('hex'),nonce=randomBytes(18).toString('base64'),html=galleryHtml({theme,framework,registry,initial},nonce);
 let origin,resolve,reject;const selection=new Promise((a,b)=>{resolve=a;reject=b;});selection.catch(()=>{});
 const server=http.createServer(async(req,res)=>{
  if(req.headers.host!==new URL(origin).host){res.writeHead(403).end();return;}
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; frame-src 'self'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'`);
  if(req.method==='GET'&&req.url==='/'+key){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html);return;}
  if(req.method!=='POST'||req.url!==`/${key}/select`){res.writeHead(404).end();return;}
  if(req.headers.origin!==origin||!String(req.headers['content-type']).startsWith('application/json')){res.writeHead(403).end();return;}
  try{
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4000){res.writeHead(413).end();req.destroy();return;}}
   const value=JSON.parse(body);
   if(value.team){if(Object.keys(value).some(k=>!['team','framework'].includes(k))||!registry.some(x=>x.name===value.team&&x.framework===value.framework))throw Error();}
   else validateSelection(value);
   res.writeHead(200,{'Content-Type':'application/json'}).end('{"ok":true}',()=>resolve(value));
  }catch{if(!res.headersSent)res.writeHead(400).end();}
 });
 server.requestTimeout=5000;server.headersTimeout=5000;
 await new Promise((a,b)=>{server.once('error',b);server.listen(0,'127.0.0.1',a);});origin=`http://127.0.0.1:${server.address().port}`;
 const abort=()=>reject(Error('갤러리 취소'));signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(()=>reject(Error('갤러리 선택 시간이 5분을 초과했습니다.')),timeout);
 try{signal?.throwIfAborted();tools.onPreview(`디자인 갤러리: ${origin}/${key}`);await open(`${origin}/${key}`);return await selection;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);server.close();server.closeAllConnections();}
}
