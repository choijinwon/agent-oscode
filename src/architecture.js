import path from 'node:path';

export async function inspectArchitecture(tools, directory = '.', signal) {
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
  return JSON.stringify({ scope: directory, scannedFiles: nodes.length, eligibleFiles: files.length, groups,
    clientBoundaries: nodes.filter(n => n.boundary !== 'unspecified').slice(0, 10), relativeImportCycles: cycles, sharedToFeatureCandidates: crossings,
    guidance: ['Preserve established architecture; do not force a new folder convention.', 'For a new small app: routes compose screens; features own domain behavior; shared UI receives data and callbacks; data modules handle external I/O.', 'Place library wrappers beside existing shared UI and reuse theme/provider boundaries. Keep business data fetching out of generic UI.', 'Plan migrations incrementally, with target files, imports, tests and rollback scope; avoid moving the entire repository.'],
    limitations: 'Heuristic source scan: first 60 files, 24k characters/file, 40 imports/file, 300 edges. Relative imports only; aliases, re-exports, comments, type-only imports and framework semantics may produce omissions or false positives. Candidates require source verification; not a complete dependency graph.' }, null, 2);
}
