const extensions=/\.(tsx|jsx|vue|svelte|ts|js|html|css|scss)$/;
export async function findReusable(tools,query='',signal){
 if(typeof query!=='string'||query.length>300)throw Error('검색어는 300자 이내로 입력하세요.');
 const terms=query.toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter(w=>w.length>1).slice(0,12);
 const all=(await tools.files('.',signal)).filter(f=>extensions.test(f));
 const ranked=all.map(file=>({file,rank:terms.reduce((s,w)=>s+(file.toLowerCase().includes(w)?4:0),0)+(/component|shared\/ui|ui\//i.test(file)?1:0)})).sort((a,b)=>b.rank-a.rank||a.file.localeCompare(b.file));
 const candidates=[];let scanned=0,skipped=0;
 for(const {file,rank} of ranked.slice(0,200)){
  signal?.throwIfAborted();let text;try{text=(await tools.text(await tools.resolve(file))).slice(0,24000);}catch{skipped++;continue;}scanned++;
  const framework=file.endsWith('.vue')?'vue':file.endsWith('.svelte')?'svelte':/@Component\s*\(/.test(text)?'angular':/\.[jt]sx$/.test(file)?'react':'shared';
  const score=rank+terms.reduce((n,w)=>n+(text.toLowerCase().includes(w)?1:0),0);
  if(!score)continue;
  const exported=[...text.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let)\s+(\w+)/g)].map(m=>m[1]).slice(0,8);
  const api=text.split('\n').flatMap((line,i)=>/\b(?:interface .*Props|type .*Props|defineProps|defineEmits|export let|\$props|@Input|@Output|input\(|output\()/.test(line)?[{line:i+1,text:line.trim().slice(0,180)}]:[]).slice(0,6);
  const imports=[...text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)].map(m=>m[1]).slice(0,8);
  candidates.push({file,framework,score,exports:exported,api,imports});
 }
 return {query,candidates:candidates.sort((a,b)=>b.score-a.score||a.file.localeCompare(b.file)).slice(0,8),scanned,partial:all.length>200||skipped>0,
  guidance:'Reuse candidates, not verified compatibility. Read exact source and nearby stories/tests before editing. Preserve providers, tokens and public props. No package installation or source execution.',
  next:candidates.length?'Inspect candidate imports and usages with search/read_file.':'No matches. Try the component name or a term used in the project.'};
}
export async function locateElementSource(tools,element,signal){
 const identifiers=[element.testId,element.id,...(element.classes||[])].filter(v=>typeof v==='string'&&v.length>=3&&v.length<=100).slice(0,10);
 const source=(await tools.files('.',signal)).filter(f=>extensions.test(f));const matches=[];let scanned=0;
 for(const file of source.slice(0,250)){
  signal?.throwIfAborted();let text;try{text=(await tools.text(await tools.resolve(file))).slice(0,32000);}catch{continue;}scanned++;
  let count=0;for(const [i,line]of text.split('\n').entries()){
   const hits=identifiers.filter(v=>line.includes(v));
   if(hits.length&&count++<2)matches.push({file,line:i+1,matched:hits,score:hits.reduce((n,v)=>n+(v===element.testId?8:v===element.id?5:1),0),excerpt:line.trim().slice(0,200)});
  }
 }
 return {candidates:matches.sort((a,b)=>b.score-a.score).slice(0,8),scanned,partial:source.length>250,note:'Literal identifier matches only, not a source-map or component-owner proof. Read source before editing; do not infer ownership from utility classes.'};
}
