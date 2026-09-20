import {checkUi,viewports,validateUiUrl} from './ui-check.js';
import {validateProbe} from './ui-probes.js';
import {validateScenario} from './ui-workflow.js';
import {saveFrontendReport} from './frontend-browser.js';
export function validateStress(config){
 if(!config||Object.keys(config).some(k=>k!=='cases')||!Array.isArray(config.cases)||!config.cases.length||config.cases.length>6)throw Error('cases에 1–6개 테스트를 지정하세요.');
 const names=new Set();
 for(const c of config.cases){
  if(!c||Object.keys(c).some(k=>!['name','viewport','probe','scenario','a11y'].includes(k))||typeof c.name!=='string'||!c.name.trim()||c.name.length>80||names.has(c.name))throw Error('고유한 테스트 name과 지원 옵션을 지정하세요.');names.add(c.name);
  if(c.viewport!==undefined&&!Object.hasOwn(viewports,c.viewport))throw Error('테스트 viewport: mobile/tablet/desktop');
  if(c.a11y!==undefined&&typeof c.a11y!=='boolean')throw Error('a11y: boolean');
  validateProbe(c.probe);if(c.scenario)validateScenario(c.scenario);
 }
 return config;
}
export function stressVerdict(report){
 if(report.incomplete)return 'incomplete';
 if(report.findings>0)return 'findings';
 if(!report.results.every(r=>r.scenario?.assertions>0))return 'observed-only';
 return 'passed';
}
export async function runStress(tools,url,file,signal){
 url=validateUiUrl(url);
 if(tools.readOnly||tools.permissions.shell==='deny')throw Error('BUILD 모드와 실행 권한이 필요합니다.');
 const config=validateStress(file?JSON.parse(await tools.text(await tools.resolve(file))):{cases:[{name:'좁은 화면',viewport:'mobile',probe:{width:320}},{name:'다크 모드',viewport:'desktop',probe:{colorScheme:'dark'}},{name:'큰 글자',viewport:'mobile',probe:{textScale:2}}]});
 const cases=[];
 for(const c of config.cases){
  signal?.throwIfAborted();if(!await tools.approve('shell',`UI 스트레스: ${c.name} · ${url}`,signal))throw Error('브라우저 실행 취소');
  const report=await checkUi({root:tools.root,url,viewport:c.viewport||'mobile',scenario:c.scenario,a11y:c.a11y||false,probe:c.probe,signal});
  cases.push({name:c.name,status:stressVerdict(report),findings:report.findings,report:report.file,run:report.directory.split(/[\\/]/).at(-1)});
 }
 return saveFrontendReport(tools,'stress',{kind:'ui-stress',cases,note:'Passed applies only to explicit assertions and enabled diagnostics. observed-only has no behavior assertions. Fixtures do not verify the real backend.'});
}
