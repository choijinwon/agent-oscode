import test from 'node:test';import assert from 'node:assert/strict';
import {previewUrl,openWebPreview} from '../src/web-preview.js';
test('web preview opens exact local URL without shell interpolation',async()=>{
 let opened;const url='http://localhost:5173/design?theme=dark#card';
 assert.equal(await openWebPreview(url,{open:async value=>{opened=value;}}),url);assert.equal(opened,url);
 assert.equal(previewUrl('http://[::1]:3000'),'http://[::1]:3000/');
});
test('preview rejects executable remote and credential URLs and reports opener failure',async()=>{
 for(const url of ['file:///etc/passwd','javascript:alert(1)','https://example.com','http://localhost.example.com','http://user:pass@localhost:3000','localhost:3000'])assert.throws(()=>previewUrl(url));
 await assert.rejects(openWebPreview('http://127.0.0.1:3000',{open:async()=>{throw new Error('unavailable');}}),/unavailable/);
});

test('auto preview opens only a ready local server once and retries unavailable servers',async()=>{
 const {AutoWebPreview}=await import('../src/web-preview.js');let ready=false,opens=0,checks=0,cancels=0;
 const preview=new AutoWebPreview({open:async()=>{opens++;},fetchImpl:async()=>{checks++;return {status:ready?200:503,body:{cancel:async()=>{cancels++;}}};}});
 assert.equal(await preview.show('http://localhost:3000'),false);ready=true;
 await Promise.all([preview.show('http://localhost:3000'),preview.show('http://localhost:3000')]);
 assert.equal(opens,1);assert.equal(checks,2);assert.equal(cancels,2);
 await preview.show('http://localhost:3000');await preview.show('https://example.com');assert.equal(checks,2);
 preview.close();await preview.show('http://localhost:4000');assert.equal(checks,2);
});
