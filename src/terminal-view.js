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
  const t = theme(options);
  const line = text => '  ' + fit(text, t.width - 2);
  const rule = t.dim('  ' + '─'.repeat(t.width - 2));
  const commands = t.width >= 58
    ? ['시작하기', '/frontend  프로젝트 살펴보기    /settings  모델 연결', '/paste     코드 붙여넣기        /help      전체 명령']
    : ['시작하기', '/frontend  프로젝트 살펴보기', '/settings  모델 연결', '/paste     코드 붙여넣기', '/help      전체 명령'];
  return [
    '', t.accent(line('▰ OSCODE')),
    t.dim(line('FRONTEND CODING COMPANION')), '',
    t.bold(line(path.basename(root) || root)),
    t.dim(line(`${agent}  /  ${plan ? '계획' : '구현'}  /  예산 ${Number(budget).toLocaleString('en-US')}`)),
    line(connected ? `모델  ${model}` : '로컬 모드 · 키 없이 프로젝트를 둘러보세요'), '', rule, '',
    t.bold(line('무엇을 만들고 싶으세요?')),
    t.dim(line('예: 로그인 폼을 모바일에서도 쓰기 편하게 바꿔줘')), '',
    ...commands.map((value, index) => index === 0 ? t.bold(line(value)) : line(value)),
    '', rule, t.dim(line('Tab 명령 완성 · /key 키 입력 · /exit 종료')), ''
  ].join('\n');
}
export function inputFrame({ model, plan, connected, draft = false, ...options }) {
  const t = theme(options);
  const label = fit(`${plan ? 'PLAN · 계획' : 'BUILD · 구현'}  /  ${connected ? model : 'LOCAL'}${draft ? '  /  초안 준비됨' : ''}`, t.width - 4);
  return '\n' + t.dim('  ╭' + '─'.repeat(t.width - 3)) + '\n' + t.accent(`  │ ${label}`) + '\n' + t.dim('  │ ' + fit(draft ? '/draft 확인 · /send 전송 · /clear 취소' : '메시지 입력 · Enter 전송 · Tab 명령 완성', t.width - 4)) + '\n';
}
export function renderAnswerHeading(options) { return '\n' + theme(options).accent('  OSCODE') + '\n\n'; }
export const chatPrompt = '  ╰─ › ';
export const answerHeading = '\n  ◇ OSCODE\n\n';
const toolLabels = { frontend_impact: '변경 영향 분석', read_file: '코드 읽기', list_files: '파일 탐색', search: '코드 검색', edit_file: '코드 수정', write_file: '파일 생성', frontend_context: '컴포넌트 분석', frontend_inspect: '프로젝트 분석', shell: '명령 실행', analysis_checkpoint: '분석 메모 저장', ui_check: '화면 검사' };
export function toolStatus({ name, is_error, content }) {
  return `  ${is_error ? '실패' : '완료'} · ${toolLabels[name] || safe(name)}${is_error ? `\n  ${fit(content, 140)}` : ''}`;
}
export function turnFooter(usage) {
  return `\n  토큰 ${Number(usage.input || 0).toLocaleString('en-US')} 입력 · ${Number(usage.output || 0).toLocaleString('en-US')} 출력${usage.estimated ? ' (추정 포함)' : ''}`;
}
