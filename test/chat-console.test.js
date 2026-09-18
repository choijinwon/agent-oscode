import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { createChatConsole, completeCommand } from '../src/chat-console.js';

test('single chat reader hides secrets, disables history and returns to normal input',async()=>{
 const input=new PassThrough(); input.isTTY=true; input.setRawMode=()=>{};
 let visible='';const output=new Writable({write(c,_e,cb){visible+=c;cb();}});output.isTTY=true;output.columns=80;
 const rl=createChatConsole(input,output);
 try {
  const secret=rl.questionHidden('Key: '); input.write('fake-secret-123\r');
  assert.equal(await secret,'fake-secret-123');assert(!visible.includes('fake-secret-123'));assert.equal(rl.history.length,0);
  const normal=rl.question('나 › ');input.write('hello\r');assert.equal(await normal,'hello');assert(visible.includes('hello'));
 }finally{rl.close();}
});
test('cancelled hidden input restores normal display',async()=>{
 const input=new PassThrough();input.isTTY=true;input.setRawMode=()=>{};let visible='';
 const output=new Writable({write(c,_e,cb){visible+=c;cb();}});output.columns=80;
 const rl=createChatConsole(input,output);const controller=new AbortController();
 try{
  const secret=rl.questionHidden('Key: ',{signal:controller.signal}); input.write('partial-secret');controller.abort();
  await assert.rejects(secret,/abort/i);assert(!visible.includes('partial-secret'));
  const normal=rl.question('나 › ');input.write('hi\r');assert.equal(await normal,'hi');assert(visible.includes('hi'));
 }finally{rl.close();}
});

test('slash completion is restricted to commands and leaves natural language alone',()=>{
 assert.deepEqual(completeCommand('/set'),[['/settings'],'/set']);
 assert.deepEqual(completeCommand('로그인 페이지'),[[],'로그인 페이지']);
 assert.deepEqual(completeCommand('/unknown'),[[],'/unknown']);
});

test('long Korean input reflows on terminal resize while preserving content and cursor', async()=>{
 const input=new PassThrough();input.isTTY=true;input.setRawMode=()=>{};
 let visible='';const output=new Writable({write(c,_e,cb){visible+=c;cb();}});
 output.isTTY=true;output.columns=60;output.rows=12;
 const baseline=output.listenerCount('resize');const rl=createChatConsole(input,output);
 try{
  const answer=rl.question('  ╰─ › ');
  const text='긴 입력과 한글 '.repeat(25);input.write(text);
  const original=rl.line,cursor=rl.cursor,before=rl.getCursorPos();
  visible='';output.columns=24;output.emit('resize');
  assert.equal(rl.line,original);assert.equal(rl.cursor,cursor);
  assert(rl.getCursorPos().rows>before.rows);assert(visible.length>0);
  input.write('\x1b[D');const moved=rl.cursor;output.columns=100;output.emit('resize');assert.equal(rl.cursor,moved);
  input.write('\r');assert.equal(await answer,text);
  visible='';output.emit('resize');assert.equal(visible,'');
 }finally{rl.close();}
 assert.equal(output.listenerCount('resize'),baseline);
});

test('resizing a hidden key prompt does not expose partial secrets',async()=>{
 const input=new PassThrough();input.isTTY=true;input.setRawMode=()=>{};let visible='';
 const output=new Writable({write(c,_e,cb){visible+=c;cb();}});output.columns=60;output.isTTY=true;
 const rl=createChatConsole(input,output);
 try{
  const result=rl.questionHidden('Key: ');input.write('fake-hidden-secret');
  visible='';output.columns=20;output.emit('resize');assert.equal(visible,'');
  input.write('\r');assert.equal(await result,'fake-hidden-secret');assert(!visible.includes('secret'));
 }finally{rl.close();}
});
