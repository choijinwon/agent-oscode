import {designMotion} from './design-motion.js';

// Serialized into native starters. Keep state inside the component root and avoid timers/global listeners.
export function patternAction(event,emit=()=>{}){
 const origin=event.target,root=event.currentTarget;
 if(!(origin instanceof Element)||!(root instanceof HTMLElement)||!root.hasAttribute('data-interaction')||origin.closest('.oc-design')!==root)return;
 const status=root.querySelector('[data-pattern-status]');
 if(event.type==='toggle'){
  if(origin instanceof HTMLDetailsElement){if(origin.open)designMotion(root,origin.querySelector('.oc-accordion-body'));emit({type:'accordion',open:origin.open,label:origin.querySelector('summary')?.textContent});}
  if(origin instanceof HTMLElement&&origin.hasAttribute('popover')&&origin.matches(':popover-open')){
   const trigger=root.querySelector('[data-pattern="menu-open"]');if(!(trigger instanceof HTMLElement))return;
   const rect=trigger.getBoundingClientRect(),width=origin.offsetWidth,height=origin.offsetHeight;
   origin.style.left=Math.max(12,Math.min(rect.left,innerWidth-width-12))+'px';
   origin.style.top=Math.max(12,Math.min(rect.bottom+6,innerHeight-height-12))+'px';
   designMotion(root,origin);origin.querySelector('button')?.focus();
  }return;
 }
 if(event.type==='change'&&origin instanceof HTMLInputElement&&origin.hasAttribute('data-segment')){
  let count=0;for(const item of root.querySelectorAll('[data-segment-item]')){const show=origin.value==='all'||item.getAttribute('data-segment-item')===origin.value;item.toggleAttribute('hidden',!show);if(show)count++;}
  if(status)status.textContent=count+'개 작업';designMotion(root,root.querySelector('.oc-segment-results'));emit({type:'segment',value:origin.value});return;
 }
 const form=origin.closest('[data-step-form]');
 if(event.type==='input'&&form&&origin instanceof HTMLInputElement)origin.setCustomValidity('');
 if(form instanceof HTMLFormElement&&(event.type==='submit'||event.type==='click'&&origin.closest('[data-pattern="step-back"]'))){
  event.preventDefault();const steps=[...form.querySelectorAll('fieldset')],current=steps.findIndex(step=>!step.hidden),back=event.type==='click';
  if(!back)for(const field of steps[current].querySelectorAll('input'))field.setCustomValidity(field.value.trim()?'':'입력 내용을 확인해주세요.');
  if(!back&&!form.reportValidity())return;
  let next=current+(back?-1:1);
  if(next===steps.length){
   const fields=[...form.querySelectorAll('input')],invalid=fields.find(field=>!field.value.trim());
   if(invalid){next=steps.findIndex(step=>step.contains(invalid));}
   else{if(status)status.textContent='입력을 확인했습니다. 실제 저장은 앱에서 연결하세요.';emit({type:'step-complete',values:Object.fromEntries(fields.map(field=>[field.name,field.value]))});return;}
  }
  if(next<0||next>=steps.length)return;
  steps.forEach((step,index)=>{step.hidden=index!==next;step.disabled=index!==next;});
  [...form.querySelectorAll('.oc-step-progress li')].forEach((step,index)=>{if(index===next)step.setAttribute('aria-current','step');else step.removeAttribute('aria-current');});
  const previous=form.querySelector('[data-pattern="step-back"]'),forward=form.querySelector('[data-pattern="step-next"]'),summary=form.querySelector('[data-step-summary]');
  previous?.toggleAttribute('hidden',next===0);if(forward)forward.textContent=next===steps.length-1?'완료':'다음';
  if(summary)summary.textContent=[...form.querySelectorAll('input')].map(field=>field.value).join(' · ');
  if(status)status.textContent=(next+1)+' / '+steps.length+' 단계';
  const focus=steps[next].querySelector('input')||steps[next].querySelector('legend');if(focus instanceof HTMLElement){if(focus.tagName==='LEGEND')focus.tabIndex=-1;focus.focus();}
  designMotion(root,steps[next]);emit({type:'step',index:next});return;
 }
 if(event instanceof KeyboardEvent&&origin.closest('.oc-action-popover')&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
  event.preventDefault();const buttons=[...root.querySelectorAll('.oc-action-popover button')],current=buttons.indexOf(origin);
  const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
  const button=buttons[next];if(button instanceof HTMLElement)button.focus();return;
 }
 if(event.type!=='click')return;
 const button=origin.closest('[data-pattern]');if(!(button instanceof HTMLButtonElement)||button.disabled)return;
 const action=button.getAttribute('data-pattern');
 if(action==='menu-choice'){
  const menu=button.closest('[popover]');if(menu instanceof HTMLElement&&typeof menu.hidePopover==='function')menu.hidePopover();
  if(status)status.textContent=button.textContent+' 선택됨 · 실제 작업은 앱에 연결하세요.';
  const trigger=root.querySelector('[data-pattern="menu-open"]');if(trigger instanceof HTMLElement)trigger.focus();emit({type:'menu-action',value:button.getAttribute('data-value')});
 }
 if(action==='archive'||action==='undo'||action==='toast-dismiss'){
  const toast=root.querySelector('[data-action-toast]'),launch=root.querySelector('[data-pattern="archive"]'),state=root.querySelector('[data-archive-state]');
  if(!(launch instanceof HTMLButtonElement))return;
  if(action==='archive'){
   root.dataset.archived='true';toast?.removeAttribute('hidden');if(state)state.textContent='디자인 검토 · 보관 목록에 있습니다.';
   launch.disabled=true;if(status)status.textContent='보관했습니다. 알림의 되돌리기로 취소할 수 있습니다.';
   designMotion(root,toast);const undo=root.querySelector('[data-pattern="undo"]');if(undo instanceof HTMLElement)undo.focus();
  }else{
   toast?.setAttribute('hidden','');launch.disabled=false;
   if(action==='undo'){delete root.dataset.archived;if(state)state.textContent='디자인 검토 · 진행 목록에 있습니다.';if(status)status.textContent='보관을 취소했습니다.';}
   else{launch.textContent='보관 알림 다시 보기';if(status)status.textContent='알림을 닫았습니다. 보관 상태는 유지됩니다.';}
   if(action==='undo')launch.textContent='보관하기';launch.focus();
  }emit({type:action,archived:root.dataset.archived==='true'});
 }
 if(action==='move-up'||action==='move-down'){
  const row=button.closest('[data-order-id]'),list=row?.parentElement;if(!(row instanceof HTMLElement)||!list)return;
  const sibling=action==='move-up'?row.previousElementSibling:row.nextElementSibling;if(!sibling)return;
  if(action==='move-up')list.insertBefore(row,sibling);else list.insertBefore(sibling,row);
  const rows=[...list.querySelectorAll('[data-order-id]')];rows.forEach((item,index)=>{const up=item.querySelector('[data-pattern="move-up"]'),down=item.querySelector('[data-pattern="move-down"]');if(up instanceof HTMLButtonElement)up.disabled=index===0;if(down instanceof HTMLButtonElement)down.disabled=index===rows.length-1;});
  const focus=button.disabled?row.querySelector('button:not(:disabled)'):button;if(focus instanceof HTMLElement)focus.focus();
  if(status)status.textContent=row.querySelector('[data-order-label]')?.textContent+' · '+(rows.indexOf(row)+1)+' / '+rows.length+'번째';
  designMotion(root,row);emit({type:'reorder',ids:rows.map(item=>item.getAttribute('data-order-id'))});
 }
}
