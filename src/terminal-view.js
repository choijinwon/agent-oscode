import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
const safe = value => stripVTControlCharacters(String(value)).replace(/[\x00-\x1f\x7f]/g, ' ');
const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
const widthOf = char => /\p{Extended_Pictographic}/u.test(char) || /[\u1100-\u115f\u2329\u232a\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe6f\uff01-\uff60\uffe0-\uffe6]/u.test(char) ? 2 : /^\p{Mark}+$/u.test(char) ? 0 : 1;
export function displayWidth(value) { return [...segmenter.segment(safe(value))].reduce((n, s) => n + widthOf(s.segment), 0); }
export function fit(value, limit) {
  const text = safe(value); if (displayWidth(text) <= limit) return text;
  let result = '', size = 0;
  for (const { segment } of segmenter.segment(text)) { const width = widthOf(segment); if (size + width > limit - 1) break; result += segment; size += width; }
  return result + '…';
}
function theme({ columns = process.stdout.columns || 80, color = Boolean(process.stdout.isTTY && !('NO_COLOR' in process.env) && process.env.TERM !== 'dumb') } = {}) {
  const width = Math.max(12, Math.min(88, columns - 2));
  const paint = (code, text) => color ? `\x1b[${code}m${text}\x1b[0m` : text;
  return { width, dim: text => paint('90', text), accent: text => paint('1;36', text), bold: text => paint('1', text) };
}
export function welcome({ root, model, plan, connected, agent = 'general', budget = 40000, ...options }) {
  const t = theme(options), inside = t.width - 4;
  const row = (value, style = x => x) => {
    const text = fit(value, inside);
    return t.dim('│ ') + style(text) + ' '.repeat(inside - displayWidth(text)) + t.dim(' │');
  };
  return ['\n' + t.dim('╭' + '─'.repeat(t.width - 2) + '╮'),
    row('OSCODE  /  FRONTEND CODING AGENT', t.accent),
    row(path.basename(root) || root, t.bold),
    row(`${plan ? 'PLAN' : 'BUILD'}  ·  ${agent}  ·  ${connected ? model : 'LOCAL / 모델 미연결'}`),
    t.dim('├' + '─'.repeat(t.width - 2) + '┤'),
    row('어떤 화면을 함께 만들까요?', t.bold),
    row('컴포넌트 구현부터 접근성 검사까지, 자연어로 요청하세요.'),
    row(''), row('/settings  모델 선택     /key   API 키 설정'),
    row('/frontend  프로젝트 분석 /help  모든 명령'),
    row(''), row(`요청당 예산 ${Number(budget).toLocaleString('en-US')} tokens · /status 상세 상태`, t.dim),
    t.dim('╰' + '─'.repeat(t.width - 2) + '╯'), ''].join('\n');
}
export function inputFrame({ model, plan, connected, draft = false, ...options }) {
  const t = theme(options);
  const label = fit(`${plan ? 'PLAN' : 'BUILD'} · ${connected ? model : 'LOCAL'}${draft ? ' · 붙여넣기 초안 있음' : ''}`, t.width - 4);
  return '\n' + t.dim('─'.repeat(t.width)) + '\n' + t.dim(`  ${label}`) + '\n' + t.dim(fit('  Enter 전송 · /paste 붙여넣기 · Ctrl+C 취소 · /exit 종료', t.width)) + '\n';
}
export const chatPrompt = '  › ';
export const answerHeading = '\n  ◇ OSCODE\n\n';
export function toolStatus({ name, is_error, content }) {
  return `  ${is_error ? '실패' : '완료'} · ${safe(name)}${is_error ? `\n  ${fit(content, 140)}` : ''}`;
}
export function turnFooter(usage) {
  return `\n  토큰 ${Number(usage.input || 0).toLocaleString('en-US')} 입력 · ${Number(usage.output || 0).toLocaleString('en-US')} 출력${usage.estimated ? ' (추정 포함)' : ''}`;
}
