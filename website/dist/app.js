for(const button of document.querySelectorAll('[data-copy]'))button.addEventListener('click',async()=>{
 const target=document.getElementById(button.dataset.copy),status=document.getElementById('copy-status');
 try{await navigator.clipboard.writeText(target.textContent);button.textContent='완료';status.textContent='복사했습니다.';setTimeout(()=>button.textContent='복사',1800);}
 catch{const range=document.createRange();range.selectNodeContents(target);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);status.textContent='명령어를 선택했습니다. 직접 복사하세요.';}
});
const tabs=[...document.querySelectorAll('[data-install]')];
function activate(tab){for(const item of tabs){const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;document.getElementById(item.getAttribute('aria-controls')).hidden=!selected;}}
for(const tab of tabs){tab.addEventListener('click',()=>activate(tab));tab.addEventListener('keydown',event=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(tabs.indexOf(tab)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;activate(tabs[index]);tabs[index].focus();});}
const search=document.getElementById('doc-search'),links=[...document.querySelectorAll('[data-doc-link]')];
search?.addEventListener('input',()=>{let count=0;for(const link of links){link.hidden=!link.textContent.toLowerCase().includes(search.value.trim().toLowerCase());if(!link.hidden)count++;}document.getElementById('search-empty').hidden=count>0;});
function highlight(){for(const link of links){const selected=link.hash===(location.hash||'#install');link.classList.toggle('active',selected);if(selected)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}}
addEventListener('hashchange',highlight);highlight();
const menu=document.querySelector('.sidebar details');if(menu&&matchMedia('(max-width:650px)').matches)menu.open=false;
