import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';
import {CodexClient,bridgeConfig} from '../src/codex-client.js';
function fixture(t) {
 const child=new EventEmitter();child.stdout=new PassThrough();child.stdin=new PassThrough();child.stderr=new PassThrough();child.exitCode=null;
 child.kill=()=>{child.exitCode=0;child.emit('exit',0);};let sent='';child.stdin.on('data',chunk=>sent+=chunk);
 const client=new CodexClient(child);t.after(()=>client.close());return {child,client,sent:()=>sent};
}
test('RPC responses resolve by id and native tool requests are rejected',async t=>{
 const {client,child,sent}=fixture(t);const result=client.request('account/read');
 const request=JSON.parse(sent().trim());child.stdout.write(JSON.stringify({id:request.id,result:{account:null}})+'\n');assert.deepEqual(await result,{account:null});
 child.stdout.write(JSON.stringify({id:99,method:'item/commandExecution/requestApproval',params:{}})+'\n');
 assert(JSON.parse(sent().trim().split('\n').at(-1)).error);
 assert.equal(bridgeConfig['features.shell_tool'],false);assert.equal(bridgeConfig['features.apps'],false);assert.equal(bridgeConfig.default_permissions,'oscode-bridge');
});
test('RPC cancellation removes pending jobs; process exit rejects waiters',async t=>{
 const {client,child}=fixture(t);const controller=new AbortController();const result=client.request('slow',{},controller.signal);controller.abort();await assert.rejects(result,/취소/);assert.equal(client.pending.size,0);
 const waiting=client.wait('turn/completed');child.kill();await assert.rejects(waiting,/종료/);assert(client.closed);
});

test('RPC errors identify the rejected method and redact credentials',async t=>{
 const {client,child,sent}=fixture(t);const result=client.request('turn/start');
 const request=JSON.parse(sent().trim());
 child.stdout.write(JSON.stringify({id:request.id,error:{code:-32600,message:'Invalid permission: sk-secret Bearer private https://auth.openai.com/?code=secret'}})+'\n');
 await assert.rejects(result,error=>{
  assert.match(error.message,/turn\/start.*-32600.*Invalid permission/);
  assert(!error.message.includes('sk-secret'));assert(!error.message.includes('private'));assert(!error.message.includes('code=secret'));return true;
 });
});
