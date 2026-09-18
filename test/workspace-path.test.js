import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {workspacePath} from '../src/workspace-path.js';
test('workspace paths support spaces relative paths and home; reject files and missing folders',async t=>{
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-dir-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.mkdir(path.join(root,'my app'));await fs.writeFile(path.join(root,'file.txt'),'x');
 assert.equal(await workspacePath('my app',root),path.join(root,'my app'));assert.equal(await workspacePath('"my app"',root),path.join(root,'my app'));
 assert.equal(await workspacePath('~'),await fs.realpath(os.homedir()));await assert.rejects(workspacePath('file.txt',root),/폴더/);await assert.rejects(workspacePath('missing',root),/찾을 수/);await assert.rejects(workspacePath('"bad',root),/따옴표/);
});
