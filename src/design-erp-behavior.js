import {erpScale,erpParseAmount,erpFormatAmount,erpValidateJournal} from './design-erp-money.js';

// These helpers are serialized together into ERP starters. State stays inside each instance.
export function erpUpdateGrid(root) {
 const rows=[...root.querySelectorAll('[data-journal-row]')];
 const lines=rows.map(row=>{const values=[...row.querySelectorAll('input')].map(input=>input.value);return {id:row.getAttribute('data-line-id')||'',account:values[0]||'',description:values[1]||'',costCenter:values[2]||'',debit:values[3]||'',credit:values[4]||''};});
 const currency=root.querySelector('[data-journal-currency]'),company=root.querySelector('[data-journal-company]'),date=root.querySelector('[data-journal-date]');
 const state=erpValidateJournal(lines,currency instanceof HTMLSelectElement?currency.value:'KRW');
 const companyCode=company instanceof HTMLInputElement?company.value.trim():'',postingDate=date instanceof HTMLInputElement?date.value:'';
 const validCompany=/^[A-Za-z0-9]{4}$/.test(companyCode),validDate=/^\d{4}-\d{2}-\d{2}$/.test(postingDate)&&!Number.isNaN(Date.parse(postingDate))&&new Date(postingDate).toISOString().slice(0,10)===postingDate;
 company?.setAttribute('aria-invalid',String(!validCompany));date?.setAttribute('aria-invalid',String(!validDate));
 if(currency instanceof HTMLSelectElement)currency.disabled=lines.some(line=>line.debit.trim()||line.credit.trim());
 rows.forEach((row,index)=>{
  const number=row.querySelector('[data-line-number]'),remove=row.querySelector('[data-erp-remove]'),error=row.querySelector('[data-line-error]');
  if(number)number.textContent=String(index+1);
  if(remove instanceof HTMLButtonElement){remove.setAttribute('aria-label',(index+1)+'행 삭제');remove.disabled=rows.length===1;}
  const messages=state.errors.find(item=>item.id===row.getAttribute('data-line-id'))?.messages||[];
  row.toggleAttribute('data-invalid',messages.length>0);
  if(error){error.textContent=messages.join(' · ');error.id=(company?.id||'journal')+'-'+row.getAttribute('data-line-id')+'-error';}
  [...row.querySelectorAll('input')].forEach((input,i)=>{input.setAttribute('aria-label',(index+1)+'행 '+['계정','적요','원가센터','차변','대변'][i]);input.setAttribute('aria-invalid',String(messages.length>0));if(error)input.setAttribute('aria-describedby',error.id);});
 });
 for(const [selector,minor] of [['[data-journal-debit]',state.debitMinor],['[data-journal-credit]',state.creditMinor],['[data-journal-difference]',state.differenceMinor]]){
  const node=root.querySelector(selector||'');if(node)node.textContent=minor===null?'금액 오류':erpFormatAmount(BigInt(minor),state.scale)+' '+state.currency;
 }
 const valid=state.valid&&validCompany&&validDate,validation=root.querySelector('[data-journal-validation]'),draft=root.querySelector('[data-erp-draft]'),add=root.querySelector('[data-erp-add]');
 if(draft instanceof HTMLButtonElement)draft.disabled=!valid;if(add instanceof HTMLButtonElement)add.disabled=rows.length>=200;
 if(validation){validation.setAttribute('data-valid',String(valid));validation.textContent=!validCompany||!validDate?'회사 코드 4자리와 유효한 전기일을 입력하세요.':state.errors.length?'오류 '+state.errors.length+'행 · 행별 검증 내용을 확인하세요.':state.items.length<2?'2개 이상의 분개를 입력하세요.':!state.balanced?'대차 불일치 · 차변과 대변 합계가 같고 0보다 커야 합니다.':'대차 일치 · 입력 형식 검증 완료. 서버 검증은 별도입니다.';}
 return {...state,valid,companyCode,postingDate};
}
export function erpAppendRow(root) {
 const grid=root.querySelector('[data-erp-journal]'),body=grid?.querySelector('tbody'),source=body?.querySelector('[data-journal-row]');
 if(!(grid instanceof HTMLElement)||!body||!source||body.children.length>=200)return null;
 const row=source.cloneNode(true);if(!(row instanceof HTMLElement))return null;
 const next=Number(grid.dataset.nextLine||4);row.setAttribute('data-line-id','line-'+next);grid.dataset.nextLine=String(next+1);
 row.removeAttribute('data-invalid');row.querySelectorAll('input').forEach(input=>{input.value='';input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');});
 const error=row.querySelector('[data-line-error]');if(error){error.textContent='';error.removeAttribute('id');}
 body.append(row);return row;
}
export function erpUpdateLedger(root) {
 const rows=[...root.querySelectorAll('[data-erp-row]')],query=root.querySelector('[data-erp-query]'),company=root.querySelector('[data-erp-company-filter]'),currency=root.querySelector('[data-erp-currency-filter]'),status=root.querySelector('[data-erp-status-filter]');
 const text=query instanceof HTMLInputElement?query.value.trim().toLowerCase():'';
 const visible=rows.filter(row=>(row.textContent||'').toLowerCase().includes(text)&&[[company,'data-company'],[currency,'data-currency'],[status,'data-status']].every(([control,attribute])=>!(control instanceof HTMLSelectElement)||control.value==='all'||row.getAttribute(String(attribute))===control.value));
 rows.forEach(row=>{row.toggleAttribute('hidden',!visible.includes(row));row.toggleAttribute('data-selected',Boolean(row.querySelector('input:checked')));});
 const sort=root.querySelector('[data-erp-sort][data-direction]');
 if(sort){const key='data-'+sort.getAttribute('data-erp-sort'),direction=sort.getAttribute('data-direction')==='ascending'?1:-1;rows.sort((a,b)=>(a.getAttribute(key)||'').localeCompare(b.getAttribute(key)||'')*direction);const body=root.querySelector('tbody');if(body)for(const row of rows)body.append(row);}
 const groups=new Map();
 for(const row of visible){
  const currency=row.getAttribute('data-currency')||'KRW',company=row.getAttribute('data-company')||'',key=company+' · '+currency,scale=erpScale(currency);
  const group=groups.get(key)||{debit:0n,credit:0n,scale,valid:true},debit=erpParseAmount(row.getAttribute('data-debit')||'',scale),credit=erpParseAmount(row.getAttribute('data-credit')||'',scale);if(debit===null||credit===null)group.valid=false;else{group.debit+=debit;group.credit+=credit;}groups.set(key,group);
 }
 const totals=root.querySelector('[data-erp-totals]');
 if(totals){totals.replaceChildren();for(const [key,group] of groups){const p=document.createElement('p');p.textContent=!group.valid?key+' · 금액 오류 · 합계 계산 불가':key+' · 차변 '+erpFormatAmount(group.debit,group.scale)+' · 대변 '+erpFormatAmount(group.credit,group.scale)+' · 차이 '+erpFormatAmount(group.debit-group.credit,group.scale);totals.append(p);}if(!visible.length)totals.textContent='표시 행 없음 · 합계 없음';}
 const selected=visible.filter(row=>row.querySelector('input:checked')),all=root.querySelector('[data-erp-select-all]'),review=root.querySelector('[data-erp-review]'),info=root.querySelector('[data-erp-status]');
 if(all instanceof HTMLInputElement){all.disabled=!visible.length;all.checked=visible.length>0&&selected.length===visible.length;all.indeterminate=selected.length>0&&selected.length<visible.length;}
 if(review instanceof HTMLButtonElement)review.disabled=selected.length===0;
 root.querySelector('[data-erp-empty]')?.toggleAttribute('hidden',visible.length!==0);
 if(info)info.textContent='표시 '+visible.length+'행 · 선택 '+selected.length+'행';
 return selected.map(row=>row.getAttribute('data-row-id'));
}
export function erpAction(event,emit=()=>{}) {
 const origin=event.target,root=event.currentTarget;if(!(origin instanceof Element)||!(root instanceof HTMLElement)||!root.hasAttribute('data-erp')||origin.closest('.oc-design')!==root)return;
 const info=root.querySelector('[data-erp-status]');
 if(root.querySelector('[data-erp-ledger]')){
  const filter=origin.matches('[data-erp-query],[data-erp-company-filter],[data-erp-currency-filter],[data-erp-status-filter]');
  if(filter&&['input','change'].includes(event.type)||event.type==='click'&&origin.closest('[data-erp-reset]')){
   if(!filter){const query=root.querySelector('[data-erp-query]');if(query instanceof HTMLInputElement)query.value='';root.querySelectorAll('select').forEach(select=>select.value='all');}
   root.querySelectorAll('[data-erp-select]').forEach(input=>{if(input instanceof HTMLInputElement)input.checked=false;});erpUpdateLedger(root);return;
  }
  if(event.type==='change'&&origin instanceof HTMLInputElement&&origin.hasAttribute('data-erp-select-all'))for(const row of root.querySelectorAll('[data-erp-row]:not([hidden])')){const input=row.querySelector('input');if(input)input.checked=origin.checked;}
  const sort=origin.closest('[data-erp-sort]');
  if(event.type==='click'&&sort){const direction=sort.getAttribute('data-direction')==='ascending'?'descending':'ascending';root.querySelectorAll('[data-erp-sort]').forEach(button=>{button.removeAttribute('data-direction');button.closest('th')?.setAttribute('aria-sort','none');});sort.setAttribute('data-direction',direction);sort.closest('th')?.setAttribute('aria-sort',direction);erpUpdateLedger(root);return;}
  if(event.type==='change'&&origin.matches('[data-erp-select],[data-erp-select-all]')){erpUpdateLedger(root);return;}
  if(event.type==='click'&&origin.closest('[data-erp-review]')){const ids=erpUpdateLedger(root);if(ids.length){if(info)info.textContent=ids.length+'행 검토 요청 · 실제 처리는 앱에 연결하세요.';emit({type:'erp-selection',ids});}}return;
 }
 if(!root.querySelector('[data-erp-journal]'))return;
 if(event instanceof KeyboardEvent&&origin instanceof HTMLInputElement&&origin.hasAttribute('data-erp-cell')&&!event.isComposing){
  if(event.key==='Enter'||event.altKey&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){
   event.preventDefault();const rows=[...root.querySelectorAll('[data-journal-row]')],row=origin.closest('[data-journal-row]'),r=rows.findIndex(item=>item===row),cells=row?[...row.querySelectorAll('input')]:[],c=cells.indexOf(origin);
   const nextRow=r+(event.key==='Enter'?(event.shiftKey?-1:1):event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0),nextColumn=c+(event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0);
   const target=rows[nextRow]?.querySelectorAll('input')[nextColumn];target?.focus();return;
  }
 }
 if(event instanceof ClipboardEvent&&event.type==='paste'&&origin instanceof HTMLInputElement&&origin.hasAttribute('data-erp-cell')){
  const text=event.clipboardData?.getData('text/plain')||'';if(!/[\t\r\n]/.test(text))return;event.preventDefault();
  const rows=[...root.querySelectorAll('[data-journal-row]')],row=origin.closest('[data-journal-row]'),r=rows.findIndex(item=>item===row),c=row?[...row.querySelectorAll('input')].indexOf(origin):0;
  const matrix=text.replace(/\r\n?/g,'\n').replace(/\n$/,'').split('\n').map(line=>line.split('\t'));
  const select=root.querySelector('[data-journal-currency]'),scale=erpScale(select instanceof HTMLSelectElement?select.value:'KRW');
  const invalid=text.length>100000||r+matrix.length>200||matrix.some(line=>line.length>5-c||line.some((value,index)=>value.length>(c+index===1?100:c+index>=3?30:10)||c+index>=3&&erpParseAmount(value,scale)===null));
  if(invalid){if(info)info.textContent='붙여넣기 취소: 최대 200행·5열, 셀 길이와 금액 형식을 확인하세요. 기존 값은 유지됩니다.';return;}
  while(rows.length<r+matrix.length){const added=erpAppendRow(root);if(!added)break;rows.push(added);}
  matrix.forEach((values,index)=>values.forEach((value,column)=>{rows[r+index].querySelectorAll('input')[c+column].value=value;}));
  erpUpdateGrid(root);if(info)info.textContent=matrix.length+'행 붙여넣기 완료 · 검증 내용을 확인하세요.';emit({type:'erp-paste',rows:matrix.length});return;
 }
 if(event.type==='input'||event.type==='change'){erpUpdateGrid(root);if(info)info.textContent='변경된 초안 · 아직 저장하지 않았습니다.';return;}
 if(event.type!=='click')return;
 if(origin.closest('[data-erp-add]')){const row=erpAppendRow(root);erpUpdateGrid(root);row?.querySelector('input')?.focus();if(info)info.textContent=row?'행을 추가했습니다. 초안을 다시 검토하세요.':'최대 200행까지 입력할 수 있습니다.';return;}
 const remove=origin.closest('[data-erp-remove]');
 if(remove){const rows=[...root.querySelectorAll('[data-journal-row]')],row=remove.closest('[data-journal-row]'),index=rows.findIndex(item=>item===row);if(rows.length>1&&row){row.remove();erpUpdateGrid(root);root.querySelectorAll('[data-journal-row]')[Math.min(index,rows.length-2)]?.querySelector('input')?.focus();if(info)info.textContent='행을 삭제했습니다. 초안을 다시 검토하세요.';}return;}
 const draft=origin.closest('[data-erp-draft]'),validate=origin.closest('[data-erp-validate]');
 if(draft||validate){const state=erpUpdateGrid(root);
  if(!state.valid){const invalid=root.querySelector('input[aria-invalid="true"]');if(invalid instanceof HTMLElement)invalid.focus();return;}
  if(draft){emit({type:'erp-draft',companyCode:state.companyCode,postingDate:state.postingDate,currency:state.currency,scale:state.scale,lines:state.items,debitMinor:state.debitMinor,creditMinor:state.creditMinor});if(info)info.textContent='검증된 초안 이벤트를 전달했습니다. 실제 SAP 전기·저장 완료가 아닙니다.';}
 }
}
