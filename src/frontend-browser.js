import fs from 'node:fs/promises';
import path from 'node:path';
import {sessionDirectory} from './session.js';
import {validateUiUrl,viewports} from './ui-check.js';
export async function browserTask(tools,url,signal,run,{headless=true,timeout=60000,chromium:injected,onPage,viewport='desktop'}={}){
 url=validateUiUrl(url);
 if(!Object.hasOwn(viewports,viewport))throw Error('viewport: mobile, tablet, desktop');
 if(tools.readOnly||tools.permissions.shell==='deny')throw Error('BUILD 모드와 브라우저 실행 권한이 필요합니다.');
 signal?.throwIfAborted();
 if(!await tools.approve('shell',`화면 진단: ${url} · 페이지 스크립트와 네트워크 요청 실행`,signal))throw Error('브라우저 실행 취소');
 const chromium=injected||(await import('playwright')).chromium;
 const browser=await chromium.launch({headless,timeout:15000});let timer;
 const abort=()=>{browser.close().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,timeout);
 try{
  signal?.throwIfAborted();
  const context=await browser.newContext({viewport:viewports[viewport],serviceWorkers:'block',acceptDownloads:false,reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(5000);page.on('dialog',dialog=>dialog.dismiss().catch(()=>{}));
  context.on('page',popup=>{if(popup!==page)popup.close().catch(()=>{});});
  return await run({browser,context,page,url,onPage});
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);await browser.close();}
}
export async function saveFrontendReport(tools,kind,report){
 const dir=await fs.mkdtemp(path.join(await sessionDirectory(tools.root),kind+'-'));
 const file=path.join(dir,'report.json');report.file=file;report.created=new Date().toISOString();
 await fs.writeFile(file,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});return report;
}
export function publicUrl(value){const u=new URL(value);return u.origin+u.pathname;}
