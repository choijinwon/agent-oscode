import test from 'node:test';
import assert from 'node:assert/strict';
import {ApprovalMode} from '../src/approval-mode.js';
import {WorkspaceTools} from '../src/tools.js';
test('approval modes distinguish file edits from shell commands and reject unknown operations',()=>{
 const mode=new ApprovalMode();assert(!mode.allows('write'));assert(!mode.allows('shell'));
 mode.set('delegate');assert(mode.allows('write'));assert(!mode.allows('shell'));
 mode.set('auto');assert(mode.allows('write'));assert(mode.allows('shell'));assert(!mode.allows('other'));
 mode.set('ask');assert(!mode.allows('write'));assert.throws(()=>mode.set('invalid'));assert(!mode.allows('shell'));
});
test('CLI flags are preserved, picker cancellation keeps state and agents are independent',async()=>{
 const mode=new ApprovalMode({'allow-shell':true});assert(!mode.allows('write'));assert(mode.allows('shell'));
 await mode.choose({choose:async()=> 'cancel'});assert(mode.allows('shell'));
 await mode.choose({choose:async()=> 'delegate'});assert(!mode.allows('shell'));assert(mode.allows('write'));
 assert(!new ApprovalMode().allows('write'));
});
test('auto approval cannot bypass plan mode or project deny rules',async()=>{
 const mode=new ApprovalMode();mode.set('auto');let approvals=0;
 for(const options of [{readOnly:true},{permissions:{write:'deny',shell:'deny'}}]){
  const tools=new WorkspaceTools(process.cwd(),{...options,approve:async kind=>{approvals++;return mode.allows(kind);}});
  for(const [name,input] of [['write_file',{path:'blocked.txt',content:'no'}],['shell',{command:'echo blocked'}]]){
   const result=await tools.execute(name,input);assert(result.is_error);
  }
 }assert.equal(approvals,0);
});
