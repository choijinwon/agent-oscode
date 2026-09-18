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
