import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
for (const dir of ['bin', 'src', 'scripts', 'test']) {
  for (const name of await fs.readdir(dir)) if (name.endsWith('.js')) execFileSync(process.execPath, ['--check', `${dir}/${name}`], { stdio: 'inherit' });
}
console.log('JavaScript syntax checks passed.');
