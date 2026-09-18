import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {taskReport,exportHandoff} from '../src/task-report.js';
const fixture=()=>({id:'session-id',archive:[{messages:[{role:'user',content:'이전 요구사항'}]}],turns:[{id:'turn-1',status:'stopped',error:'출력 한도',usage:{input:50,output:10,requests:1},messages:[{role:'user',content:'버튼 수정\n\n[Selected source excerpts: hidden file body'},{role:'assistant',tool_calls:[{id:'a',name:'shell',input:{command:'SENSITIVE_COMMAND'}},{id:'b',name:'write_file'},{id:'c',name:'read_file'}]},{role:'tool',tool_call_id:'a',content:'PRIVATE_OUTPUT',is_error:true},{role:'tool',tool_call_id:'b',content:'Created file'}]}],checkpoints:[{turnId:'turn-1',path:'Button.tsx',state:'applied'}]});
test('report distinguishes success, failure and missing results without exporting raw tool payloads',()=>{
 const session=fixture(),before=JSON.stringify(session),report=taskReport(session);
 for(const text of ['버튼 수정','Button.tsx','shell · 오류','write_file · 도구 성공','read_file · 결과 없음','출력 한도'])assert(report.includes(text));
 for(const text of ['hidden file body','SENSITIVE_COMMAND','PRIVATE_OUTPUT'])assert(!report.includes(text));
 assert.equal(JSON.stringify(session),before);assert(taskReport(session,{handoff:true}).includes('이전 요구사항'));
});
test('handoff saves unique private files and works with empty sessions',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'oscode-report-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const session={...fixture(),root},first=await exportHandoff(session),second=await exportHandoff(session);
 assert.notEqual(first.file,second.file);assert.equal(await fs.readFile(first.file,'utf8'),first.body);assert(first.estimatedTokens>0);
 assert.equal((await fs.stat(first.file)).mode&0o777,0o600);assert(taskReport({turns:[]}).includes('아직 실행한 작업'));
});
