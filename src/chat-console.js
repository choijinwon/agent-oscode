import readline from 'node:readline/promises';
import { Writable } from 'node:stream';

// One input reader for chat and hidden settings, so secrets never reach a
// second readline listener or its history.
export function createChatConsole(input = process.stdin, output = process.stdout) {
  let hidden = false;
  const display = new Writable({ write(chunk, encoding, done) {
    if (!hidden) output.write(chunk, encoding);
    done();
  } });
  Object.defineProperty(display, 'columns', { get: () => output.columns });
  display.isTTY = Boolean(output.isTTY);
  const rl = readline.createInterface({ input, output: display, terminal: true, historySize: 0 });
  rl.questionHidden = async (prompt, options) => {
    output.write(prompt);
    hidden = true;
    try { return await rl.question('', options); }
    finally { hidden = false; output.write('\n'); }
  };
  return rl;
}
