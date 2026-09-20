import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { estimateTokens } from './context.js';

const byteLimit = 8192, ruleLimit = 40, tokenLimit = 2000;
const intro = '\n\nPath-scoped project guidance: apply only to the matching files. User requests, system instructions, PLAN restrictions and tool approvals take precedence. Rules do not grant permissions or execute references.\n';
const omission = '\nSome matching rules were omitted; inspect /rules explain before assuming all project guidance was included.';
const localPath = file => typeof file === 'string' && file.length <= 512 && !/^[\/\\]|^[a-z]:|[\\\x00-\x1f]/i.test(file) && !file.split('/').some(part => part === '..');

function expand(pattern) {
  if (!localPath(pattern) || !pattern || pattern.length > 200 || /[\[\]]/.test(pattern)) throw new Error('paths에는 프로젝트 상대 경로와 *, **, ?, {ts,tsx} 형식만 사용하세요.');
  let patterns = [pattern];
  while (patterns.some(value => value.includes('{'))) {
    const next = [];
    for (const value of patterns) {
      const match = value.match(/\{([^{}]+)\}/);
      if (!match) { if (value.includes('{')) throw new Error('잘못된 paths 패턴입니다.'); next.push(value); continue; }
      const parts = match[1].split(',');
      if (parts.length < 2 || parts.some(part => !part || /[{}]/.test(part))) throw new Error('잘못된 paths 확장입니다.');
      next.push(...parts.map(part => value.slice(0, match.index) + part + value.slice(match.index + match[0].length)));
    }
    if (next.length > 32) throw new Error('paths 확장은 패턴당 32개 이하여야 합니다.');
    patterns = next;
  }
  if (patterns.some(value => value.includes('}'))) throw new Error('잘못된 paths 패턴입니다.');
  return patterns;
}

