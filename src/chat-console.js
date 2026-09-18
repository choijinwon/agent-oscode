import readline from 'node:readline/promises';
import { Writable } from 'node:stream';

export const chatCommands = ['/review', '/review show', '/summary', '/handoff', '/handoff copy', '/map', '/approval', '/style', '/skills', '/skills list', '/skills off', '/preview', '/workspace', '/cwd', '/cd ', '/ocr ', '/context', '/context add ', '/context remove ', '/context clear', '/context history off', '/context history on', '/diagnose', '/fix', '/settings', '/key', '/key status', '/key remove', '/frontend', '/files', '/paste', '/draft', '/send', '/clear', '/copy', '/copy code', '/plan', '/plan off', '/plan show', '/apply', '/status', '/verbose', '/help', '/usage', '/exit'];
export function completeCommand(line) {
  if (!line.startsWith('/')) return [[], line];
  return [chatCommands.filter(command => command.startsWith(line)), line];
}

// One input reader for chat and hidden settings, so secrets never reach a
// second readline listener or its history.
export function createChatConsole(input = process.stdin, output = process.stdout) {
  let hidden = false;
  let asking = false;
  const display = new Writable({ write(chunk, encoding, done) {
    if (!hidden) output.write(chunk, encoding);
    done();
  } });
  Object.defineProperty(display, 'columns', { get: () => output.columns || 80 });
  Object.defineProperty(display, 'rows', { get: () => output.rows || 24 });
  display.isTTY = Boolean(output.isTTY);
  const rl = readline.createInterface({ input, output: display, terminal: true, historySize: 0, completer: line => hidden ? [[], line] : completeCommand(line) });
  // readline listens to its output's resize event. Forward the real TTY event
  // through our secret-masking stream, preserving the editing cursor and wraps.
  const resize = () => { if (asking) display.emit('resize'); };
  output.on('resize', resize);
  const question = rl.question.bind(rl);
  rl.question = async (...args) => {
    asking = true;
    try { return await question(...args); }
    finally { asking = false; }
  };
  rl.once('close', () => output.off('resize', resize));
  rl.questionHidden = async (prompt, options) => {
    output.write(prompt);
    hidden = true;
    try { return await rl.question('', options); }
    finally { hidden = false; output.write('\n'); }
  };
  return rl;
}
