import path from 'node:path';

// Small oscode-authored starters using public library APIs, not copied library source.
const libraries = {
  mui: { package: '@mui/material', framework: 'react', packages: ['@mui/material', '@emotion/react', '@emotion/styled'], docs: 'https://mui.com/material-ui/', setup: 'Reuse the existing ThemeProvider and Emotion configuration. Check installed major version, React peers and framework SSR integration before installing. Keep client boundaries for interactive components.' },
  antd: { package: 'antd', framework: 'react', packages: ['antd'], docs: 'https://ant.design/components/overview/', setup: 'Reuse ConfigProvider and theme tokens. Check React peers and framework SSR integration for the installed major version. Do not add legacy antd.css imports to modern versions.' },
  bootstrap: { package: 'bootstrap', framework: 'html', packages: ['bootstrap'], docs: 'https://getbootstrap.com/docs/5.3/getting-started/introduction/', setup: 'These are Bootstrap 5 HTML fragments. Load bootstrap/dist/css/bootstrap.min.css once. Dropdown requires bootstrap/dist/js/bootstrap.bundle.min.js (includes Popper). In React adapt class/for to className/htmlFor and manage plugin lifecycle, or reuse an existing React wrapper. Do not inject global CSS without checking Tailwind/reset conflicts.' }
};
const recipes = {
  mui: {
    button: `import Button from '@mui/material/Button';\nexport default function ActionButton({ onClick, disabled = false, children = '저장' }) {\n  return <Button type="button" variant="contained" disabled={disabled} onClick={onClick}>{children}</Button>;\n}\n`,
    card: `import Card from '@mui/material/Card';\nimport CardContent from '@mui/material/CardContent';\nimport Typography from '@mui/material/Typography';\nexport default function InfoCard({ title = '프로젝트', children }) {\n  return <Card variant="outlined"><CardContent><Typography component="h2" variant="h6">{title}</Typography>{children}</CardContent></Card>;\n}\n`,
    alert: `import Alert from '@mui/material/Alert';\nexport default function StatusAlert({ severity = 'info', children = '변경 내용을 확인하세요.' }) {\n  return <Alert severity={severity}>{children}</Alert>;\n}\n`,
    pagination: `import Pagination from '@mui/material/Pagination';\nexport default function PageNavigation({ page = 1, count = 1, onChange }) {\n  return <Pagination page={page} count={count} onChange={(_, next) => onChange?.(next)} aria-label="페이지 이동" />;\n}\n`,
    dropdown: `import { useId, useState } from 'react';\nimport Button from '@mui/material/Button';\nimport Menu from '@mui/material/Menu';\nimport MenuItem from '@mui/material/MenuItem';\nexport default function ActionMenu({ onEdit }) {\n  const id = useId();\n  const [anchor, setAnchor] = useState(null);\n  return <><Button id={id} aria-haspopup="menu" aria-expanded={Boolean(anchor)} aria-controls={anchor ? id + '-menu' : undefined} onClick={event => setAnchor(event.currentTarget)}>작업</Button><Menu id={id + '-menu'} anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}><MenuItem onClick={() => { setAnchor(null); onEdit?.(); }}>편집</MenuItem></Menu></>;\n}\n`
  },
  antd: {
    button: `import { Button } from 'antd';\nexport default function ActionButton({ onClick, disabled = false, loading = false, children = '저장' }) {\n  return <Button htmlType="button" type="primary" disabled={disabled} loading={loading} onClick={onClick}>{children}</Button>;\n}\n`,
    card: `import { Card } from 'antd';\nexport default function InfoCard({ title = '프로젝트', children }) {\n  return <Card title={<h2 style={{ fontSize: 'inherit', margin: 0 }}>{title}</h2>}>{children}</Card>;\n}\n`,
    alert: `import { Alert } from 'antd';\nexport default function StatusAlert({ type = 'info', children = '변경 내용을 확인하세요.' }) {\n  return <Alert type={type} description={children} showIcon />;\n}\n`,
    pagination: `import { Pagination } from 'antd';\nexport default function PageNavigation({ page = 1, total = 0, pageSize = 10, onChange }) {\n  return <nav aria-label="페이지 이동"><Pagination current={page} total={total} pageSize={pageSize} showSizeChanger={false} onChange={onChange} /></nav>;\n}\n`,
    dropdown: `import { Button, Dropdown } from 'antd';\nexport default function ActionMenu({ onEdit }) {\n  const items = [{ key: 'edit', label: '편집' }];\n  return <Dropdown trigger={['click']} menu={{ items, onClick: ({ key }) => { if (key === 'edit') onEdit?.(); } }}><Button aria-haspopup="menu">작업</Button></Dropdown>;\n}\n`
  },
  bootstrap: {
    button: '<button type="button" class="btn btn-primary">저장</button>\n',
    card: '<article class="card"><div class="card-body"><h2 class="card-title h5">프로젝트</h2><p class="card-text">프로젝트 설명을 입력하세요.</p></div></article>\n',
    alert: '<div class="alert alert-info" role="status">변경 내용을 확인하세요.</div>\n',
    pagination: '<nav aria-label="페이지 이동"><ul class="pagination flex-wrap"><li class="page-item active"><span class="page-link" aria-current="page">1</span></li><li class="page-item"><a class="page-link" href="?page=2">2</a></li></ul></nav>\n',
    dropdown: '<div class="dropdown"><button class="btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">작업</button><ul class="dropdown-menu"><li><button class="dropdown-item" type="button">편집</button></li></ul></div>\n'
  }
};
export function componentRecipe(library, component) {
  if (!Object.hasOwn(libraries, library)) throw new Error('library must be mui, antd or bootstrap.');
  const info = libraries[library];
  if (!component) return { library, ...info, components: Object.keys(recipes[library]) };
  if (!Object.hasOwn(recipes[library], component)) throw new Error(`Unknown component. Choose: ${Object.keys(recipes[library]).join(', ')}.`);
  return { library, component, ...info, extension: info.framework === 'react' ? '.jsx' : '.html', code: recipes[library][component], source: 'oscode-authored starter (MIT); public library APIs. Inspect project version and adapt before use.', integration: 'Read existing components and reuse first. Wire callbacks/data, import at the target screen, preserve theme and verify with project checks. Adding this starter alone does not connect it to a page.' };
}
export async function inspectComponent(tools, { library, component, path: directory = '.' }, signal) {
  const recipe = componentRecipe(library, component);
  const root = await tools.resolve(directory);
  let pkg = {};
  try { pkg = JSON.parse(await tools.text(await tools.resolve(path.join(path.relative(tools.root, root), 'package.json')))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) throw new Error('package.json must be an object.');
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const files = await tools.files(directory, signal);
  const existing = files.filter(f => /\.(jsx|tsx|vue|svelte|html)$/.test(f) && (!component || path.basename(f).toLowerCase().includes(component))).slice(0, 12);
  return JSON.stringify({ ...recipe, declaredVersion: deps[recipe.package] ?? null, missingPackages: recipe.packages.filter(p => !Object.hasOwn(deps, p)), reactDeclared: Object.hasOwn(deps, 'react'), existingCandidates: existing,
    caution: recipe.framework === 'react' && !Object.hasOwn(deps, 'react') ? 'React not declared here: do not apply this React recipe to Vue/Svelte/static HTML. Inspect the correct app directory.' : 'Dependency declarations do not confirm installed API compatibility. No packages were installed.' }, null, 2);
}
