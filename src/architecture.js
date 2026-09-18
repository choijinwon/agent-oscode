import path from 'node:path';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {stripVTControlCharacters} from 'node:util';
import {sessionDirectory} from './session.js';

export async function inspectArchitecture(tools, directory = '.', signal) {
  if(signal?.aborted)throw new Error('Cancelled.');
  const files = (await tools.files(directory, signal)).filter(f => /\.[jt]sx?$|\.(vue|svelte|astro)$/.test(f));
  const sample = files.slice(0, 60), nodes = [], edges = [];
  const candidates = new Set(files);
  for (const file of sample) {
    if (signal?.aborted) throw new Error('Cancelled.');
    let source;
    try { source = await tools.text(await tools.resolve(file)); } catch { continue; }
    source = source.slice(0, 24000);
    nodes.push({ file, boundary: /^\s*['"]use client['"]/.test(source) ? 'client' : /^\s*['"]use server['"]/.test(source) ? 'server directive' : 'unspecified' });
    const imports = source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g);
    let count = 0;
    for (const match of imports) {
      if (++count > 40) break;
      if (!match[1].startsWith('.')) continue;
      const base = path.normalize(path.join(path.dirname(file), match[1]));
      const stem = base.replace(/\.[cm]?jsx?$/, '');
      const target = [base, ...['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.astro', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'].flatMap(ext => [base + ext, stem + ext])].find(f => candidates.has(f));
      if (target && edges.length < 300) edges.push({ from: file, to: target });
    }
  }
  const groups = {
    routes: files.filter(f => /(^|\/)(app|pages|routes)\//.test(f)).slice(0, 8),
    features: files.filter(f => /(^|\/)(features|modules|domains)\//.test(f)).slice(0, 8),
    shared: files.filter(f => /(^|\/)(shared|components|ui)\//.test(f)).slice(0, 8),
    data: files.filter(f => /(^|\/)(api|services|queries|hooks|store|stores)\//.test(f)).slice(0, 8)
  };
  const crossings = edges.filter(e => /(^|\/)(shared|components\/ui)\//.test(e.from) && /(^|\/)(app|pages|routes|features)\//.test(e.to)).slice(0, 8);
  const cycles = [], visited = new Set(), active = [];
  const visit = file => {
    const index = active.indexOf(file);
    if (index !== -1) { if (cycles.length < 5) cycles.push([...active.slice(index), file]); return; }
    if (visited.has(file)) return;
    visited.add(file); active.push(file);
    for (const e of edges.filter(e => e.from === file)) visit(e.to);
    active.pop();
  };
  for (const node of nodes) visit(node.file);
  return JSON.stringify({ scope: directory, scannedFiles: nodes.length, eligibleFiles: files.length, groups, dependencyCount:edges.length, dependencyExamples:edges.slice(0,12),
    clientBoundaries: nodes.filter(n => n.boundary !== 'unspecified').slice(0, 10), relativeImportCycles: cycles, sharedToFeatureCandidates: crossings,
    guidance: ['Preserve established architecture; do not force a new folder convention.', 'For a new small app: routes compose screens; features own domain behavior; shared UI receives data and callbacks; data modules handle external I/O.', 'Place library wrappers beside existing shared UI and reuse theme/provider boundaries. Keep business data fetching out of generic UI.', 'Plan migrations incrementally, with target files, imports, tests and rollback scope; avoid moving the entire repository.'],
    limitations: 'Heuristic source scan: first 60 files, 24k characters/file, 40 imports/file, 300 edges. Relative imports only; aliases, re-exports, comments, type-only imports and framework semantics may produce omissions or false positives. Candidates require source verification; not a complete dependency graph.' }, null, 2);
}


export function architectureText(report){
 const clean=value=>stripVTControlCharacters(String(value??'')).replace(/[\x00-\x08\x0b-\x1f\x7f]/g,'');
 const name=value=>JSON.stringify(clean(value));
 const rows=['# 프론트엔드 아키텍처 분석','',`범위: ${name(report.scope)} · 분석 ${report.scannedFiles}/${report.eligibleFiles}개 파일 · 의존 관계 ${report.dependencyCount||0}개`,'','## 폴더 역할 후보'];
 for(const [key,label] of [['routes','화면·라우트'],['features','기능·도메인'],['shared','공통 UI'],['data','데이터·상태']]){
  rows.push(`\n${label}`,...(report.groups[key].length?report.groups[key].map(file=>'  '+name(file)):['  폴더 이름 기준으로 발견되지 않음']));
 }
 rows.push('','## 직접 의존 관계 (일부)',...(report.dependencyExamples?.length?report.dependencyExamples.map(edge=>`${name(edge.from)} → ${name(edge.to)}`):['발견되지 않음 · 의존성이 없다는 뜻은 아닙니다.']));
 rows.push('','## 확인할 구조 후보');
 for(const cycle of report.relativeImportCycles)rows.push('순환 참조: '+cycle.map(name).join(' → '));
 for(const edge of report.sharedToFeatureCandidates)rows.push(`공통 UI → 기능 결합: ${name(edge.from)} → ${name(edge.to)}`);
 for(const boundary of report.clientBoundaries)rows.push(`실행 경계: ${name(boundary.file)} · ${clean(boundary.boundary)}`);
 if(!report.relativeImportCycles.length&&!report.sharedToFeatureCandidates.length)rows.push('분석 범위에서 순환·공통 UI 결합 후보를 찾지 못했습니다. 전체 구조 통과 판정은 아닙니다.');
 rows.push('','## 개선 순서','1. 후보 파일의 실제 import와 사용처를 확인합니다.','2. 기존 구조를 유지하면서 공통 UI에 들어온 업무 로직을 분리할지 검토합니다.','3. 변경은 작은 단위로 계획하고 /review로 검증합니다.','','제한: 폴더 이름·문자열 기반 분석입니다. 처음 60개 파일, 파일당 24,000자, 상대경로 import만 확인하며 별칭·동적 로딩·템플릿은 누락될 수 있습니다. 주석·타입 import 때문에 잘못된 후보가 나올 수도 있습니다.');
 return rows.join('\n');
}
export async function architectureReport(tools,directory='.',signal){
 const report=JSON.parse(await inspectArchitecture(tools,directory,signal));
 if(signal?.aborted)throw new Error('Cancelled.');
 const dir=await sessionDirectory(tools.root),id=randomUUID();
 const markdown=path.join(dir,`architecture-${id}.md`),json=path.join(dir,`architecture-${id}.json`),text=architectureText(report);
 await fs.writeFile(json,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
 await fs.writeFile(markdown,text+'\n',{flag:'wx',mode:0o600});
 return {report,text,markdown,json};
}
