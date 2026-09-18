import {displayWidth,fit} from './terminal-view.js';

const inline=text=>text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'$1 ($2)').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/`([^`]+)`/g,'$1');
const pad=(text,width)=>text+' '.repeat(Math.max(0,width-displayWidth(text)));
export function conversationRows(entries,width,wrap,expanded=false) {
 const rows=[];const add=(text,kind='text')=>rows.push({text:fit(text,width),kind});
 for(const entry of entries) {
  if(entry.type==='user') {
   const bubble=Math.max(4,Math.min(width-2,Math.floor(width*.78)));
   const lines=wrap(entry.text,bubble-2);const actual=Math.min(bubble,Math.max(...lines.map(displayWidth),2)+2);
   const margin=' '.repeat(Math.max(0,Math.min(12,width-actual)));if(rows.length && rows.at(-1).text)add('');
   for(const line of lines)add(margin+pad(' '+line+' ',actual),'user');
   add('');continue;
  }
  if(entry.type!=='assistant') {
   for(const text of wrap(entry.type==='log'&&!expanded?`▸ ${entry.title}  [F2 펼치기]`:entry.text,width))add(text,entry.type==='log'?'muted':'text');
   continue;
  }
  if(rows.length && rows.at(-1).text)add('');add('OSCODE','label');
  const lines=entry.text.split('\n');let code=false;
  for(let i=0;i<lines.length;i++) {
   const line=lines[i];
   if(/^\s*```/.test(line)) {code=!code;add(code?`╭─ ${line.trim().slice(3)||'code'}`:'╰'+'─'.repeat(Math.max(0,width-1)),'muted');continue;}
   if(code){for(const text of wrap(line,width-2))add('│ '+text,'code');continue;}
   if(line.includes('|') && i+1<lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i+1])) {
    const cells=value=>value.trim().replace(/^\||\|$/g,'').split('|').map(x=>inline(x.trim()));
    const table=[cells(line)];i++;
    while(i+1<lines.length && lines[i+1].includes('|') && lines[i+1].trim()){table.push(cells(lines[++i]));}
    const count=table[0].length;
    if(count>0 && width>=count*10) {
     const col=Math.max(3,Math.floor((width-(count-1)*3)/count));
     for(let r=0;r<table.length;r++) {
      const wrapped=Array.from({length:count},(_,c)=>wrap(table[r][c]||'',col));
      for(let n=0;n<Math.max(...wrapped.map(c=>c.length));n++)add(wrapped.map(c=>pad(c[n]||'',col)).join(' │ '),r===0?'heading':'text');
      if(r===0)add('─'.repeat(Math.min(width,count*col+(count-1)*3)),'muted');
     }
    }else for(const row of table)for(const text of wrap(row.join(' · '),width))add(text);
    continue;
   }
   const heading=/^#{1,6}\s+/.test(line);
   const value=inline(line.replace(/^#{1,6}\s+/,'').replace(/^\s*[-*]\s+/,'  • '));
   for(const text of wrap(value,width))add(text,heading?'heading':'text');
  }
 }
 return rows;
}
export function paintConversationRow(row,color) {
 if(!color)return row.text;
 const styles={heading:'1',label:'1;37',muted:'90',code:'48;5;235;38;5;189'};
 if(row.kind==='user') {
  const start=row.text.search(/\S/);if(start<0)return row.text;
  return row.text.slice(0,start)+`\x1b[48;5;237;37m${row.text.slice(start)}\x1b[0m`;
 }
 return styles[row.kind]?`\x1b[${styles[row.kind]}m${row.text}\x1b[0m`:row.text;
}
