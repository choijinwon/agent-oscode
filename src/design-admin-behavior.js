// Serialized into generated starters: keep behavior independent of module state.
export function adminAction(event, emit=()=>{}) {
  const origin=event.target,root=event.currentTarget;
  if(!(origin instanceof Element)||!(root instanceof HTMLElement)||origin.closest('.oc-design')!==root)return;
  if(event.type==='change'&&origin instanceof HTMLSelectElement){
    if(origin.hasAttribute('data-admin-period')){
      const period=origin.value==='month'?'month':'week';
      for(const node of root.querySelectorAll('[data-week]')){
        const value=node.getAttribute('data-'+period)||'';
        if(node instanceof HTMLMeterElement){node.value=Number(value);node.textContent=value+'%';}else node.textContent=value;
      }
      const status=root.querySelector('[data-admin-period-status]');if(status)status.textContent=(period==='week'?'최근 7일':'최근 30일')+' 예시 데이터';
      emit({type:'period',value:period});return;
    }
    if(origin.hasAttribute('data-admin-role')){
      const note=root.querySelector('[data-admin-role-note]');
      if(note)note.textContent=origin.value==='admin'?'관리자: 사용자와 프로젝트 설정을 관리합니다.':origin.value==='editor'?'편집자: 프로젝트 내용을 조회하고 수정합니다.':'조회자: 목록과 상세 화면을 조회합니다.';
      emit({type:'role-preview',value:origin.value});return;
    }
  }
  if(event.type==='click'){
    const menu=origin.closest('[data-admin-menu]');
    if(menu){const nav=root.querySelector('.oc-admin-nav');if(nav instanceof HTMLElement){nav.hidden=!nav.hidden;menu.setAttribute('aria-expanded',String(!nav.hidden));menu.textContent=nav.hidden?'메뉴 펼치기':'메뉴 접기';}return;}
    const link=origin.closest('[data-admin-nav]');
    if(link){
      for(const node of root.querySelectorAll('[data-admin-nav]')){if(node===link)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');}
      const title=root.querySelector('[data-admin-section]'),description=root.querySelector('[data-admin-section-description]'),status=root.querySelector('[data-admin-navigation-status]');
      if(title)title.textContent=link.textContent;
      if(description)description.textContent=link.getAttribute('data-admin-nav')==='members'?'팀원과 초대 상태를 관리하세요.':link.getAttribute('data-admin-nav')==='settings'?'프로젝트의 기본 설정을 관리하세요.':'오늘의 업무와 최근 활동을 확인하세요.';
      if(status)status.textContent=link.textContent+' 화면 선택됨';emit({type:'navigate',section:link.getAttribute('data-admin-nav')});return;
    }
  }
  if((event.type==='input'&&origin.hasAttribute('data-admin-log-query'))||(event.type==='change'&&origin.hasAttribute('data-admin-log-filter'))){
    const query=root.querySelector('[data-admin-log-query]'),filter=root.querySelector('[data-admin-log-filter]');
    if(!(query instanceof HTMLInputElement)||!(filter instanceof HTMLSelectElement))return;
    let count=0;
    for(const row of root.querySelectorAll('[data-admin-log]'))if(row instanceof HTMLElement){
      row.hidden=!(row.textContent||'').toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())||(filter.value!=='all'&&row.getAttribute('data-admin-log')!==filter.value);if(!row.hidden)count++;
    }
    const status=root.querySelector('[data-admin-log-count]'),empty=root.querySelector('[data-admin-log-empty]');if(status)status.textContent=count+'개 활동';empty?.toggleAttribute('hidden',count!==0);return;
  }
  const table=root.querySelector('[data-admin-table]');if(!(table instanceof HTMLElement))return;
  const query=table.querySelector('[data-admin-query]'),filter=table.querySelector('[data-admin-filter]'),all=table.querySelector('[data-select-page]');
  if(!(query instanceof HTMLInputElement)||!(filter instanceof HTMLSelectElement)||!(all instanceof HTMLInputElement))return;
  const reset=event.type==='click'&&origin.closest('[data-admin-reset]'),sort=event.type==='click'&&origin.closest('[data-admin-sort]'),page=event.type==='click'&&origin.closest('[data-admin-page]'),bulk=event.type==='click'&&origin.closest('[data-admin-bulk]');
  const changedQuery=(event.type==='input'&&origin===query)||(event.type==='change'&&origin===filter);
  const selection=event.type==='change'&&origin instanceof HTMLInputElement&&(origin===all||origin.hasAttribute('data-row-select'));
  if(!reset&&!sort&&!page&&!bulk&&!changedQuery&&!selection)return;
  const rows=[...table.querySelectorAll('[data-admin-row]')].filter(node=>node instanceof HTMLTableRowElement);
  const checks=rows.map(row=>row.querySelector('[data-row-select]')).filter(node=>node instanceof HTMLInputElement);
  if(bulk){
    const ids=rows.filter(row=>{const check=row.querySelector('[data-row-select]');return check instanceof HTMLInputElement&&check.checked;}).map(row=>row.getAttribute('data-row-id'));
    if(ids.length){const status=table.querySelector('[data-admin-bulk-status]');if(status)status.textContent=ids.length+'개 항목 검토 요청';emit({type:'bulk',action:'review',ids});}return;
  }
  if(reset){query.value='';filter.value='all';query.focus();}
  if(reset||changedQuery){table.dataset.page='0';for(const check of checks)check.checked=false;}
  if(reset||changedQuery||selection){const status=table.querySelector('[data-admin-bulk-status]');if(status)status.textContent='';}
  if(sort){
    table.dataset.sort=table.dataset.sort==='ascending'?'descending':'ascending';table.dataset.page='0';
    sort.closest('th')?.setAttribute('aria-sort',table.dataset.sort);sort.textContent='이름 정렬 '+(table.dataset.sort==='ascending'?'↑':'↓');
  }
  const sorted=rows.slice().sort((a,b)=>table.dataset.sort?((a.querySelector('[data-name]')?.textContent||'').localeCompare(b.querySelector('[data-name]')?.textContent||'','ko')*(table.dataset.sort==='ascending'?1:-1)):Number(a.getAttribute('data-order'))-Number(b.getAttribute('data-order')));
  if(sort){const body=table.querySelector('tbody');for(const row of sorted)body?.append(row);}
  const matches=sorted.filter(row=>(row.textContent||'').toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())&&(filter.value==='all'||row.getAttribute('data-status')===filter.value));
  const pages=Math.max(1,Math.ceil(matches.length/3));
  const current=Math.min(pages-1,Math.max(0,Number(table.dataset.page||0)+(page?Number(page.getAttribute('data-admin-page')):0)));table.dataset.page=String(current);
  const visible=matches.slice(current*3,current*3+3);
  for(const row of rows)row.hidden=!visible.includes(row);
  const visibleChecks=visible.map(row=>row.querySelector('[data-row-select]')).filter(node=>node instanceof HTMLInputElement);
  if(selection&&origin===all)for(const check of visibleChecks)check.checked=all.checked;
  const selected=checks.filter(check=>check.checked).length,visibleSelected=visibleChecks.filter(check=>check.checked).length;
  all.checked=visibleChecks.length>0&&visibleSelected===visibleChecks.length;all.indeterminate=visibleSelected>0&&visibleSelected<visibleChecks.length;all.disabled=visibleChecks.length===0;
  for(const button of table.querySelectorAll('[data-admin-page]'))if(button instanceof HTMLButtonElement)button.disabled=button.getAttribute('data-admin-page')==='-1'?current===0:current===pages-1;
  const action=table.querySelector('[data-admin-bulk]');if(action instanceof HTMLButtonElement)action.disabled=selected===0;
  table.querySelector('[data-admin-empty]')?.toggleAttribute('hidden',matches.length!==0);
  const status=table.querySelector('[data-admin-table-status]');if(status)status.textContent='선택 '+selected+'개 · '+matches.length+'개 중 '+(matches.length?current*3+1:0)+'–'+Math.min(matches.length,current*3+3)+' · '+(current+1)+'/'+pages+' 페이지';
}
