import {stripVTControlCharacters} from 'node:util';
import {validateUiUrl} from './ui-check.js';
export function parseStateRun(input){
 const match=/^run\s+(\S+)\s+(.+)$/.exec(input.trim());
 if(!match)throw new Error('사용법: /states run http://localhost:3000 examples/ui-states.json');
 return {url:validateUiUrl(match[1]),scenario:match[2].trim(),viewport:'all'};
}
export async function runStateBrowser(tools,input,signal){
 const options=parseStateRun(input);
 // perform preserves permission checks and the host mutation lock without clipping JSON.
 const report=JSON.parse(await tools.perform('ui_check',options,signal));
 const safe=value=>JSON.stringify(stripVTControlCharacters(String(value)).replace(/[\x00-\x1f\x7f]/g,''));
 const rows=['# 실제 화면 동작 검증'];
 for(const result of report.results){
  const scenario=result.scenario;
  const verdict=result.error?'검증 미완료':!scenario?'검증 미완료':!scenario.passed?'실패':!scenario.assertions?'확인 조건 없음':'지정한 조건 통과';
  rows.push(`\n${result.viewport} · ${verdict}`);
  for(const step of scenario?.steps||[])rows.push(`  ${step.passed?'✓':'✗'} ${step.step}. ${step.action} ${safe(step.selector)}`);
  if(scenario&&!scenario.passed)rows.push(`  ${scenario.plannedSteps-scenario.steps.length}개 후속 단계 미실행`);
  if(result.error)rows.push(`  오류: ${safe(result.error)}`);
  if(result.screenshot)rows.push(`  화면: ${safe(result.screenshot)}`);
  if(result.trace)rows.push(`  실행 기록: ${safe(result.trace)}`);
 }
 rows.push(`\n보고서: ${safe(report.report)}`,`브라우저 진단 항목: ${report.findings}개`,
 '지정한 화면·순서·확인 조건만 검증합니다. 전체 기능 통과를 의미하지 않습니다. 실제 클릭·입력으로 테스트 서버의 데이터가 변경될 수 있습니다.');
 return rows.join('\n');
}
