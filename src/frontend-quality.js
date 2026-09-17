import path from 'node:path';

export async function inspectTokens(tools, directory = '.', signal) {
  const files = await tools.files(directory, signal), declarations = [], findings = [];
  const sources = files.filter(f => /\.(css|[jt]sx?|vue|svelte|html)$/.test(f)).slice(0, 100);
  let version = null;
  try {
    const dir = path.relative(tools.root, await tools.resolve(directory));
    const pkg = JSON.parse(await tools.text(await tools.resolve(path.join(dir, 'package.json'))));
    version = pkg.dependencies?.tailwindcss ?? pkg.devDependencies?.tailwindcss ?? null;
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const texts = [];
  for (const file of sources) {
    if (signal?.aborted) throw new Error('Cancelled.');
    let text; try { text = (await tools.text(await tools.resolve(file))).slice(0, 32000); } catch { continue; }
    texts.push({ file, text });
    if (file.endsWith('.css')) for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
      if (declarations.length < 80) declarations.push({ token: m[1], value: m[2].trim(), file, line: text.slice(0, m.index).split('\n').length });
    }
  }
  for (const { file, text } of texts) for (const [i, line] of text.split('\n').entries()) {
    for (const m of line.matchAll(/\b(bg|text|border|p|px|py|m|mx|my|gap|rounded)-\[([^\]\r\n]{1,100})\]/g)) {
      if (findings.length >= 40) break;
      const prefix = m[1], value = m[2];
      if (value.includes('var(') || value.startsWith('--')) continue;
      const category = ['bg', 'text', 'border'].includes(prefix) ? '--color-' : prefix === 'rounded' ? '--radius-' : '--spacing-';
      const matches = declarations.filter(d => d.token.startsWith(category) && d.value.toLowerCase() === value.toLowerCase());
      findings.push({ file, line: i + 1, utility: m[0], tokenCandidates: matches.slice(0, 3).map(d => d.token), reason: matches.length ? 'Exact declared value match; verify semantic purpose before replacing.' : 'Arbitrary value: may be intentional, review consistency.' });
    }
  }
  return JSON.stringify({ tailwindDeclared: version, themeStyle: texts.some(x => /@theme\b/.test(x.text)) ? 'CSS @theme detected' : 'No CSS @theme detected', declarations, findings,
    configFiles: files.filter(f => /(^|\/)tailwind\.config\.[cm]?[jt]s$/.test(f)).slice(0, 5),
    limitations: 'Static CSS and literal utility candidates only; first 100 files, 32k characters each. Does not execute Tailwind v3 JS config or resolve CSS cascade, variants, dynamic classes, plugins or token semantics. No automatic replacements.' }, null, 2);
}
async function parser() { try { return (await import('typescript')).default; } catch { throw new Error('Install optional typescript dependency for AST analysis.'); } }
export async function inspectImpact(tools, target, signal) {
  const ts = await parser();
  target = path.relative(tools.root, await tools.resolve(target));
  const all = (await tools.files('.', signal)).filter(f => /\.[cm]?[jt]sx?$/.test(f));
  const set = new Set(all), edges = [], skipped = [];
  let config = {}, configNote = 'No root tsconfig.json';
  try {
    const result = ts.parseConfigFileTextToJson('tsconfig.json', await tools.text(await tools.resolve('tsconfig.json')));
    if (result.error) throw new Error('Invalid tsconfig.json');
    config = result.config.compilerOptions || {};
    configNote = result.config.extends ? 'Root paths only; extends is not followed.' : 'Root tsconfig paths/baseUrl supported.';
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const resolve = (specifier, file) => {
    let bases = [];
    if (specifier.startsWith('.')) bases.push(path.join(path.dirname(file), specifier));
    else {
      for (const [alias, replacements] of Object.entries(config.paths || {})) {
        if (!Array.isArray(replacements)) continue;
        const parts = alias.split('*');
        if (parts.length > 2) continue;
        if (parts.length === 1 ? alias !== specifier : !specifier.startsWith(parts[0]) || !specifier.endsWith(parts[1])) continue;
        const match = parts.length === 2 ? specifier.slice(parts[0].length, parts[1].length ? -parts[1].length : undefined) : '';
        bases.push(...replacements.filter(v => typeof v === 'string').map(v => path.join(config.baseUrl || '.', v.replace('*', match))));
      }
      if (config.baseUrl) bases.push(path.join(config.baseUrl, specifier));
    }
    for (const base of bases) {
      const normalized = path.normalize(base), stem = normalized.replace(/\.[cm]?jsx?$/, '');
      const found = [normalized, ...['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '/index.ts', '/index.tsx', '/index.js'].flatMap(ext => [normalized + ext, stem + ext])].find(f => set.has(f));
      if (found) return found;
    }
  };
  for (const file of all.slice(0, 300)) {
    if (signal?.aborted) throw new Error('Cancelled.');
    let source; try { source = await tools.text(await tools.resolve(file)); } catch { skipped.push(file); continue; }
    if (source.length > 120000) { skipped.push(file); continue; }
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    if (ast.parseDiagnostics.length) { skipped.push(file); continue; }
    const visit = node => {
      let specifier;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && !node.isTypeOnly && !node.importClause?.isTypeOnly) specifier = node.moduleSpecifier;
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) specifier = node.arguments[0];
      if (specifier && ts.isStringLiteral(specifier)) { const to = resolve(specifier.text, file); if (to && edges.length < 3000) edges.push({ from: file, to }); }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  const affected = new Set([target]), queue = [target];
  while (queue.length) { const file = queue.shift(); for (const edge of edges) if (edge.to === file && !affected.has(edge.from)) { affected.add(edge.from); queue.push(edge.from); } }
  affected.delete(target);
  return JSON.stringify({ target, affectedFiles: [...affected].slice(0, 80), testCandidates: [...affected].filter(f => /\.(test|spec)\.|__tests__/.test(f)), totalAffected: affected.size, scannedFiles: Math.min(all.length, 300) - skipped.length,
    partial: all.length > 300 || skipped.length > 0 || edges.length >= 3000, skipped: skipped.slice(0, 10), configNote,
    limitations: 'AST-based reverse imports/re-exports and literal dynamic imports; max 300 files/3000 edges. Root tsconfig aliases only. Does not model CSS, Vue/Svelte templates, runtime resolution or implicit framework routes. Results are test selection candidates, not proof of complete coverage.' }, null, 2);
}
export async function storyRecipe(tools, { path: file, states: statesFile, role, name }, signal) {
  if (signal?.aborted) throw new Error('Cancelled.');
  const ts = await parser(), resolved = await tools.resolve(file), source = await tools.text(resolved);
  if (!/\.[jt]sx$/.test(file)) throw new Error('Story starter currently supports React .jsx/.tsx components.');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  if (ast.parseDiagnostics.length) throw new Error('Component syntax is unsupported by the bundled parser.');
  const hasDefault = ast.statements.some(n => ts.isExportAssignment(n) && !n.isExportEquals || n.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword));
  if (!hasDefault) throw new Error('Default export required for this starter. Named exports need a manually adapted story.');
  let states = { Default: {} };
  if (statesFile) states = JSON.parse(await tools.text(await tools.resolve(statesFile)));
  if (!states || Array.isArray(states) || typeof states !== 'object' || !Object.keys(states).length || Object.keys(states).length > 8) throw new Error('States must map 1–8 story names to args objects.');
  for (const [name, args] of Object.entries(states)) if (!/^[A-Z][A-Za-z0-9_]*$/.test(name) || !args || typeof args !== 'object' || Array.isArray(args) || JSON.stringify(args).length > 4000) throw new Error('Use capitalized story names with bounded JSON args objects.');
  const relative = path.relative(tools.root, resolved), basename = path.basename(relative);
  const output = relative.replace(/\.[jt]sx$/, '.stories.jsx');
  if (name && !role) throw new Error('Story accessible name requires role.');
  let testImport = '';
  if (role) {
    const pkg = JSON.parse(await tools.text(await tools.resolve('package.json')));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['@storybook/test']) testImport = '@storybook/test';
    else if (/^[~^]?(?:9|[1-9][0-9])\./.test(deps.storybook || '')) testImport = 'storybook/test';
    else throw new Error('Declare compatible storybook >=9 or @storybook/test before generating interaction assertions.');
  }
  const play = role ? `, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole(${JSON.stringify(role)}${name ? ', { name: ' + JSON.stringify(name) + ' }' : ''})).toBeVisible(); }` : '';
  const code = (testImport ? `import { expect, within } from ${JSON.stringify(testImport)};\n` : '') + `import Component from ${JSON.stringify('./' + basename)};\n\nexport default { title: ${JSON.stringify('Components/' + basename.replace(/\.[jt]sx$/, ''))}, component: Component };\n\n` + Object.entries(states).map(([name, args]) => `export const ${name} = { args: ${JSON.stringify(args, null, 2)}${play} };`).join('\n\n') + '\n';
  return JSON.stringify({ output, code, scope: 'React CSF render/state stories, colocated with the component. Args are provided by the user; no invented business states.', next: 'Verify required props and Storybook renderer/version. Wire callback spies and behavior assertions to the actual component API, then run existing Storybook tests. An optional role/name adds a visibility assertion; more complex behavior needs component-specific tests.' }, null, 2);
}
