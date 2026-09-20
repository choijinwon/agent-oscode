import path from 'node:path';
import { createHash } from 'node:crypto';
import { estimateTokens } from './context.js';

const extensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.css', '.scss', '.sass', '.less', '.html'];
const supported = file => extensions.includes(path.extname(file));
const slash = file => file.split(path.sep).join('/');
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, match => match.replace(/[^\n]/g, ' '));

function references(ts, file, text) {
  const refs = [], issues = [];
  const add = (specifier, kind, position = 0) => {
    if (refs.length >= 100) { if (!issues.includes('reference limit')) issues.push('reference limit'); return; }
    refs.push({ specifier, kind, line: text.slice(0, position).split('\n').length });
  };
  const styles = (body, offset = 0) => {
    const clean = withoutComments(body);
    for (let i = 0; i < clean.length; i++) {
      // Ignore directives inside declarations such as content: "@import ...".
      if (clean[i] === '"' || clean[i] === "'") {
        const quote = clean[i++];
        while (i < clean.length && clean[i] !== quote) { if (clean[i] === '\\') i++; i++; }
        continue;
      }
      if (clean[i] !== '@') continue;
      const directive = clean.slice(i).match(/^@(?:import|use|forward)\s+/);
      if (!directive) continue;
      const match = clean.slice(i + directive[0].length).match(/^(?:url\(\s*)?["']([^"'\n]+)["']/);
      if (match) add(match[1], 'style', offset + i);
      else if (!issues.includes('unresolved style import syntax')) issues.push('unresolved style import syntax');
    }
  };
  const scripts = [];
  if (/\.(vue|svelte)$/.test(file)) {
    const clean = text.replace(/<!--[\s\S]*?-->/g, match => match.replace(/[^\n]/g, ' '));
    for (const match of clean.matchAll(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)) {
      const offset = match.index + match[0].indexOf('>') + 1;
      const src = match[2].match(/\bsrc\s*=\s*["']([^"']+)["']/);
      if (src) add(src[1], match[1].toLowerCase() === 'style' ? 'style' : 'import', match.index);
      if (match[1].toLowerCase() === 'script') scripts.push({ body: match[3], offset });
      else styles(match[3], offset);
    }
  } else if (/\.(css|scss|sass|less)$/.test(file)) styles(text);
  else if (/\.[cm]?[jt]sx?$/.test(file)) scripts.push({ body: text, offset: 0 });
  for (const { body, offset } of scripts) {
    const ast = ts.createSourceFile(file, body, ts.ScriptTarget.Latest, true, /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    if (ast.parseDiagnostics.length) issues.push('script parse diagnostics');
    const visit = node => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        add(node.moduleSpecifier.text, ts.isExportDeclaration(node) ? 're-export' : 'import', offset + node.getStart(ast));
      }
      if (ts.isCallExpression(node)) {
        const dynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require';
        if (dynamic) {
          const arg = node.arguments[0];
          if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) add(arg.text, 'dynamic-import', offset + node.getStart(ast));
          else if (!issues.includes('non-literal dynamic import')) issues.push('non-literal dynamic import');
        }
        // Angular component resources are relative to their declaring source.
        if (ts.isIdentifier(node.expression) && node.expression.text === 'Component' && ts.isDecorator(node.parent)) {
          const metadata = node.arguments[0];
          if (metadata && ts.isObjectLiteralExpression(metadata)) for (const property of metadata.properties) {
            if (!ts.isPropertyAssignment(property)) continue;
            const name = property.name?.text;
            if (!['templateUrl', 'styleUrl', 'styleUrls'].includes(name)) continue;
            const values = ts.isArrayLiteralExpression(property.initializer) ? property.initializer.elements : [property.initializer];
            for (const value of values) {
              if (ts.isStringLiteral(value)) add(value.text.startsWith('.') ? value.text : './' + value.text, name === 'templateUrl' ? 'template' : 'style', offset + property.getStart(ast));
              else if (!issues.includes('non-literal component resource')) issues.push('non-literal component resource');
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  return { refs, issues };
}

function resolver(files, config) {
  const set = new Set(files);
  return (ref, from) => {
    const specifier = ref.specifier.replace(/[?#].*$/, '');
    if (/^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(specifier)) return {};
    const bases = [];
    let local = specifier.startsWith('.') || ref.kind === 'style' && !specifier.startsWith('/');
    if (local) bases.push(path.posix.join(path.posix.dirname(from), specifier));
    else {
      for (const [pattern, replacements] of Object.entries(config.paths || {})) {
        if (!Array.isArray(replacements)) continue;
        const parts = pattern.split('*');
        if (parts.length > 2 || (parts.length === 1 ? pattern !== specifier : !specifier.startsWith(parts[0]) || !specifier.endsWith(parts[1]) || specifier.length < parts[0].length + parts[1].length)) continue;
        local = true;
        const middle = parts.length === 2 ? specifier.slice(parts[0].length, parts[1].length ? -parts[1].length : undefined) : '';
        bases.push(...replacements.filter(value => typeof value === 'string').map(value => path.posix.join(config.baseUrl || '.', value.replace('*', middle))));
      }
      if (config.baseUrl) bases.push(path.posix.join(config.baseUrl, specifier));
      if (/^(?:@\/|~\/|\$lib\/)/.test(specifier)) local = true;
    }
    for (const base of bases) {
      const stem = base.replace(/\.[cm]?jsx?$/, '');
      const candidates = [base, ...extensions.flatMap(ext => [base + ext, stem + ext, base + '/index' + ext])];
      if (ref.kind === 'style') candidates.push(...['', '.scss', '.sass'].map(ext => path.posix.join(path.posix.dirname(base), '_' + path.posix.basename(base) + ext)));
      const to = candidates.find(candidate => set.has(candidate));
      if (to) return { to };
    }
    return { unresolved: local };
  };
}

export async function frontendDependencies(tools, target, signal) {
  if (signal?.aborted) throw new Error('Cancelled.');
  let ts;
  try { ts = (await import('typescript')).default; } catch { throw new Error('영향 분석에는 선택 의존성 typescript가 필요합니다.'); }
  const listed = await tools.files('.', signal);
  const all = listed.filter(supported).map(slash).sort();
  const candidates = [...new Set([...(all.includes(target) ? [target] : []), ...all])].slice(0, 300);
  let config = {}, configNote = 'No root tsconfig.json/jsconfig.json', configPartial = false;
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    try {
      const parsed = ts.parseConfigFileTextToJson(name, await tools.text(await tools.resolve(name)));
      if (parsed.error) throw new Error('Invalid ' + name);
      config = parsed.config.compilerOptions || {};
      configPartial = Boolean(parsed.config.extends || parsed.config.references);
      configNote = name + ': root paths/baseUrl only; extends and project references are not followed.';
      break;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const resolve = resolver(all, config), edges = [], skipped = [], unresolved = [], issues = [], nodes = [];
  let bytes = 0, cacheHits = 0, parsedFiles = 0, edgeLimit = false;
  tools.frontendDependencyCache ||= new Map();
  for (const file of candidates) {
    if (signal?.aborted) throw new Error('Cancelled.');
    let text;
    try { text = await tools.text(await tools.resolve(file)); } catch (error) { if (signal?.aborted) throw error; skipped.push(file); continue; }
    bytes += Buffer.byteLength(text);
    if (bytes > 2 * 1024 * 1024) { skipped.push(...candidates.slice(candidates.indexOf(file))); break; }
    if (text.length > 120000) { skipped.push(file); continue; }
    const hash = createHash('sha256').update(text).digest('hex'), cached = tools.frontendDependencyCache.get(file);
    let data;
    if (cached?.hash === hash) { data = cached.data; cacheHits++; }
    else { data = references(ts, file, text); tools.frontendDependencyCache.set(file, { hash, data }); parsedFiles++; }
    nodes.push(file);
    for (const issue of data.issues) issues.push({ file, reason: issue });
    for (const ref of data.refs) {
      const result = resolve(ref, file);
      if (result.to && edges.length < 3000) edges.push({ from: file, to: result.to, kind: ref.kind, line: ref.line });
      else if (result.to) edgeLimit = true;
      if (result.unresolved) unresolved.push({ file, specifier: ref.specifier, line: ref.line });
    }
  }
  const scanned = new Set(nodes);
  for (const file of tools.frontendDependencyCache.keys()) if (!scanned.has(file)) tools.frontendDependencyCache.delete(file);
  return { edges, nodes, skipped, unresolved, issues, configNote, cacheHits, parsedFiles, availableFiles: all.length,
    partial: listed.length >= 3000 || !scanned.has(target) || all.length > candidates.length || skipped.length > 0 || edgeLimit || configPartial || unresolved.length > 0 || issues.length > 0 };
}

export async function dependencyImpact(tools, target, signal, tokens = 2400) {
  if (!Number.isInteger(tokens) || tokens < 800 || tokens > 4000) throw new Error('영향 분석 예산은 800–4000 토큰입니다.');
  target = slash(path.relative(tools.root, await tools.resolve(target)));
  if (!supported(target)) throw new Error('JS/TS, Vue, Svelte, CSS/SCSS/Sass/Less 또는 HTML 파일을 지정하세요.');
  const graph = await frontendDependencies(tools, target, signal);
  const reverse = new Map();
  for (const edge of graph.edges) { if (!reverse.has(edge.to)) reverse.set(edge.to, []); reverse.get(edge.to).push(edge); }
  const paths = new Map([[target, []]]), queue = [target];
  while (queue.length) for (const edge of reverse.get(queue.shift()) || []) {
    if (paths.has(edge.from)) continue;
    paths.set(edge.from, [edge, ...paths.get(edge.to)]); queue.push(edge.from);
  }
  paths.delete(target);
  const affected = [...paths.keys()];
  const test = file => /\.(test|spec)\.|(?:^|\/)__tests__\//.test(file);
  const page = file => /(?:^|\/)(?:pages|routes|views)\/|(?:^|\/)(?:\+page|page|.*Page|.*\.component)\./.test(file) && !test(file);
  // Tests first, then likely pages, then shortest dependency paths. No source bodies are included.
  affected.sort((a, b) => Number(test(b)) - Number(test(a)) || Number(page(b)) - Number(page(a)) || paths.get(a).length - paths.get(b).length || a.localeCompare(b));
  const report = { target, affectedFiles: [], testCandidates: [], pageCandidates: [], evidence: [], totalAffected: affected.length,
    scannedFiles: graph.nodes.length, availableFiles: graph.availableFiles, cache: { hits: graph.cacheHits, parsed: graph.parsedFiles },
    partial: graph.partial, omittedAffected: affected.length, skipped: graph.skipped.slice(0, 5), unresolved: graph.unresolved.slice(0, 5), issues: graph.issues.slice(0, 5), configNote: graph.configNote,
    limitations: 'Static candidates, not complete coverage or LSP diagnostics. Max 300 files/2 MiB/3000 edges. JS/TS imports, Vue/Svelte script imports, quoted CSS imports and Angular Component resources. No template semantics, framework auto-imports, runtime routes or bundler aliases. Cache reuses parsed references after checking current content; it does not cache model answers. Read exact source before editing.' };
  for (const file of affected.slice(0, 80)) {
    const chain = paths.get(file);
    const evidence = { file, chain: chain.slice(0, 8), ...(chain.length > 8 ? { omittedEdges: chain.length - 8 } : {}) };
    const next = { ...report, affectedFiles: [...report.affectedFiles, file], testCandidates: test(file) ? [...report.testCandidates, file] : report.testCandidates,
      pageCandidates: page(file) ? [...report.pageCandidates, file] : report.pageCandidates, evidence: [...report.evidence, evidence], omittedAffected: report.omittedAffected - 1 };
    if (estimateTokens(JSON.stringify(next, null, 2)) > tokens) continue;
    Object.assign(report, next);
  }
  // Long file names or diagnostics must not defeat the caller's output budget.
  while (estimateTokens(JSON.stringify(report, null, 2)) > tokens) {
    if (report.unresolved.length) report.unresolved.pop();
    else if (report.issues.length) report.issues.pop();
    else if (report.skipped.length) report.skipped.pop();
    else throw new Error('영향 분석 메타데이터가 예산을 초과합니다. 더 큰 tokens 값을 지정하세요.');
  }
  return JSON.stringify(report, null, 2);
}

export function impactText(report) {
  const tests = new Set(report.testCandidates), pages = new Set(report.pageCandidates);
  return [`변경 영향 · ${report.target}`, `참조 파일 ${report.totalAffected}개 · 표시 ${report.affectedFiles.length}개 · 출력 생략 ${report.omittedAffected}개`,
    `분석 ${report.scannedFiles}/${report.availableFiles}개 · 파싱 재사용 ${report.cache.hits}개 · 새 파싱 ${report.cache.parsed}개`,
    report.partial ? '분석 범위가 불완전합니다. 미해결 경로·생략 파일·설정을 확인하세요.' : '지정된 정적 분석 범위 내 결과입니다. 전체 화면 검증을 뜻하지 않습니다.', '',
    ...report.evidence.flatMap(item => [`${tests.has(item.file) ? '테스트' : pages.has(item.file) ? '화면 후보' : '참조'} · ${item.file}`,
      '  ' + item.chain.map(edge => `${edge.from}:${edge.line}`).join(' → ') + ' → ' + (item.omittedEdges ? `… (${item.omittedEdges}개 연결 생략)` : report.target)]),
    ...(!report.totalAffected ? ['참조 후보를 찾지 못했습니다. 자동 import·동적 라우트·템플릿 사용 여부도 직접 확인하세요.'] : []),
    ...report.unresolved.map(item => `미해결 · ${item.file}:${item.line} → ${item.specifier}`),
    ...report.issues.map(item => `확인 필요 · ${item.file}: ${item.reason}`),
    ...(report.skipped.length ? ['스캔 생략 · ' + report.skipped.join(', ')] : []),
    '', '후보 원본을 읽고 필요한 테스트를 실행하세요. API 호출 없이 분석하며 파싱 캐시 적중은 모델 토큰 절감량이 아닙니다.'].join('\n');
}
