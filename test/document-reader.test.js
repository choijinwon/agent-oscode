import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {DocumentReader,runDocument} from '../src/document-reader.js';
import {WorkspaceTools} from '../src/tools.js';
import {SelectedContext} from '../src/selected-context.js';
import {planReadTools} from '../src/plans.js';
async function fixture(t) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'oscode-doc-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.writeFile(path.join(root,'sample.pdf'),'%PDF fixture');await fs.writeFile(path.join(root,'image.png'),'image fixture');
 const tools=new WorkspaceTools(root,{readOnly:true});return {root,tools};
}
test('mixed PDF extracts text page and OCRs only scanned page; caches content and refreshes edited file',async t=>{
 const {root,tools}=await fixture(t);const calls=[];let temp;
 tools.documents=new DocumentReader({run:async(cmd,args)=>{
  calls.push(cmd);if(cmd==='pdfinfo'){temp=path.dirname(args[0]);return 'Pages: 2\n';}
  if(cmd==='pdftotext')return args[1]==='1' ? 'Native text' : '';
  if(cmd==='tesseract')return args[0]==='--list-langs' ? 'kor\neng\n' : '스캔 문서';
  return '';
 }});
 const first=await tools.execute('read_document',{path:'sample.pdf'});assert.equal(first.is_error,false);assert.match(first.content,/Native text/);assert.match(first.content,/스캔 문서/);assert.equal(calls.filter(c=>c==='pdftoppm').length,1);await assert.rejects(fs.stat(temp));
 const count=calls.length;await tools.execute('read_document',{path:'sample.pdf'});assert.equal(calls.length,count);
 await fs.appendFile(path.join(root,'sample.pdf'),'changed');await tools.execute('read_document',{path:'sample.pdf'});assert(calls.length>count);assert(planReadTools.has('read_document'));
});
test('image attachments are bounded untrusted text and never require model access to image bytes',async t=>{
 const {tools}=await fixture(t);tools.documents=new DocumentReader({run:async(cmd,args)=>args[0]==='--list-langs' ? 'kor\neng' : '인식 문자 '.repeat(4000)});
 const context=new SelectedContext(tools);await context.add('image.png');const result=await context.prepare('설명해줘 @image.png');
 assert.equal(result.files.length,1);assert.match(result.prompt,/untrusted/);assert.match(result.prompt,/인식 문자/);assert(result.prompt.length<2400);
});
test('missing languages, invalid bounds, cancellation and outside paths fail before extraction',async t=>{
 const {root,tools}=await fixture(t);tools.documents=new DocumentReader({run:async()=> 'eng'});
 for(const input of [{path:'image.png'},{path:'sample.pdf',pages:6},{path:'sample.pdf',start:0},{path:'image.png',language:'../../etc'},{path:'../outside.png'}])assert.equal((await tools.execute('read_document',input)).is_error,true);
 await fs.symlink('/etc/passwd',path.join(root,'escape.png'));assert.equal((await tools.execute('read_document',{path:'escape.png'})).is_error,true);
 const controller=new AbortController();controller.abort();await assert.rejects(tools.documents.read(tools,{path:'image.png'},controller.signal),/Cancelled/);
});
test('document subprocess separates diagnostics and bounds execution/output',async()=>{
 assert.equal(await runDocument(process.execPath,['-e','process.stderr.write("diagnostic");process.stdout.write("한글")']),'한글');
 await assert.rejects(runDocument(process.execPath,['-e','process.stdout.write("x".repeat(1000))'],{maxBytes:10}),/추출량/);
 await assert.rejects(runDocument(process.execPath,['-e','setInterval(()=>{},1000)'],{timeout:50}),/시간 초과/);
 await assert.rejects(runDocument('oscode-nonexistent-extractor',[]),/설치/);
});