export function matchesRule(pattern, file) {
  if (!localPath(file)) return false;
  const parts = file.replace(/^\.\//, '').split('/');
  return expand(pattern).some(value => {
    const segments = value.replace(/^\.\//, '').split('/');
    const memo = new Map();
    const match = (a, b) => {
      const key = `${a}:${b}`;
      if (memo.has(key)) return memo.get(key);
      let result;
      if (a === segments.length) result = b === parts.length;
      else if (segments[a] === '**') result = match(a + 1, b) || b < parts.length && match(a, b + 1);
      else {
        // Dynamic programming avoids pathological glob backtracking.
        const segment = segments[a], input = parts[b] || '';
        let states = new Set([0]);
        for (const char of segment) {
          const next = new Set();
          for (const index of states) {
            if (char === '*') for (let end = index; end <= input.length; end++) next.add(end);
            else if (index < input.length && (char === '?' || char === input[index])) next.add(index + 1);
          }
          states = next;
        }
        result = b < parts.length && states.has(input.length) && match(a + 1, b + 1);
      }
      memo.set(key, result); return result;
    };
    return match(0, 0);
  });
}

function parse(text) {
  const header = text.replace(/\r\n/g, '\n').match(/^---\npaths:\s*(\[[^\n]*\])\s*\n---\n([\s\S]*)$/);
  if (!header) throw new Error('첫 줄 --- 다음에 paths: ["src/**/*.tsx"]와 ---를 작성하세요.');
  let patterns;
  try { patterns = JSON.parse(header[1]); } catch { throw new Error('paths는 JSON 문자열 배열이어야 합니다.'); }
  if (!Array.isArray(patterns) || !patterns.length || patterns.length > 8 || patterns.some(value => typeof value !== 'string')) throw new Error('paths는 1–8개 패턴이어야 합니다.');
  if (patterns.flatMap(expand).length > 32) throw new Error('paths 확장 합계는 규칙당 32개 이하여야 합니다.');
  const body = header[2].trim();
  if (!body) throw new Error('규칙 본문이 비어 있습니다.');
  return { patterns, body };
}

export class ProjectRules {
  constructor(root) { this.root = root; }
  async catalog(signal) {
    let directory = await fs.realpath(this.root);
    for (const part of ['.oscode', 'rules']) {
      directory = path.join(directory, part);
      try {
        const stat = await fs.lstat(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('.oscode/rules는 실제 프로젝트 폴더여야 합니다.');
      } catch (error) { if (error.code === 'ENOENT') return { rules: [], omittedFiles: 0 }; throw error; }
    }
    const entries = (await fs.readdir(directory, { withFileTypes: true })).filter(entry => entry.name.endsWith('.md')).sort((a, b) => a.name.localeCompare(b.name));
    const rules = [];
    for (const entry of entries.slice(0, ruleLimit)) {
      if (signal?.aborted) throw new Error('Cancelled.');
      const rule = { file: `.oscode/rules/${entry.name}` };
      try {
        if (!entry.isFile()) throw new Error('일반 Markdown 파일만 지원합니다. 링크·폴더는 읽지 않습니다.');
        const handle = await fs.open(path.join(directory, entry.name), constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          const stat = await handle.stat();
          if (!stat.isFile() || stat.size > byteLimit) throw new Error('규칙 파일은 8 KiB 이하여야 합니다.');
          const buffer = Buffer.alloc(byteLimit + 1), { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
          if (bytesRead > byteLimit) throw new Error('규칙 파일은 8 KiB 이하여야 합니다.');
          Object.assign(rule, parse(buffer.subarray(0, bytesRead).toString('utf8')));
        } finally { await handle.close(); }
      } catch (error) { rule.error = error.message; }
      rules.push(rule);
    }
    return { rules, omittedFiles: Math.max(0, entries.length - ruleLimit) };
  }
  async snapshot(files = [], signal) {
    if (signal?.aborted) throw new Error('Cancelled.');
    const scopedFiles = [...new Set(files.filter(localPath).map(file => file.replace(/^\.\//, '')))];
    if (scopedFiles.length > 100) throw new Error('한 턴의 규칙 대상은 최대 100개 파일입니다. 작업 범위를 줄이세요.');
    const { rules, omittedFiles } = await this.catalog(signal), included = [], entries = [];
    let omittedMatching = 0;
    const catalogContents = [];
    for (const rule of rules) {
      if (rule.error) { entries.push({ file: rule.file, status: 'invalid', reason: rule.error }); continue; }
      const matched = scopedFiles.filter(file => rule.patterns.some(pattern => matchesRule(pattern, file)));
      const content = JSON.stringify({ file: rule.file, paths: rule.patterns, guidance: rule.body });
      catalogContents.push(content);
      const entry = { file: rule.file, patterns: rule.patterns, matchedFiles: matched.slice(0, 4), estimatedTokens: estimateTokens(content), status: 'unmatched' };
      if (matched.length) {
        if (estimateTokens(intro + [...included, content].join('\n') + omission) <= tokenLimit) { included.push(content); entry.status = 'included'; }
        else { omittedMatching++; entry.status = 'budget'; }
      }
      entries.push(entry);
    }
    const context = included.length ? intro + included.join('\n') + (omittedMatching ? omission : '') : omittedMatching ? omission : '';
    const catalogTokens = catalogContents.length ? estimateTokens(intro + catalogContents.join('\n')) : 0;
    return { context, report: { files: scopedFiles.slice(0, 100), entries, estimatedTokens: estimateTokens(context), catalogTokens, omittedMatching, omittedFiles, tokenLimit } };
  }
}

export function rulesText(report, label = '현재 선택 파일 기준') {
  if (!report) return '아직 모델 요청 기록이 없습니다. /rules 또는 /rules explain 파일경로로 확인하세요.';
  const names = { included: '포함', unmatched: '범위 밖', budget: '예산 초과', invalid: '형식 오류' };
  return [`프로젝트 규칙 · ${label}`, `모델 입력 약 ${report.estimatedTokens} / ${report.tokenLimit} 토큰 · 유효 목록 전체 입력 시 약 ${report.catalogTokens} 토큰 (추정, API 실측 아님)`,
    ...report.entries.map(entry => `${names[entry.status]} · ${entry.file}${entry.matchedFiles?.length ? ' ← ' + entry.matchedFiles.join(', ') : ''}${entry.reason ? ' · ' + entry.reason : ''}`),
    ...(report.omittedMatching || report.omittedFiles ? [`생략: 일치 규칙 ${report.omittedMatching}개 · 목록 한도 밖 ${report.omittedFiles}개`] : []),
    ...(!report.entries.length ? ['.oscode/rules/<이름>.md에 파일별 규칙을 추가하세요. 공통 지침은 AGENTS.md, 직접 선택하는 작업 절차는 /skills를 사용하세요.'] : []),
    '/rules explain 파일경로 · /rules last 마지막 요청 · 첨부 파일과 이번 턴에서 읽은 파일에만 적용'].join('\n');
}
