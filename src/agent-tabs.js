import {PassThrough,Writable} from 'node:stream';
import {ConsoleUI} from './tui.js';

// Independent console/agent loops share only terminal input and the tab strip.
export class AgentTabs {
 constructor({run,input=process.stdin,output=process.stdout,max=4}={}) {
  this.run=run;this.input=input;this.output=output;this.max=max;this.previewOpened=new Set();this.tabs=[];this.sequence=0;this.locks=new Map();this.selected=null;this.started=false;
  this.data=chunk=>this.selected?.input?.write(chunk);
  this.resize=()=>{for(const tab of this.tabs){tab.output.columns=output.columns;tab.output.rows=output.rows;tab.output.emit('resize');}};
  this.interrupt=()=>this.selected?.ui?.emit('SIGINT');
  this.end=()=>{for(const tab of this.tabs){tab.ui?.emit('SIGINT');tab.ui?.close();}};
 }
 start() {
  if(this.started)return;this.started=true;this.oldRaw=Boolean(this.input.isRaw);
  this.input.setRawMode?.(true);this.input.resume();this.input.on('data',this.data);this.input.on('end',this.end);this.output.on('resize',this.resize);process.on('SIGINT',this.interrupt);
  this.output.write('\x1b[?1049h\x1b[?2004h\x1b[?1000h\x1b[?1006h');
 }
 createUI(tab,options,launchArgs) {
  this.start();tab.input?.destroy();tab.output?.destroy();tab.launchArgs=launchArgs;
  tab.input=new PassThrough();tab.input.isTTY=true;tab.input.setRawMode=()=>{};
  tab.output=new Writable({write:(chunk,_encoding,done)=>{
   if(this.selected===tab)this.output.write(chunk.toString().replace(/\x1b\[\?(?:1049|2004|1000|1006)[hl]/g,''));
   else if(this.selected?.ui&&!this.selected.ui.closed)this.selected.ui.render();
   done();
  }});
  tab.output.isTTY=true;tab.output.columns=this.output.columns;tab.output.rows=this.output.rows;
  tab.ui=new ConsoleUI({...options,input:tab.input,output:tab.output,tabs:()=>this.tabs.map(t=>({id:t.id,selected:t===this.selected,state:!t.ui?'준비':t.ui.pending?.normal?'대기':t.ui.pending?'입력':'작업'}))});
  tab.ui.on('newAgent',()=>this.add(typeof tab.launchArgs==='function'?tab.launchArgs():tab.launchArgs));
  tab.ui.on('selectAgent',id=>this.select(id));
  tab.ui.on('nextAgent',step=>{const index=this.tabs.indexOf(this.selected);this.select(this.tabs[(index+step+this.tabs.length)%this.tabs.length].id);});
  this.select(tab.id);return tab.ui;
 }
 add(args) {
  if(this.tabs.length>=this.max){if(this.selected?.ui){this.selected.ui.hint=`동시 에이전트는 최대 ${this.max}개입니다. /exit로 탭을 닫으세요.`;this.selected.ui.render();}return;}
  const tab={id:++this.sequence};this.tabs.push(tab);this.selected=tab;
  tab.task=Promise.resolve().then(()=>this.run(args,{createUI:(options,launchArgs)=>this.createUI(tab,options,launchArgs),exclusive:(root,fn,signal)=>this.exclusive(root,fn,signal),previewOpened:this.previewOpened})).catch(error=>{
   this.lastError=error.message;
   const other=this.tabs.find(t=>t!==tab&&t.ui&&!t.ui.closed);
   if(other)other.ui.append(`\n에이전트 시작 실패: ${error.message}\n`);
  }).finally(()=>{
   tab.ui?.close();tab.input?.destroy();tab.output?.destroy();this.tabs=this.tabs.filter(t=>t!==tab);
   if(this.selected===tab)this.selected=this.tabs.at(-1)||null;
   if(this.selected?.ui)this.select(this.selected.id);
   if(!this.tabs.length){this.close();this.done?.();}
  });return tab;
 }
 async exclusive(root,fn,signal) {
  const previous=this.locks.get(root)||Promise.resolve();let release;
  const current=new Promise(resolve=>{release=resolve;});this.locks.set(root,current);
  const unlock=()=>{release();if(this.locks.get(root)===current)this.locks.delete(root);};
  let abort;
  try {
   await Promise.race([previous,new Promise((_,reject)=>{
    abort=()=>reject(new Error('Cancelled.'));
    if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
   })]);
  }catch(error){void previous.then(unlock);throw error;}
  finally{signal?.removeEventListener('abort',abort);}
  try {if(signal?.aborted)throw new Error('Cancelled.');return await fn();}
  finally{unlock();}
 }
 select(id) {
  const tab=this.tabs.find(t=>t.id===id);if(!tab)return;this.selected=tab;
  if(tab.ui&&!tab.ui.closed){tab.ui.renderedRows=[];tab.ui.render();}
 }
 async launch(args) {const completed=new Promise(resolve=>{this.done=resolve;});this.add(args);await completed;}
 close() {
  if(!this.started)return;this.started=false;this.input.off('data',this.data);this.input.off('end',this.end);this.output.off('resize',this.resize);process.removeListener('SIGINT',this.interrupt);
  this.input.setRawMode?.(this.oldRaw);this.input.pause();this.output.write('\x1b[?1000l\x1b[?1006l\x1b[?2004l\x1b[?25h\x1b[?1049l');
 }
}
