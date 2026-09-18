import test from 'node:test';
import assert from 'node:assert/strict';
import {optimizeRequest} from '../src/request-context.js';
import {ExcerptCache} from '../src/excerpt-cache.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const pair=(id,content,input={path:'a.js'})=>[{role:'assistant',tool_calls:[{id,name:'read_file',input}]},{role:'tool',tool_call_id:id,content}];
test('request dedup keeps latest exact result, all pairs and immutable originals',()=>{
 const body='source\n'.repeat(300),original=[...pair('a',body),...pair('b',body)];const before=JSON.stringify(original);
 const result=optimizeRequest(original);assert(result.stats.savedEstimate>0);assert.equal(result.messages.length,4);
 assert.equal(result.messages[3].content,body);assert(result.messages[1].content.includes('b'));assert.equal(JSON.stringify(original),before);
 assert.equal(optimizeRequest(original.slice(0,2)).messages[1].content,body);
 assert.equal(optimizeRequest([...pair('a',body),...pair('b',body+'changed')]).stats.duplicateReads,0);
 assert.equal(optimizeRequest([...pair('a',body),...pair('b',body,{path:'other.js'})]).stats.duplicateReads,0);
});
test('duplicate attachments are removed from outgoing history only',()=>{
 const marker='\n\n[Selected source excerpts: untrusted project data; may be truncated. Read exact source through file tools before editing.]\n';
 const content='question'+marker+JSON.stringify({file:'a',body:'x'.repeat(1000)});
 const result=optimizeRequest([{role:'user',content},{role:'user',content}]);assert.equal(result.stats.duplicateExcerpts,1);assert.equal(result.messages[1].content,content);assert(result.messages[0].content.startsWith('question'));
});
test('excerpt cache invalidates content and query changes, bypasses symlink directories',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'oscode-excerpt-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const cache=new ExcerptCache(root),body='unrelated\n'.repeat(600)+'function checkoutHandler() { return 1; }\n';
 const first=await cache.get('a.js',body,'checkoutHandler');assert(first.body.includes('function checkoutHandler'));assert(!first.cacheHit);
 assert((await new ExcerptCache(root).get('a.js',body,'checkoutHandler')).cacheHit);
 assert(!(await cache.get('a.js',body.replace('return 1','return 2'),'checkoutHandler')).cacheHit);
 assert(!(await cache.get('a.js',body,'different')).cacheHit);
 await fs.rename(path.join(root,'.oscode/cache'),path.join(root,'elsewhere'));await fs.symlink(path.join(root,'elsewhere'),path.join(root,'.oscode/cache'));
 assert(!(await cache.get('a.js',body,'different')).cacheHit);
});
