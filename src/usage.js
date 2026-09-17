import { estimateTokens, emptyUsage, addUsage } from './context.js';

export function contextUsage(system, messages, tools) {
  const result = { instructions: estimateTokens(system), toolSchema: estimateTokens(tools), userText: 0, assistantText: 0, toolCalls: 0, toolResults: 0 };
  for (const m of messages) {
    if (m.role === 'tool') result.toolResults += estimateTokens(m.content);
    else if (m.role === 'user') result.userText += estimateTokens(m.content || '');
    else { result.assistantText += estimateTokens(m.content || ''); if (m.tool_calls) result.toolCalls += estimateTokens(m.tool_calls); }
  }
  result.overhead = Math.max(0, estimateTokens({ system, messages, tools }) + 256 - Object.values(result).reduce((a, b) => a + b, 0));
  return result;
}
export function costEstimate(usage, rates, provider) {
  if (provider === 'demo') return 0;
  if (!rates || (usage.cacheRead > 0 && rates.cacheRead === undefined) || (usage.cacheWrite > 0 && rates.cacheWrite === undefined)) return null;
  return (Math.max(0, usage.input - usage.cacheRead - usage.cacheWrite) * rates.input + usage.output * rates.output + (usage.cacheRead || 0) * (rates.cacheRead || 0) + (usage.cacheWrite || 0) * (rates.cacheWrite || 0)) / 1e6;
}
export function beginRequest(turn, config, estimate, maxOutput, breakdown) {
  const rates = config.pricing?.[config.provider]?.[config.model];
  const record = { index: (turn.requests?.length || 0) + 1, timestamp: new Date().toISOString(), provider: config.provider || 'unknown', model: config.model, inputEstimate: estimate, maxOutput, context: breakdown, status: 'pending', rates: rates ? { ...rates } : null, usage: null, costUsd: null };
  (turn.requests ||= []).push(record);
  return record;
}
export function finishRequest(record, usage, status = 'complete') {
  record.status = status; record.usage = { ...usage };
  record.costUsd = costEstimate(usage, record.rates, record.provider);
}
export function usageText(u) {
  return `토큰 입력 ${u.input} · 출력 ${u.output} · 캐시 읽기 ${u.cacheRead} / 쓰기 ${u.cacheWrite} · 호출 ${u.requests}${u.estimated ? ` · 추정 포함 ${u.estimated}회` : ''}`;
}
export function usageReport(session, detail = false) {
  const turns = [...(session.archive || []), ...session.turns];
  const rows = turns.flatMap((turn, i) => (turn.requests || []).map(r => ({ ...r, turn: i + 1 })));
  const priced = rows.filter(r => r.costUsd !== null && r.costUsd !== undefined);
  const unknown = rows.filter(r => r.costUsd === null || r.costUsd === undefined).length;
  const legacy = turns.filter(t => !t.requests && t.usage?.requests).length;
  const totalCost = priced.reduce((sum, r) => sum + r.costUsd, 0);
  const lines = [usageText(session.usage), `설정 단가 기준 예상 비용: ${priced.length ? `$${totalCost.toFixed(6)}` : '미산정'}${unknown || legacy ? ` · 비용 미산정 요청 ${unknown}${legacy ? ` / 이전 형식 턴 ${legacy}` : ''}` : ''}`];
  if (!rows.length) { lines.push('요청별 분석 기록이 없습니다. 새 요청부터 기록됩니다.'); return lines.join('\n'); }
  const byModel = new Map();
  const breakdown = {};
  for (const row of rows) {
    const key = `${row.provider}/${row.model}`;
    if (!byModel.has(key)) byModel.set(key, emptyUsage());
    if (row.usage) addUsage(byModel.get(key), row.usage);
    for (const [key, value] of Object.entries(row.context || {})) breakdown[key] = (breakdown[key] || 0) + value;
  }
  lines.push('모델별:', ...[...byModel].map(([key, u]) => `  ${key}: ${usageText(u)}`));
  const labels = { instructions: '지침', toolSchema: '도구 정의', userText: '사용자 입력', assistantText: '모델 응답', toolCalls: '도구 호출', toolResults: '도구 결과', overhead: '형식/여유분' };
  lines.push('입력 구성 추정 (반복 전송 포함; API 실측과 별개):', ...Object.entries(breakdown).sort((a, b) => b[1] - a[1]).map(([key, value]) => `  ${labels[key] || key}: ${value}`));
  const displayed = detail ? rows : rows.slice(-5);
  lines.push(`요청별 (${detail ? '전체' : '최근 5개'}):`, ...displayed.map(r => `  턴 ${r.turn} #${r.index} ${r.model} · ${r.status} · 입력 ${r.usage?.input ?? '?'} / 출력 ${r.usage?.output ?? '?'}${r.usage?.estimated ? ' (추정/예약)' : ''} · ${r.costUsd == null ? '비용 미산정' : `약 $${r.costUsd.toFixed(6)}`}`));
  return lines.join('\n');
}
