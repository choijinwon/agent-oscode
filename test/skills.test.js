import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ProjectSkills} from '../src/skills.js';
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'oscode-skills-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.mkdir(path.join(root,'.oscode/skills/layout'),{recursive:true});
 await fs.writeFile(path.join(root,'.oscode/skills/layout/SKILL.md'),'---\nname: Layout\ndescription: Check responsive spacing\n---\nInspect small screens.');
 await fs.writeFile(path.join(root,'.oscode/skills/review.md'),'Review component boundaries.');
 return {root,skills:new ProjectSkills(root)};
}
test('skills discover supported layouts and only append explicitly selected content',async t=>{
 const {skills}=await fixture(t);const list=await skills.list();assert.equal(list.length,2);assert(list.every(s=>s.estimatedTokens>0));
 assert.equal(await skills.prepare('hello'),'hello');await skills.select('layout');
 const prepared=await skills.prepare('hello');assert(prepared.includes('Inspect small screens.'));assert(!prepared.includes('Review component boundaries.'));assert(prepared.includes('PLAN restrictions'));
 await skills.select('off');assert.equal(await skills.prepare('hello'),'hello');
});
test('skills reread edits, keep selection after invalid input and isolate agents',async t=>{
 const {root,skills}=await fixture(t);await skills.select('review');
 await assert.rejects(()=>skills.select('../layout'));assert.equal(skills.selected.id,'review');
 await fs.writeFile(path.join(root,'.oscode/skills/review.md'),'Updated guidance');assert((await skills.prepare('go')).includes('Updated guidance'));
 assert.equal(new ProjectSkills(root).selected,null);
 await fs.unlink(path.join(root,'.oscode/skills/review.md'));await assert.rejects(()=>skills.prepare('go'));
});
test('skills reject symlinks, oversized files, duplicate names and traversal',async t=>{
 const {root,skills}=await fixture(t);
 await fs.symlink(path.join(root,'.oscode/skills/review.md'),path.join(root,'.oscode/skills/link.md'));
 assert(!(await skills.list()).some(s=>s.id==='link'));
 await fs.writeFile(path.join(root,'.oscode/skills/large.md'),'x'.repeat(25000));await assert.rejects(()=>skills.select('large'),/24 KiB/);
 await fs.writeFile(path.join(root,'.oscode/skills/layout.md'),'duplicate');await assert.rejects(()=>skills.select('layout'),/중복/);
 await assert.rejects(()=>skills.read('../outside.md'));
 await fs.rename(path.join(root,'.oscode/skills'),path.join(root,'outside'));
 await fs.symlink(path.join(root,'outside'),path.join(root,'.oscode/skills'));await assert.rejects(()=>skills.list(),/실제 폴더/);
});
test('missing skills folder is an empty catalog',async t=>{
 const {root}=await fixture(t);await fs.rm(path.join(root,'.oscode'),{recursive:true});assert.deepEqual(await new ProjectSkills(root).list(),[]);
});
