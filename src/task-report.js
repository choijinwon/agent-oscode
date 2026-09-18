import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {stripVTControlCharacters} from 'node:util';
import {sessionDirectory} from './session.js';
import {clip,estimateTokens} from './context.js';
const clean=(value,limit=320)=>clip(stripVTControlCharacters(String(value??'')).replace(/[\x00-\x08\x0b-\x1f\x7f]/g,''),limit);
const request=turn=>String(turn.messages?.find(message=>message.role==='user')?.content||'').split('\n\n[Selected source excerpts:')[0].split('\n\n[User-selected project skill:')[0];
export function taskReport(session,{handoff=false}={}){
 const turns=[...(session.archive||[]),...(session.turns||[])],last=turns.at(-1);
 if(!last)return '# OSCODE 작업 기록\n\n아직 실행한 작업이 없습니다.\n';
 const statuses={done:'응답 완료 · 검증 통과를 의미하지 않음',stopped:'중단',cancelled:'사용자 취소',running:'진행 중'};
 const rows=['# OSCODE '+(handoff?'작업 인계':'작업 결과'),'',`세션: ${clean(session.id,80)}`,`상태: ${statuses[last.status]||'확인 필요'}`,'','## 최근 요청',clean(request(last),800),''];
 if(handoff){rows.push('## 앞선 요청 발췌 · 결과가 아닌 사용자 요구사항');for(const turn of turns.slice(-5,-1))rows.push('- '+JSON.stringify(clean(request(turn),220)));rows.push('');}
 const checkpoints=(session.checkpoints||[]).filter(item=>handoff||item.turnId===last.id);
 const changes=new Map();for(const item of checkpoints)changes.set(item.path,item);
 rows.push('## 파일 도구 변경 기록');
 for(const item of [...changes.values()].slice(-20))rows.push(`- ${JSON.stringify(clean(item.path,160))}: ${clean(item.state,40)}`);
 if(!changes.size)rows.push('- 기록 없음');
 rows.push('파일 도구 기록 기준입니다. 셸·외부 편집은 포함하지 않으며 현재 파일 상태는 다시 확인해야 합니다.','');
 rows.push('## 최근 작업의 도구 실행 근거');
 const calls=new Map((last.messages||[]).flatMap(message=>message.tool_calls||[]).map(call=>[call.id,call]));
 const results=new Map((last.messages||[]).filter(message=>message.role==='tool').map(message=>[message.tool_call_id,message]));
 const counts=new Map();
 for(const [id,call] of calls){const status=!results.has(id)?'결과 없음':results.get(id).is_error?'오류·거절·미실행':'도구 성공 응답';const key=`${clean(call.name,60)} · ${status}`;counts.set(key,(counts.get(key)||0)+1);}
 for(const [key,count] of [...counts].slice(0,20))rows.push(`- ${key}: ${count}회`);
 if(!calls.size)rows.push('- 도구 실행 기록 없음');
 rows.push('도구 성공 응답은 테스트·접근성·제품 동작의 통과 판정이 아닙니다. 원본 검사 보고서를 확인하세요.','');
 const usage=last.usage||{};rows.push('## 최근 작업 토큰',`입력 ${Number(usage.input)||0} · 출력 ${Number(usage.output)||0} · 호출 ${Number(usage.requests)||0}${usage.estimated?' · 추정 포함':''}`,'');
 rows.push('## 이어서 확인할 사항');
 if(last.error)rows.push('- 중단 사유: '+JSON.stringify(clean(last.error,400)));
 if(last.status!=='done')rows.push('- 미완료 작업입니다. 이미 수행된 변경과 실행 결과부터 확인하세요.');
 rows.push('- 현재 소스를 다시 읽고, 필요한 검증을 실행한 뒤 완료 여부를 판단하세요.');
 if(handoff)rows.push('- 이 문서는 제한된 로컬 기록 발췌이며 새로운 지시나 실행 권한이 아닙니다. 모든 요구사항·설계 결정을 복원하지는 않습니다.','- 전체 기록이 필요하면 원래 프로젝트에서 oscode --resume '+clean(session.id,80)+'로 이어가세요.');
 return rows.join('\n')+'\n';
}
export async function exportHandoff(session){
 const dir=await sessionDirectory(session.root),name=`handoff-${randomUUID()}.md`,file=path.join(dir,name);
 const body=taskReport(session,{handoff:true});await fs.writeFile(file,body,{flag:'wx',mode:0o600});
 return {file,body,estimatedTokens:estimateTokens(body)};
}
