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
