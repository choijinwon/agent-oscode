import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'website/dist');
const output = path.join(root, 'site-dist');
const origin = new URL(process.env.URL || 'https://agent-oscode.netlify.app').origin;
if (!origin.startsWith('https://')) throw new Error('Website URL must use HTTPS');
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const preview = process.env.CONTEXT && process.env.CONTEXT !== 'production';
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'docs.html', 'robots.txt', 'sitemap.xml']) {
  let content = (await readFile(path.join(source, file), 'utf8'))
    .replaceAll('https://oscode-terminal.abyys9114.chatgpt.site', origin)
    .replaceAll('https://agent-oscode.netlify.app', origin)
    .replace(/"softwareVersion":"[^"]+"/, `"softwareVersion":"${version}"`);
  if (preview && file.endsWith('.html')) content = content.replace('index,follow,max-snippet:-1', 'noindex,nofollow');
  if (preview && file === 'robots.txt') content = 'User-agent: *\nDisallow: /\n';
  await writeFile(path.join(output, file), content);
}
for (const file of ['style.css', 'app.js', 'design-studio.png', 'design-mobile.png', 'design-admin.png', 'design-interactions.png', 'design-erp.png']) await copyFile(path.join(source, file), path.join(output, file));
console.log(`Built website ${version} for ${origin}${preview ? ' (noindex preview)' : ''}`);
