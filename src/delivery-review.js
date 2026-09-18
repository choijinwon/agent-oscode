import {verifyProject} from './verify.js';
import {stripVTControlCharacters} from 'node:util';
const safe=value=>stripVTControlCharacters(String(value??'')).replace(/[\x00-\x08\x0b-\x1f\x7f]/g,'');
const labels={passed:'통과',failed:'실패',error:'오류',blocked:'승인·설정 필요',skipped:'미검증',planned:'예정',running:'진행 중'};
export function reviewVerdict(report){
 const steps=report.steps||[],scripts=steps.filter(step=>step.script),browser=steps.find(step=>step.name==='browser');
 const failed=steps.filter(step=>['failed','error'].includes(step.status));
 const missing=steps.filter(step=>!['passed','failed','error'].includes(step.status));
 const status=report.status==='cancelled'?'cancelled':failed.length?'failed':!scripts.length||!browser||browser.status!=='passed'||missing.length?'incomplete':'passed';
 return {status,label:{passed:'구성된 검사 통과',failed:'수정·재검사 필요',incomplete:'검증 미완료',cancelled:'검증 취소'}[status],passed:steps.filter(step=>step.status==='passed').length,failed:failed.length,unverified:missing.length};
}
export function reviewText(report){
 const verdict=reviewVerdict(report);
 return [`프론트엔드 작업 검증 · ${verdict.label}`,`검사 시각: ${safe(report.created)}`,`변경 파일: ${report.changed?.length??'미수집'}개 · 통과 ${verdict.passed} · 실패/오류 ${verdict.failed} · 미검증 ${verdict.unverified}`,'',
 ...(report.changed||[]).slice(0,20).map(file=>'  '+safe(file)),...(report.changed?.length>20?['  … 전체 목록은 보고서 확인']:[]),'',
 ...(report.steps||[]).map(step=>`[${labels[step.status]||'확인 필요'}] ${safe(step.name)}${step.reason?' · '+safe(step.reason):''}`),'',
 ...(!report.steps?.some(step=>step.script)?['다음: oscode.json의 verify.scripts에 실제 검사 스크립트를 지정하세요.']:[]),
 ...(report.steps?.some(step=>step.name==='browser'&&step.status==='skipped')?['다음: /review http://localhost:3000 또는 verify.devScript/verify.url을 설정하세요.']:[]),
 `보고서: ${safe(report.html||'생성되지 않음')}`,'검사 당시 결과입니다. 자동 검사가 제품 전체의 정확성·접근성 준수를 보증하지 않습니다. 변경 후 다시 실행하세요.'].join('\n');
}
export async function deliveryReview({tools,config,url,signal,emit,verify=verifyProject}){
 if(config.plan)throw new Error('PLAN에서는 검사를 실행하지 않습니다. BUILD로 전환하세요.');
 if(config.permissions?.shell==='deny')throw new Error('프로젝트 설정에서 검사 실행이 금지되어 있습니다.');
 return verify({tools,config,url,changed:true,signal,approve:tools.approve,emit});
}
