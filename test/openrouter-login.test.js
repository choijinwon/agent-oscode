import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {loginOpenRouter} from '../src/openrouter-login.js';
test('PKCE login validates callback path, exchanges once and closes server',async()=>{
 let auth,callback,calls=0;
 const key=await loginOpenRouter({timeoutMs:5000,openBrowser:async url=>{
  auth=new URL(url);callback=auth.searchParams.get('callback_url');
  assert.equal((await fetch(new URL('/wrong?code=fake',callback))).status,404);
  const target=new URL(callback);target.searchParams.set('code','test-code');assert.equal((await fetch(target)).status,200);
 },fetchImpl:async(url,options)=>{
  calls++;assert.equal(url,'https://openrouter.ai/api/v1/auth/keys');assert.equal(options.redirect,'error');
  const body=JSON.parse(options.body);assert.equal(body.code,'test-code');assert.equal(body.code_challenge_method,'S256');
  assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'),auth.searchParams.get('code_challenge'));
  return Response.json({key:'fake-test-key'});
 }});
 assert.equal(key,'fake-test-key');assert.equal(calls,1);await assert.rejects(fetch(callback));
});
test('cancel and timeout close callback server without exchanging',async()=>{
 for(const cancel of [true,false]) {
  const controller=new AbortController();let callback;
  await assert.rejects(loginOpenRouter({signal:controller.signal,timeoutMs:50,openBrowser:async url=>{callback=new URL(url).searchParams.get('callback_url');if(cancel)controller.abort();},fetchImpl:()=>assert.fail('No exchange')}));
  if(callback)await assert.rejects(fetch(callback));
 }
});
test('authorization denial never exchanges code',async()=>{
 await assert.rejects(loginOpenRouter({timeoutMs:2000,openBrowser:async url=>{
  const callback=new URL(new URL(url).searchParams.get('callback_url'));callback.searchParams.set('error','access_denied');await fetch(callback);
 },fetchImpl:()=>assert.fail('No exchange')}),/거절/);
});
