import test from 'node:test';
import assert from 'node:assert/strict';
import { accessClipboard, clipboardCommands, lastAnswer, PasteDraft, runClipboard } from '../src/clipboard.js';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

test('paste preserves multiline unicode and command-looking text without executing it',()=>{
 const draft=new PasteDraft();const text='  const 이름 = "안녕";\n\n/exit\n  /send\n';
 assert.equal(draft.load(text),text);assert.equal(draft.take(),text);
 assert.throws(()=>draft.take(),/No pasted/);assert.throws(()=>draft.load('x'.repeat(1048577)),/1 MiB/);
 draft.load('hello');draft.clear();assert.equal(draft.text,'');
});
test('copy selects latest completed response and extracts code preserving indentation',()=>{
 const session={archive:[{status:'done',messages:[{role:'assistant',content:'old'}]}],turns:[{status:'done',messages:[{role:'assistant',content:'Answer\n```vue\n  <Button />\n```\n\n```js\nconst a = 1;\n```'}]},{status:'stopped',messages:[{role:'assistant',content:'partial'}]}]};
 assert(lastAnswer(session).startsWith('Answer'));assert.equal(lastAnswer(session,true),'  <Button />\n\nconst a = 1;');
 assert.throws(()=>lastAnswer({turns:[]}),/No completed/);
 assert.throws(()=>lastAnswer({turns:[],archive:session.archive},true),/no fenced/);
});
test('clipboard uses native programs with stdin and fallback only for missing commands',async()=>{
 assert.equal(clipboardCommands('darwin')[0].write[0],'pbcopy');
 assert.equal(clipboardCommands('win32')[0].read[0],'powershell.exe');
 let calls=[];
 await accessClipboard('write','$(touch bad)\n한국어',{platform:'linux',env:{WAYLAND_DISPLAY:'1',DISPLAY:':0'},run:async(command,input)=>{calls.push({command,input});if(calls.length===1)throw Object.assign(Error('missing'),{code:'ENOENT'});}});
 assert.equal(calls[1].command[0],'xclip');assert.equal(calls[1].input,'$(touch bad)\n한국어');
 await assert.rejects(accessClipboard('read','',{platform:'linux',env:{}}),/No clipboard/);
});
test('native process runner transfers UTF-8 without shell interpolation and rejects oversized output',async()=>{
 let options;
 const mock=(output)=> (_cmd,_args,opts)=>{
  options=opts;const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();
  child.kill=()=>child.emit('close',1);
  queueMicrotask(()=>{child.stdout.write(Buffer.from(output));child.emit('close',0);});return child;
 };
 assert.equal(await runClipboard(['pbpaste'],undefined,{spawnProcess:mock('한글\n')}),'한글\n');assert.equal(options.shell,false);
 await assert.rejects(runClipboard(['pbpaste'],undefined,{spawnProcess:mock('oversized'),maxBytes:2}),/exceeds/);
});
