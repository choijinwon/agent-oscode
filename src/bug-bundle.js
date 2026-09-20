import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {sessionDirectory} from './session.js';
import {checkUi,validateUiUrl,viewports} from './ui-check.js';
import {validateScenario} from './ui-workflow.js';
import {validateProbe} from './ui-probes.js';
async function regular(file,limit){const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>limit)throw Error('일반 파일 크기 제한 또는 링크 검사를 통과하지 못했습니다.');return fs.readFile(file);}
export function validateReplay(value){
 if(!value||value.version!==1||Object.keys(value).some(k=>!['version','url','viewport','scenario','baseline','a11y','probe'].includes(k)))throw Error('지원하지 않는 replay.json');
 validateUiUrl(value.url);if(value.viewport!=='all'&&!Object.hasOwn(viewports,value.viewport))throw Error('잘못된 재현 화면 크기');
 if(value.a11y!==undefined&&typeof value.a11y!=='boolean')throw Error('잘못된 접근성 옵션');
 if(value.baseline!==undefined)throw Error('공유 재현에서는 별도 승인 이미지 기준을 사용하지 않습니다.');
 if(value.scenario)validateScenario(value.scenario);validateProbe(value.probe);return value;
}
export async function exportBug(tools,run,signal){
 if(!/^ui-[A-Za-z0-9_-]{1,80}$/.test(run))throw Error('/bug ui-실행ID 형식으로 지정하세요.');
 if(tools.readOnly||tools.permissions.write==='deny')throw Error('BUILD 모드와 쓰기 권한이 필요합니다.');
 signal?.throwIfAborted();const base=await sessionDirectory(tools.root),source=path.join(base,run);
 if((await fs.lstat(source)).isSymbolicLink())throw Error('링크 폴더는 공유할 수 없습니다.');
 const report=JSON.parse((await regular(path.join(source,'report.json'),1024*1024)).toString());
 const replay=JSON.parse((await regular(path.join(source,'replay.json'),200000)).toString());delete replay.baseline;validateReplay(replay);
 if(!Array.isArray(report.results)||report.results.length>3)throw Error('잘못된 UI 보고서');
 const names=['replay.json'];for(const item of report.results){
  if(!Object.hasOwn(viewports,item.viewport))throw Error('잘못된 UI 보고서');
  for(const key of ['screenshot','trace'])if(item[key]){
   const name=path.basename(item[key]);if(!new RegExp('^'+item.viewport+'(?:-failure)?\\.png$|^'+item.viewport+'-trace\\.zip$').test(name))throw Error('지원하지 않는 첨부 파일');names.push(name);
  }
 }
 if(!await tools.approve('write',`로컬 버그 묶음 생성: ${run} · 테스트 입력·화면·실행 기록이 포함됩니다. 공유 전 내용을 확인하세요. 외부 업로드 없음`,signal))throw Error('버그 묶음 저장 취소');
 const files=[];let total=0;
 for(const name of [...new Set(names)]){
  signal?.throwIfAborted();const data=name==='replay.json'?Buffer.from(JSON.stringify(replay,null,2)):await regular(path.join(source,name),20*1024*1024);
  total+=data.length;if(total>40*1024*1024)throw Error('공유 묶음 최대 40 MiB');files.push({name,data});
 }
 const safe={version:1,url:report.url,environment:report.environment,created:report.created,findings:report.findings,incomplete:report.incomplete,results:report.results.map(r=>({...r,screenshot:r.screenshot?path.basename(r.screenshot):undefined,trace:r.trace?path.basename(r.trace):undefined,visual:undefined}))};
 files.push({name:'report.json',data:Buffer.from(JSON.stringify(safe,null,2))});
 files.push({name:'README.md',data:Buffer.from('# OSCODE 버그 재현\n\n대상 앱을 같은 코드와 테스트 데이터로 실행하세요. 이 묶음에는 앱 소스·로그인 쿠키·서버 데이터가 포함되지 않습니다. 이미지·trace·시나리오에는 테스트 입력과 화면 정보가 포함될 수 있으므로 공유 전에 확인하세요.\n\n묶음 폴더를 대상 프로젝트 안에 복사한 뒤 OSCODE 대화창에서 실행하세요:\n\n`/replay http://localhost:3000 복사한폴더/replay.json`\n\nURL은 자신의 개발 서버로 바꾸세요. 명시적인 브라우저 실행 승인이 적용됩니다. 모델/API 키 없이 실행합니다. 기준 이미지 비교는 별도 기준 승인이 필요하므로 이 묶음에서 제외합니다. 외부 공유는 자동으로 실행하지 않습니다.\n')});
 const dir=await fs.mkdtemp(path.join(base,'bug-'));
 try{
  for(const {name,data}of files)await fs.writeFile(path.join(dir,name),data,{flag:'wx',mode:0o600});
  await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({version:1,files:files.map(({name,data})=>({name,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}))},null,2),{flag:'wx',mode:0o600});
 }catch(e){await fs.rm(dir,{recursive:true,force:true});throw e;}
 return {directory:dir,files:files.map(f=>f.name),note:'로컬에 저장했습니다. 외부 공유는 하지 않았습니다. 다른 환경에서 재현 여부를 확인하세요.'};
}
export async function replayBug(tools,url,file,signal){
 if(tools.readOnly||tools.permissions.shell==='deny')throw Error('BUILD 모드와 실행 권한이 필요합니다.');
 url=validateUiUrl(url);let data;
 // Own generated bundles are the only .oscode paths accepted; arbitrary session files stay private.
 if(/^\.oscode\/bug-[A-Za-z0-9_-]+\/replay\.json$/.test(file)){
  const base=await sessionDirectory(tools.root),dir=path.join(base,file.split('/')[1]);if((await fs.lstat(dir)).isSymbolicLink())throw Error('링크 폴더는 허용하지 않습니다.');data=(await regular(path.join(dir,'replay.json'),200000)).toString();
 }else data=await tools.text(await tools.resolve(file));
 const replay=validateReplay(JSON.parse(data));
 if(!await tools.approve('shell',`버그 재현: ${url} · 시나리오의 실제 클릭/요청 실행`,signal))throw Error('재현 취소');
 return checkUi({root:tools.root,...replay,url,signal});
}
