import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
const safe = value => stripVTControlCharacters(String(value)).replace(/[\x00-\x1f\x7f]/g, ' ');
const shorten = (value, length) => { const chars = Array.from(safe(value)); return chars.length > length ? chars.slice(0, length - 1).join('') + '…' : chars.join(''); };

export function welcome({ root, model, plan, connected }) {
  return [
    '', '  OSCODE',
    `  ${shorten(path.basename(root) || root, 24)} · ${plan ? '계획 모드' : '작업 모드'}`,
    `  ${connected ? `모델 ${shorten(model, 36)}` : '모델 미연결 · 로컬 명령 사용 가능'}`,
    '', '  /settings 모델 설정   /key 키 입력', '  /help 도움말         /exit 종료', ''
  ].join('\n');
}
export const chatPrompt = '\n  › ';
export const answerHeading = '\n  OSCODE\n\n';
export function toolStatus({ name, is_error, content }) {
  return `  ${is_error ? '실패' : '완료'} · ${safe(name)}${is_error ? `\n  ${shorten(content, 160)}` : ''}`;
}
export function turnFooter(usage) {
  return `\n  토큰 ${Number(usage.input || 0).toLocaleString('en-US')} 입력 · ${Number(usage.output || 0).toLocaleString('en-US')} 출력${usage.estimated ? ' (추정 포함)' : ''}`;
}
