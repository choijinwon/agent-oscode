import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {clip} from './context.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function selectExcerpt(body,prompt,limit=2000){
 if(body.length<=limit)return body;
 const terms=[...new Set(prompt.match(/[\p{L}_][\p{L}\p{N}_-]{2,}/gu)||[])].slice(0,24);
 const lines=body.split('\n');
 const matches=lines.map((line,index)=>({index,score:terms.filter(term=>line.toLowerCase().includes(term.toLowerCase())).length})).filter(item=>item.score).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,3);
 if(!matches.length)return clip(body,limit);
 const indices=new Set();for(let i=0;i<Math.min(5,lines.length);i++)indices.add(i);
 for(const {index} of matches)for(let i=Math.max(0,index-3);i<=Math.min(lines.length-1,index+5);i++)indices.add(i);
 return clip('[Task-matched excerpts, not a complete file. Line numbers refer to this snapshot; read exact source before editing.]\n'+[...indices].sort((a,b)=>a-b).map(i=>`${i+1}: ${lines[i]}`).join('\n'),limit);
}
export class ExcerptCache {
 constructor(root){this.root=root;}
 async directory(){
  if(!this.root)return null;
  let dir=await fs.realpath(this.root);
  for(const part of ['.oscode','cache','context']){
   dir=path.join(dir,part);await fs.mkdir(dir,{recursive:true});const stat=await fs.lstat(dir);
   if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Cache directory must not be a symlink.');
  }return dir;
 }
 async get(file,body,prompt){
  const fingerprint=hash(JSON.stringify([1,body,prompt]));let dir;
  try{
   dir=await this.directory();if(dir){const target=path.join(dir,hash(file)+'.json');const stat=await fs.lstat(target);
    if(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<20000){const cached=JSON.parse(await fs.readFile(target,'utf8'));if(cached.fingerprint===fingerprint&&typeof cached.excerpt==='string'&&cached.excerpt.length<=2000)return {body:cached.excerpt,cacheHit:true};}
   }
  }catch{/* Cache failure never blocks reading current source. */}
  const excerpt=selectExcerpt(body,prompt);
  if(dir){const temp=path.join(dir,`.${randomUUID()}.tmp`);try{await fs.writeFile(temp,JSON.stringify({fingerprint,excerpt}),{flag:'wx',mode:0o600});await fs.rename(temp,path.join(dir,hash(file)+'.json'));}catch{}finally{await fs.rm(temp,{force:true}).catch(()=>{});}}
  return {body:excerpt,cacheHit:false};
 }
}
