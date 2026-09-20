import {browserTask,saveFrontendReport,publicUrl} from './frontend-browser.js';
const hydration=/hydration|hydrat(?:e|ing).*mismatch|did not match|server rendered html|NG05\d\d|hydration_mismatch|hydration_attribute_changed|hydration_html_changed|Minified React error #(418|419|421|422|423|425)/i;
export function hydrationFindings(messages){return messages.filter(m=>hydration.test(m.text)).slice(0,20);}
async function snapshot(page,selector){
 const locator=page.locator(selector);if(await locator.count()!==1)return {found:false};
 return locator.evaluate(el=>({found:true,text:el.innerText?.replace(/\s+/g,' ').trim().slice(0,3000)||'',tags:[el,...el.querySelectorAll('*')].slice(0,400).map(x=>x.tagName.toLowerCase()).join(',')}));
}
export async function diagnoseHydration(tools,{url,selector='body'},signal,options={}){
 if(typeof selector!=='string'||!selector.trim()||selector.length>1000)throw Error('selector를 확인하세요.');
 const report=await browserTask(tools,url,signal,async({browser,page,url})=>{
  const plain=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block',viewport:{width:1440,height:900}});let server;
  try{const p=await plain.newPage();p.on('dialog',d=>d.dismiss().catch(()=>{}));const response=await p.goto(url,{waitUntil:'load',timeout:15000});server={status:response?.status(),...await snapshot(p,selector)};}finally{await plain.close();}
  const messages=[];const add=(type,text)=>{if(messages.length<50)messages.push({type,text:String(text).slice(0,600)});};
  page.on('console',m=>{if(['warning','error'].includes(m.type()))add(m.type(),m.text());});page.on('pageerror',e=>add('error',e.message));
  const response=await page.goto(url,{waitUntil:'load',timeout:15000});await page.waitForTimeout(500);const client={status:response?.status(),...await snapshot(page,selector)};
  const first=hydrationFindings(messages),firstOther=messages.filter(m=>!hydration.test(m.text));messages.length=0;const reloadResponse=await page.reload({waitUntil:'load',timeout:15000});await page.waitForTimeout(500);const reload={status:reloadResponse?.status(),...await snapshot(page,selector)},second=hydrationFindings(messages);
  return {kind:'hydration-diagnostic',url:publicUrl(url),selector,server,client,reload,hydrationSignals:[...first,...second],otherErrors:[...firstOther,...messages.filter(m=>!hydration.test(m.text))].slice(0,10),domChanged:server.text!==client.text||server.tags!==client.tags,
   status:!server.found||!client.found||!reload.found||server.status>=400||client.status>=400||reload.status>=400?'incomplete':first.length+second.length?'hydration-signal':firstOther.length||messages.length?'other-browser-signals':'no-hydration-signal',
   note:'Three independent loads (JS off, JS on, reload), not a capture of pre-hydration DOM from one response. Dynamic data and client-only apps cause expected differences. No console signal is not proof of hydration correctness.'};
 },options);
 const files=(await tools.files('.',signal)).filter(f=>/\.(tsx?|jsx?|vue|svelte|html)$/.test(f)).slice(0,100);report.sourceCandidates=[];
 for(const file of files){signal?.throwIfAborted();let text;try{text=(await tools.text(await tools.resolve(file))).slice(0,24000);}catch{continue;}
  for(const [i,line]of text.split('\n').entries())if(/Date\.now\(|Math\.random\(|new Date\(|\b(?:window|document|localStorage)\./.test(line)&&report.sourceCandidates.length<20)report.sourceCandidates.push({file,line:i+1,reason:'브라우저 전용 API 또는 비결정적 렌더링 후보 · SSR 실행 여부를 소스에서 확인하세요.'});
 }
 return saveFrontendReport(tools,'hydrate',report);
}
