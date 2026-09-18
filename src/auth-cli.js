import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import { getCredential, setCredential, defaultBase } from './credentials.js';

export async function configureAuth(action, args, { input = process.stdin, output = process.stdout } = {}) {
  const provider = args.provider || 'anthropic';
  const base = args['base-url'] || defaultBase(provider);
  if (!['set', 'status', 'remove'].includes(action)) throw new Error('Usage: oscode auth set|status|remove --provider anthropic|compatible [--base-url URL] [--key-stdin]');
  // Validate destination and existing store before asking for a secret.
  const current = getCredential(provider, base);
  if (action === 'status') { output.write(`${provider}: ${current ? '키 저장됨' : '저장된 키 없음'} (키 값은 표시하지 않습니다)\n`); return; }
  if (action === 'remove') { setCredential(provider, base, null); output.write('해당 공급자·주소의 저장된 키를 삭제했습니다. 환경 변수는 변경하지 않습니다.\n'); return; }
  let key = '';
  if (args['key-stdin']) {
    let bytes = 0;
    for await (const chunk of input) {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 8192) throw new Error('API key input exceeds 8192 bytes.');
      key += chunk.toString();
    }
    key = key.trim();
  } else {
    if (!input.isTTY) throw new Error('Use an interactive terminal, or --key-stdin to read the key from standard input.');
    output.write(`${provider} API 키 입력 (화면에 표시되지 않음): `);
    const silent = new Writable({ write(_chunk, _encoding, done) { done(); } });
    const rl = readline.createInterface({ input, output: silent, terminal: true, historySize: 0 });
    const abort = new AbortController();
    rl.on('SIGINT', () => abort.abort());
    try { key = (await rl.question('', { signal: abort.signal })).trim(); }
    finally { rl.close(); output.write('\n'); }
  }
  setCredential(provider, base, key);
  output.write('키를 사용자 전용 ~/.oscode/credentials.json에 저장했습니다. 프로젝트와 대화 기록에는 저장하지 않습니다.\n');
}
