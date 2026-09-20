import {erpAction,erpUpdateGrid,erpUpdateLedger} from './design-erp-behavior.js';

// Serialized with ERP starters. Journal snapshots are memory-only and instance-local.
export const erpStates=new WeakMap();
export function erpCsvCell(value='') {
 const safe=/^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/.test(value)?"'"+value:value;
 return '"'+safe.replaceAll('"','""')+'"';
}
export function erpCleanView(text='{}') {
 try{const v=JSON.parse(text);
  if(!v||typeof v.query!=='string'||v.query.length>100||!['all','1000','2000'].includes(v.company)||!['all','KRW','USD','EUR','JPY'].includes(v.currency)||!['all','posted','draft','held'].includes(v.status)||!['comfortable','compact'].includes(v.density)||!['','document','date','account'].includes(v.sort)||!['ascending','descending'].includes(v.direction)||!Array.isArray(v.hidden)||v.hidden.some((key)=>!['date','account','description','costCenter','status'].includes(key)))return null;
  return {query:v.query,company:v.company,currency:v.currency,status:v.status,density:v.density,sort:v.sort,direction:v.direction,hidden:[...new Set(v.hidden)]};
 }catch{return null;}
}
export function erpReadView(root) {
 const read=(selector)=>{const el=root.querySelector(selector);return el instanceof HTMLInputElement||el instanceof HTMLSelectElement?el.value:'';};
 const sort=root.querySelector('[data-erp-sort][data-direction]');
 return {query:read('[data-erp-query]'),company:read('[data-erp-company-filter]'),currency:read('[data-erp-currency-filter]'),status:read('[data-erp-status-filter]'),density:read('[data-erp-density]'),sort:sort?.getAttribute('data-erp-sort')||'',direction:sort?.getAttribute('data-direction')||'ascending',hidden:[...root.querySelectorAll('[data-erp-column]')].filter(el=>el instanceof HTMLInputElement&&!el.checked).map(el=>el.getAttribute('data-erp-column'))};
}
export function erpDisplayColumns(root) {
 for(const control of root.querySelectorAll('[data-erp-column]'))if(control instanceof HTMLInputElement){for(const cell of root.querySelectorAll('[data-erp-col]'))if(cell.getAttribute('data-erp-col')===control.getAttribute('data-erp-column'))cell.toggleAttribute('hidden',!control.checked);}
 const density=root.querySelector('[data-erp-density]');root.setAttribute('data-erp-density-mode',density instanceof HTMLSelectElement?density.value:'comfortable');
}
export function erpRefreshViews(root) {
 const state=erpStates.get(root),select=root.querySelector('[data-erp-view]');if(!state||!(select instanceof HTMLSelectElement))return;
 const previous=select.value;select.replaceChildren(new Option('저장한 보기 선택',''));
 for(const view of state.views)select.add(new Option(view.name,view.name));select.value=previous;
 if(!select.value)select.value='';
 for(const key of ['load','delete']){const button=root.querySelector('[data-erp-view-'+key+']');if(button instanceof HTMLButtonElement)button.disabled=!select.value;}
}
export function erpSnapshot(root) {
 const header=[...root.querySelectorAll('[data-journal-company],[data-journal-date],[data-journal-currency]')].map(el=>el instanceof HTMLInputElement||el instanceof HTMLSelectElement?el.value:'');
 const rows=[...root.querySelectorAll('[data-journal-row]')].map(row=>({id:row.getAttribute('data-line-id'),values:[...row.querySelectorAll('input')].map(input=>input.value)}));
 return JSON.stringify({header,rows});
}
export function erpHistoryUi(root) {
 const state=erpStates.get(root);if(!state)return;
 for(const [key,disabled] of [['undo',state.cursor===0],['redo',state.cursor===state.history.length-1]]){const button=root.querySelector('[data-erp-'+key+']');if(button instanceof HTMLButtonElement)button.disabled=Boolean(disabled);}
 const dirty=root.querySelector('[data-erp-dirty]');if(dirty)dirty.textContent=erpSnapshot(root)===state.baseline?'입력 전 · 화면을 닫으면 기록이 사라집니다.':'변경된 초안 · 저장 전 · 화면을 닫으면 기록이 사라집니다.';
 const count=root.querySelector('[data-erp-error-count]'),targets=erpErrorTargets(root);
 if(count)count.textContent='오류 위치 '+targets.length+'곳';
 root.querySelectorAll('[data-erp-error-move]').forEach(el=>{if(el instanceof HTMLButtonElement)el.disabled=!targets.length;});
}
export function erpErrorTargets(root) {
 const targets=[...root.querySelectorAll('[data-journal-company][aria-invalid=true],[data-journal-date][aria-invalid=true]')];
 for(const row of root.querySelectorAll('[data-journal-row][data-invalid]')){const input=row.querySelector('input');if(input)targets.push(input);}
 return targets;
}
export function erpInit(root) {
 if(!root.hasAttribute('data-erp')||erpStates.has(root))return;
 const snapshot=erpSnapshot(root),state={history:[snapshot],cursor:0,group:null,baseline:snapshot,views:[],storage:true,key:'oscode.erp.views.v1:'+location.pathname+':'+(root.getAttribute('data-design')||root.querySelector('[data-erp-query]')?.id||'ledger')};
 erpStates.set(root,state);
 if(root.querySelector('[data-erp-ledger]')){
  try{const raw=localStorage.getItem(state.key)||'[]';if(raw.length>16000)throw Error('too large');const views=JSON.parse(raw);if(!Array.isArray(views)||views.length>8)throw Error('invalid views');
   for(const view of views){const config=erpCleanView(JSON.stringify(view?.config));if(typeof view?.name==='string'&&view.name.trim()&&view.name.length<=40&&config&&!state.views.some(item=>item.name===view.name))state.views.push({name:view.name,config});}
  }catch{state.storage=false;}
  root.querySelectorAll('[data-erp-row]').forEach((row,index)=>row.setAttribute('data-erp-position',String(index)));erpRefreshViews(root);erpDisplayColumns(root);erpUpdateLedger(root);
 }else{erpUpdateGrid(root);erpHistoryUi(root);}
}
export function erpRestore(root,step=0) {
 const state=erpStates.get(root);if(!state)return false;const next=state.cursor+step;if(next<0||next>=state.history.length)return false;
 const grid=root.querySelector('[data-erp-journal]'),body=grid?.querySelector('tbody'),template=body?.querySelector('[data-journal-row]');if(!body||!template)return false;
 const active=document.activeElement,focusId=active?.closest('[data-journal-row]')?.getAttribute('data-line-id'),focusCell=active?.getAttribute('data-erp-cell');
 const snapshot=JSON.parse(state.history[next]);body.replaceChildren();
 for(const saved of snapshot.rows){const row=template.cloneNode(true);if(!(row instanceof HTMLElement))continue;row.setAttribute('data-line-id',saved.id);[...row.querySelectorAll('input')].forEach((input,i)=>input.value=saved.values[i]);body.append(row);}
 [...root.querySelectorAll('[data-journal-company],[data-journal-date],[data-journal-currency]')].forEach((el,i)=>{if(el instanceof HTMLInputElement||el instanceof HTMLSelectElement)el.value=snapshot.header[i];});
 state.cursor=next;state.group=null;erpUpdateGrid(root);erpHistoryUi(root);
 if(focusCell){const row=[...body.children].find(row=>row.getAttribute('data-line-id')===focusId)||body.firstElementChild;const input=[...(row?.querySelectorAll('input')||[])].find(input=>input.getAttribute('data-erp-cell')===focusCell);input?.focus();}
 const info=root.querySelector('[data-erp-status]');if(info)info.textContent=step<0?'변경을 되돌렸습니다. 아직 저장하지 않았습니다.':'변경을 다시 실행했습니다. 아직 저장하지 않았습니다.';return true;
}
export function erpProAction(event,emit=()=>{}) {
 const origin=event.target,root=event.currentTarget;if(!(origin instanceof Element)||!(root instanceof HTMLElement)||!root.hasAttribute('data-erp')||origin.closest('.oc-design')!==root)return;
 erpInit(root);const state=erpStates.get(root),info=root.querySelector('[data-erp-status]');
 if(root.querySelector('[data-erp-ledger]')){
  const select=root.querySelector('[data-erp-view]'),name=root.querySelector('[data-erp-view-name]');
  if(event.type==='change'&&origin.matches('[data-erp-column],[data-erp-density]')){erpDisplayColumns(root);return;}
  if(event.type==='change'&&origin===select){erpRefreshViews(root);return;}
  if(event.type==='click'&&origin.closest('[data-erp-view-save],[data-erp-view-load],[data-erp-view-delete]')){
   if(!(select instanceof HTMLSelectElement)||!(name instanceof HTMLInputElement))return;
   if(origin.closest('[data-erp-view-load]')){
    const saved=state.views.find(view=>view.name===select.value);if(!saved)return;const v=saved.config;
    for(const [key,value] of [['query',v.query],['company-filter',v.company],['currency-filter',v.currency],['status-filter',v.status],['density',v.density]]){const el=root.querySelector('[data-erp-'+key+']');if(el instanceof HTMLInputElement||el instanceof HTMLSelectElement)el.value=value;}
    root.querySelectorAll('[data-erp-sort]').forEach(el=>{const selected=el.getAttribute('data-erp-sort')===v.sort;el.removeAttribute('data-direction');if(selected)el.setAttribute('data-direction',v.direction);el.closest('th')?.setAttribute('aria-sort',selected?v.direction:'none');});
    root.querySelectorAll('[data-erp-column]').forEach(el=>{if(el instanceof HTMLInputElement)el.checked=!v.hidden.includes(el.getAttribute('data-erp-column'));});
    root.querySelectorAll('[data-erp-select]').forEach(el=>{if(el instanceof HTMLInputElement)el.checked=false;});
    name.value=saved.name;erpDisplayColumns(root);erpUpdateLedger(root);if(info)info.textContent='보기 적용: '+saved.name+' · 행 선택은 해제했습니다.';return;
   }
   if(origin.closest('[data-erp-view-save]')){
    const title=name.value.trim(),config=erpCleanView(JSON.stringify(erpReadView(root)));if(!title||title.length>40||!config){if(info)info.textContent='보기 이름 1~40자와 검색어 100자 이하로 입력하세요.';name.focus();return;}
    const index=state.views.findIndex(view=>view.name===title);if(index<0&&state.views.length>=8){if(info)info.textContent='최대 8개까지 저장할 수 있습니다. 기존 보기를 삭제하세요.';return;}
    if(index<0)state.views.push({name:title,config});else state.views[index]={name:title,config};erpRefreshViews(root);select.value=title;
   }else{state.views=state.views.filter(view=>view.name!==select.value);}
   try{localStorage.setItem(state.key,JSON.stringify(state.views));state.storage=true;}catch{state.storage=false;}
   erpRefreshViews(root);if(info)info.textContent=(state.storage?'보기 설정을 이 브라우저에 저장했습니다.':'브라우저 저장을 사용할 수 없어 현재 화면에서만 보기를 유지합니다.')+' 전표 데이터는 저장하지 않습니다.';return;
  }
  if(event.type==='click'&&origin.closest('[data-erp-export]')){
   const rows=[...root.querySelectorAll('[data-erp-row]:not([hidden])')],selected=rows.filter(row=>row.querySelector('input:checked')),exported=selected.length?selected:rows;
   if(!exported.length){if(info)info.textContent='내보낼 표시 행이 없습니다.';return;}
   const headers=['전표 번호','회사','회계연도','전기일','계정','적요','원가센터','통화','차변','대변','상태'];
   const lines=[headers.map(value=>erpCsvCell(value)).join(',')];
   for(const row of exported){const cells=[...row.children].slice(1).map(cell=>cell.textContent||'');cells[8]=(row.getAttribute('data-debit')||'0').replaceAll(',','');cells[9]=(row.getAttribute('data-credit')||'0').replaceAll(',','');lines.push(cells.map(value=>erpCsvCell(value)).join(','));}
   const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='oscode-ledger.csv';root.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   if(info)info.textContent=(selected.length?'선택':'표시')+' '+exported.length+'행 CSV 다운로드 요청 · 숨긴 열도 포함됩니다.';emit({type:'erp-export',rows:exported.length,scope:selected.length?'selected':'filtered'});return;
  }
  erpAction(event,emit);return;
 }
 const key=event instanceof KeyboardEvent&&!event.isComposing&&(event.ctrlKey||event.metaKey)&&!event.altKey?event.key.toLowerCase():'';
 if(key==='z'||key==='y'||event.type==='click'&&origin.closest('[data-erp-undo],[data-erp-redo]')){event.preventDefault();const redo=key==='y'||key==='z'&&event instanceof KeyboardEvent&&event.shiftKey||Boolean(origin.closest('[data-erp-redo]'));if(erpRestore(root,redo?1:-1))emit({type:'erp-history',direction:redo?'redo':'undo'});return;}
 if(event.type==='click'&&origin.closest('[data-erp-error-move]')){
  erpUpdateGrid(root);const targets=erpErrorTargets(root);if(targets.length){const previous=origin.closest('[data-erp-error-move]')?.getAttribute('data-erp-error-move')==='previous';const index=state.errorIndex??-1;state.errorIndex=((index<0?(previous?0:-1):index)+(previous?-1:1)+targets.length)%targets.length;const target=targets[state.errorIndex];if(target instanceof HTMLElement)target.focus();if(info)info.textContent='오류 위치 '+(state.errorIndex+1)+' / '+targets.length+' · 필드와 행 검증 내용을 확인하세요.';}return;
 }
 if(event.type==='focusout'||event.type==='paste')state.group=null;
 erpAction(event,emit);
 if(['input','change','paste','click'].includes(event.type)){
  const snapshot=erpSnapshot(root);
  if(snapshot!==state.history[state.cursor]){const group=event.type==='input'?origin:null;state.history=state.history.slice(0,state.cursor+1);if(group&&state.group===group&&state.cursor>0)state.history[state.cursor]=snapshot;else{state.history.push(snapshot);if(state.history.length>21)state.history.shift();state.cursor=state.history.length-1;}state.group=group;state.errorIndex=-1;}
  erpHistoryUi(root);
 }
}
