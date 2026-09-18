import { clip } from './context.js';

// A review display of the proposed replacement, never an executable patch.
export function changePreview(file, before, after) {
  const removed = before === null ? [] : before.split('\n');
  const added = after.split('\n');
  const limit = 80;
  return [
    `변경 검토: ${file}`,
    before === null ? '--- /dev/null (새 파일)' : `--- ${file} (기존 구간)`,
    `+++ ${file} (제안 구간)`,
    ...removed.slice(0, limit).map(line => `- ${clip(line, 240)}`),
    ...(removed.length > limit ? [`[기존 구간 ${removed.length-limit}줄 생략]`] : []),
    ...added.slice(0, limit).map(line => `+ ${clip(line, 240)}`),
    ...(added.length > limit ? [`[제안 구간 ${added.length-limit}줄 생략]`] : []),
    '검토 후 y로 적용, n으로 취소. 생략된 내용은 도구 호출의 원문도 확인하세요.'
  ].join('\n');
}
