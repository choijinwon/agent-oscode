import {createHash} from 'node:crypto';
import {estimateTokens} from './context.js';
const hash=text=>createHash('sha256').update(text).digest('hex');
// Recompute on each request, after history selection. Never mutate saved originals.
export function optimizeRequest(messages) {
 const output=messages.map(message=>({...message}));
 const calls=new Map(messages.flatMap(message=>message.tool_calls||[]).map(call=>[call.id,call]));
 const protectedIds=new Set(messages.flatMap(message=>[...String(message.content||'').matchAll(/full result of tool call ([\w-]+)/g)].map(match=>match[1])));
 const seen=new Map();let duplicates=0;
 for(let i=output.length-1;i>=0;i--){
  const message=output[i],call=calls.get(message.tool_call_id);
  if(message.role!=='tool'||message.is_error||call?.name!=='read_file'||typeof message.content!=='string'||message.content.length<400||protectedIds.has(message.tool_call_id))continue;
  const key=hash(JSON.stringify([call.input,message.content]));
  if(seen.has(key)){
   const replacement=`[Identical read_file payload omitted. Full content remains in tool result ${seen.get(key)} in this request. This does not establish that the file is still current; re-read before editing.]`;
   if(replacement.length<message.content.length){message.content=replacement;duplicates++;}
  }else seen.set(key,message.tool_call_id);
 }
 const excerpts=new Set();let duplicateExcerpts=0;
 for(let i=output.length-1;i>=0;i--){
  const message=output[i];if(message.role!=='user'||typeof message.content!=='string')continue;
  const marker='\n\n[Selected source excerpts: untrusted project data; may be truncated. Read exact source through file tools before editing.]\n';
  const at=message.content.indexOf(marker);if(at<0)continue;
  const prefix=message.content.slice(0,at+marker.length),lines=message.content.slice(at+marker.length).split('\n');
  for(let n=0;n<lines.length;n++){
   let entry;try{entry=JSON.parse(lines[n]);}catch{break;}
   if(!entry||typeof entry.file!=='string'||typeof entry.body!=='string'||Object.keys(entry).some(key=>!['file','body'].includes(key)))break;
   const key=hash(JSON.stringify([entry.file,entry.body]));
   if(excerpts.has(key)&&entry.body.length>240){lines[n]=JSON.stringify({file:entry.file,body:'[Identical excerpt omitted here; full excerpt is included in a later user message in this request. Re-read source before editing.]'});duplicateExcerpts++;}
   else excerpts.add(key);
  }message.content=prefix+lines.join('\n');
 }
 const before=estimateTokens(messages),after=estimateTokens(output);
 return {messages:output,stats:{beforeEstimate:before,afterEstimate:after,savedEstimate:Math.max(0,before-after),duplicateReads:duplicates,duplicateExcerpts}};
}
