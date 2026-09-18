import path from 'node:path';
import {stripVTControlCharacters} from 'node:util';

const checks = [
  {id:'loading',label:'로딩',pattern:/\b(?:isLoading|loading|isPending|pending|aria-busy|Suspense)\b/i,verify:'느린 응답에서 진행 표시가 나타나고 완료 후 사라지는지 확인하세요.'},
  {id:'error',label:'오류',pattern:/\b(?:isError|error|hasError|onError|ErrorBoundary)\b|role\s*=\s*["']alert["']/i,verify:'요청 실패 시 안내와 재시도 경로가 있고 입력 내용이 유지되는지 확인하세요.'},
  {id:'empty',label:'빈 결과',pattern:/\b(?:isEmpty|empty|noResults|noData)\b|\.length\s*(?:===?|<=)\s*0\b|!\s*[\w.]+\.length\b/i,verify:'결과 0개일 때 빈 이유와 다음 행동이 표시되는지 확인하세요.'},
  {id:'disabled',label:'비활성',pattern:/\b(?:disabled|aria-disabled|isSubmitting)\b/i,verify:'중복 제출이 차단되고 키보드 조작과 비활성 이유 안내가 적절한지 확인하세요.'}
];
export async function inspectStates(tools, file, signal){
  if(signal?.aborted)throw new Error('Cancelled.');
  if(!file?.trim())throw new Error('사용법: /states src/components/Example.tsx (Vue·Svelte·Angular HTML도 지원)');
  const resolved=await tools.resolve(file);
  if(!/\.(?:[cm]?[jt]sx?|vue|svelte|html)$/i.test(resolved))throw new Error('JS·TS·JSX·TSX·Vue·Svelte·HTML 파일을 지정하세요.');
  const original=await tools.text(resolved), source=original.slice(0,32000);
  if(signal?.aborted)throw new Error('Cancelled.');
  // Preserve line numbers while omitting block and HTML comments. Strings remain candidates.
  const lines=source.replace(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' ')).split('\n');
  return {file:path.relative(tools.root,resolved),scannedCharacters:source.length,truncated:original.length>source.length,
    states:checks.map(({id,label,pattern,verify})=>{
      const evidence=[];
      for(let i=0;i<lines.length&&evidence.length<3;i++){
        if(/^\s*\/\//.test(lines[i]))continue;
        const match=pattern.exec(lines[i]);
        if(match)evidence.push({line:i+1,marker:match[0]});
      }
      return {id,label,status:evidence.length?'candidate':'unverified',evidence,verify};
    }),limitations:'단일 파일의 문자열 기반 후보 분석입니다. 주석·문자열 오탐과 표현식 누락이 가능합니다. import·별도 템플릿·런타임 동작은 확인하지 않습니다. 후보 발견은 구현 완료가 아니며 미발견은 결함 판정이 아닙니다. 해당 상태가 필요 없는 컴포넌트도 있습니다.'};
}
export function statesText(report){
  const safe=value=>JSON.stringify(stripVTControlCharacters(String(value)).replace(/[\x00-\x1f\x7f]/g,''));
  return ['# 컴포넌트 UI 상태 점검',`파일: ${safe(report.file)} · ${report.scannedCharacters.toLocaleString('en-US')}자 분석${report.truncated?' · 32,000자 이후 생략':''}`,
    ...report.states.flatMap(state=>['',`## ${state.label} · ${state.evidence.length?'관련 표현 발견':'확인 필요'}`,...state.evidence.map(e=>`  ${safe(report.file)}:${e.line} · ${safe(e.marker)}`),`화면 확인: ${state.verify}`]),'',report.limitations,'Angular 외부 템플릿은 해당 .html 파일을 별도로 지정하세요. 실제 동작은 /states run URL 시나리오.json으로 검증하세요.'].join('\n');
}
