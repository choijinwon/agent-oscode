import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { getCredential, setCredential } from '../src/credentials.js';
import { configureAuth } from '../src/auth-cli.js';
import { createProvider } from '../src/providers.js';

test('secret store isolates endpoints, restricts permissions, removes keys and rejects symlinks',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'oscode-secret-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'secrets','credentials.json');
 setCredential('compatible','https://example.com/v1','test-secret',file);
 assert.equal(getCredential('compatible','https://example.com/v1/',file),'test-secret');
 assert.equal(getCredential('compatible','https://other.example/v1',file),undefined);
 if(process.platform!=='win32')assert.equal((await fs.stat(file)).mode&0o777,0o600);
 setCredential('compatible','https://example.com/v1',null,file);
 assert.equal(getCredential('compatible','https://example.com/v1',file),undefined);
 await fs.unlink(file);await fs.symlink(path.join(dir,'outside'),file);
 assert.throws(()=>setCredential('anthropic',undefined,'test-secret',file),/safely/);
});
test('auth stdin never echoes key, status is redacted, provider loads saved key and env overrides it',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'oscode-auth-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));t.mock.method(os,'homedir',()=>dir);
 const old=process.env.ANTHROPIC_API_KEY;t.after(()=>{if(old===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=old;});delete process.env.ANTHROPIC_API_KEY;
 let output='';const out=new Writable({write(c,_e,cb){output+=c;cb();}});
 await configureAuth('set',{'key-stdin':true},{input:Readable.from(['fake-test-key\n']),output:out});
 await configureAuth('status',{}, {output:out});assert(!output.includes('fake-test-key'));
 const headers=[];
 const fakeFetch=async(_url,init)=>{headers.push(init.headers);return new Response(JSON.stringify({content:[{type:'text',text:'ok'}],usage:{input_tokens:1,output_tokens:1},stop_reason:'end_turn'}),{headers:{'content-type':'application/json'}});};
 const req={model:'mock',system:'test',messages:[{role:'user',content:'hi'}],tools:[],maxOutput:100};
 await createProvider({provider:'anthropic'},fakeFetch).complete(req,new AbortController().signal,()=>{});
 assert.equal(headers[0]['x-api-key'],'fake-test-key');
 process.env.ANTHROPIC_API_KEY='env-test-key';
 await createProvider({provider:'anthropic'},fakeFetch).complete(req,new AbortController().signal,()=>{});
 assert.equal(headers[1]['x-api-key'],'env-test-key');
 await configureAuth('remove',{}, {output:out});assert.equal(getCredential('anthropic'),undefined);
});
