import { fileCompletions } from './selected-context.js';
import { EventEmitter } from 'node:events';
import { emitKeypressEvents } from 'node:readline';
import { stripVTControlCharacters } from 'node:util';
import { displayWidth, fit, chatPrompt } from './terminal-view.js';
import { chatCommands } from './chat-console.js';

const segments = new Intl.Segmenter('ko', { granularity: 'grapheme' });
const chars = text => [...segments.segment(text)].map(s => s.segment);
const safe = text => stripVTControlCharacters(String(text)).replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
export function wrapText(text, width) {
  const rows = [];
  for (const line of safe(text).replace(/\t/g, '  ').split('\n')) {
    let row = '', used = 0;
    for (const c of chars(line)) {
      const size = displayWidth(c);
      if (used + size > width && row) { rows.push(row); row = ''; used = 0; }
      row += c; used += size;
    }
    rows.push(row);
  }
  return rows;
}

export function cursorPositions(text, width) {
  const positions = [{row:0,col:0}]; let row=0,col=0;
  for(const c of chars(text)) {
    if(c==='\n'){row++;col=0;} else {
      const n=displayWidth(c);
      if(col+n>width){row++;col=0;}
      col+=n;
    }
    positions.push(col===width ? {row:row+1,col:0} : {row,col});
  }
  return positions;
}

export class ConsoleUI extends EventEmitter {
  constructor({ input = process.stdin, output = process.stdout, status = () => ({}) } = {}) {
    super(); this.input = input; this.output = output; this.status = status;
    this.files = []; this.entries = []; this.buffer = ''; this.cursor = 0; this.scroll = 0;
    this.expanded = false; this.menuIndex = -1; this.closed = false;
    this.stage = '대기'; this.panel = '대화'; this.pasting = false;
    this.oldRaw = Boolean(input.isRaw);
    emitKeypressEvents(input);
    this.keyListener = (text, key) => this.key(text, key || {});
    this.resizeListener = () => this.render();
    input.on('keypress', this.keyListener); output.on('resize', this.resizeListener);
    this.endListener = () => this.close(); input.on('end', this.endListener);
    input.setRawMode?.(true); input.resume();
    output.write('\x1b[?1049h\x1b[?2004h');
    this.render();
  }
  get width() { return Math.max(10, (this.output.columns || 80) - 1); }
  get height() { return Math.max(8, this.output.rows || 24); }
  lines() {
    return this.entries.flatMap(entry => wrapText(entry.type === 'log' && !this.expanded ? `  ▸ ${entry.title}  [F2 펼치기]` : entry.text, this.width - 2));
  }
  mutate(fn) {
    const before = this.lines().length; fn();
    // Keep the same viewport when new output arrives while reading history.
    if (this.scroll > 0) this.scroll = Math.max(0, this.scroll + this.lines().length - before);
    this.render();
  }
  append(text) {
    this.mutate(() => {
      const last = this.entries.at(-1);
      if (last?.type === 'text' && last.text.length < 50000) last.text += safe(text);
      else this.entries.push({ type: 'text', text: safe(text) });
      this.bound();
    });
  }
  bound() { // Session JSON remains the authoritative full transcript.
    while (this.entries.length > 250 || this.entries.reduce((n,e)=>n+e.text.length,0) > 300000) this.entries.shift();
  }
  log(title, text) { this.mutate(() => { this.entries.push({ type: 'log', title: safe(title), text: `${safe(title)}\n${safe(text)}\n` }); this.bound(); }); }
  preview(text) { this.panel = text.startsWith('$') ? '실행 검토' : '변경 검토'; this.append(`\n── ${this.panel} (y 적용 / n 취소) ──\n${text}\n`); this.scroll = 0; this.render(); }
  setStage(stage) { this.stage = stage; this.render(); }
  menu() {
    if (!this.pending || this.pending.hidden || this.pending.label !== chatPrompt) return [];
    const prefix = chars(this.buffer).slice(0, this.cursor).join('');
    const references = fileCompletions(prefix, this.files);
    if (references.length) return references.map(value => value + chars(this.buffer).slice(this.cursor).join(''));
    if (!this.buffer.startsWith('/') || this.buffer.includes('\n')) return [];
    return [...chatCommands, '/status', '/verbose', '/connect', '/diff'].filter((v,i,a)=>a.indexOf(v)===i && v.startsWith(this.buffer));
  }
  question(label, { signal } = {}) { return this.ask(label, false, signal); }
  questionHidden(label, { signal } = {}) { return this.ask(label, true, signal); }
  ask(label, hidden, signal) {
    if (this.closed || signal?.aborted) return Promise.reject(new Error('Cancelled.'));
    if (this.pending) return Promise.reject(new Error('Input already pending.'));
    const normal = label === chatPrompt;
    if (!normal) { this.savedDraft = { buffer: this.buffer, cursor: this.cursor }; this.buffer = ''; this.cursor = 0; }
    return new Promise((resolve, reject) => {
      const abort = () => this.finish(undefined, new Error('Cancelled.'));
      this.pending = { label: safe(label), hidden, normal, resolve, reject, signal, abort };
      signal?.addEventListener('abort', abort, { once: true });
      this.menuIndex = -1; this.render();
    });
  }
  finish(value, error) {
    const pending = this.pending; if (!pending) return;
    this.pending = null; this.lastInputWasPaste = pending.normal && Boolean(this.hasPaste); this.hasPaste = false; pending.signal?.removeEventListener('abort', pending.abort);
    if (!error && !pending.hidden && value?.trim()) this.append(`\n나 › ${value}\n`);
    this.buffer = ''; this.cursor = 0; this.menuIndex = -1;
    if (!pending.normal && this.savedDraft) { Object.assign(this, this.savedDraft); this.savedDraft = null; }
    if (error) pending.reject(error); else pending.resolve(value);
    this.render();
  }
  insert(text) {
    if (Buffer.byteLength(this.buffer) + Buffer.byteLength(text) > 65536) { this.hint = '입력은 64 KiB 이내로 나눠주세요.'; return; }
    const parts = chars(this.buffer);parts.splice(this.cursor,0,...chars(text));this.buffer=parts.join('');this.cursor+=chars(text).length;
  }
  key(text = '', key) {
    if (this.closed) return;
    if (key.name === 'paste-start') { this.pasting = true; this.hasPaste = true; this.pasteText = ''; return; }
    if (key.name === 'paste-end') { this.pasting = false; this.insert(safe(this.pasteText)); this.pasteText = ''; this.render(); return; }
    if (this.pasting) { if (text && this.pasteText.length <= 65536) this.pasteText += text.replace(/\r/g,'\n'); return; }
    if (key.ctrl && key.name === 'c') { this.emit('SIGINT'); return; }
    if (key.name === 'pageup') { this.scroll = Math.min(this.lines().length, this.scroll + Math.max(1,this.height-8)); this.render(); return; }
    if (key.name === 'pagedown') { this.scroll = Math.max(0, this.scroll - Math.max(1,this.height-8)); this.render(); return; }
    if (key.ctrl && key.name === 'end') { this.scroll = 0; this.render(); return; }
    if (key.name === 'f2') { this.expanded = !this.expanded;this.scroll=0;this.render();return; }
    if (key.name === 'escape') { this.menuIndex=-1; this.render();return; }
    this.hint='';
    const menu=this.menu();
    if(menu.length && ['up','down','tab'].includes(key.name)) {
      const direction=key.name==='up'?-1:1;this.menuIndex=(this.menuIndex+direction+menu.length)%menu.length;this.render();return;
    }
    if (key.name==='return' && !key.meta && !key.shift) {
      if(menu.length && this.menuIndex>=0){this.buffer=menu[this.menuIndex];this.cursor=chars(this.buffer).length;this.menuIndex=-1;this.render();return;}
      if(this.pending) this.finish(this.buffer); else {this.hint='작업 중입니다. 초안을 편집하고 완료 후 전송하세요.';this.render();} return;
    }
    if ((key.name==='return' && (key.meta||key.shift)) || key.name==='enter' || (key.ctrl&&key.name==='j')) this.insert('\n');
    else if (key.name==='up' || key.name==='down') {
      const positions=cursorPositions(this.buffer,this.width-4), current=positions[this.cursor];
      const row=current.row+(key.name==='up'?-1:1);
      const candidates=positions.map((p,i)=>({...p,i})).filter(p=>p.row===row);
      if(candidates.length)this.cursor=candidates.reduce((best,p)=>Math.abs(p.col-current.col)<Math.abs(best.col-current.col)?p:best).i;
    }
    else if (key.name==='left') this.cursor=Math.max(0,this.cursor-1);
    else if (key.name==='right') this.cursor=Math.min(chars(this.buffer).length,this.cursor+1);
    else if (key.name==='home') this.cursor=0;
    else if (key.name==='end') this.cursor=chars(this.buffer).length;
    else if (key.name==='backspace') {const p=chars(this.buffer);if(this.cursor>0)p.splice(--this.cursor,1);this.buffer=p.join('');}
    else if (key.name==='delete') {const p=chars(this.buffer);p.splice(this.cursor,1);this.buffer=p.join('');}
    else if (text && !key.ctrl && !key.meta) this.insert(safe(text));
    this.menuIndex=-1;this.render();
  }
  render() {
    if(this.closed)return;
    const w=this.width,h=this.height,s=this.status();
    const color=!('NO_COLOR' in process.env)&&process.env.TERM!=='dumb';
    const accent=t=>color?`\x1b[1;36m${t}\x1b[0m`:t;
    const line=t=>fit(t,w);
    const pending=this.pending;
    const draft=pending?.hidden ? '•'.repeat(Math.min(chars(this.buffer).length,30)) : this.buffer;
    const draftLines=wrapText(draft,w-4);
    const prefix=pending?.hidden ? draft : chars(this.buffer).slice(0,this.cursor).join('');
    const position=cursorPositions(prefix,w-4).at(-1);const cursorRow=position.row;
    while(draftLines.length<=cursorRow)draftLines.push('');
    const inputHeight=Math.min(4,Math.max(1,draftLines.length),Math.max(1,h-7));
    const first=Math.max(0,cursorRow-inputHeight+1);
    const menu=this.menu();const chosen=Math.max(0,this.menuIndex);const options=menu.slice(Math.max(0,chosen-2),Math.max(0,chosen-2)+3);
    const menuHeight=Math.min(options.length,Math.max(0,h-inputHeight-7));
    const bodyHeight=Math.max(1,h-inputHeight-menuHeight-5);
    const all=this.lines();this.scroll=Math.min(this.scroll,Math.max(0,all.length-bodyHeight));
    const end=Math.max(0,all.length-this.scroll), start=Math.max(0,end-bodyHeight);
    const body=all.slice(start,end);while(body.length<bodyHeight)body.push('');
    const rows=[accent(line(` OSCODE │ ${s.project||''} │ ${this.panel}`)),line(` ${s.mode||'BUILD'} · ${s.model||'LOCAL'} · ${this.stage}`),...body.map(t=>line(' '+t))];
    rows.push(line(` ${this.scroll ? '최신 답변 ↓ Ctrl+End · ' : ''}토큰${s.usageEstimated?'(추정 포함)':''} ${s.used||0}/${s.budget||0} · 잔여 ${Math.max(0,(s.budget||0)-(s.used||0))} · 초안 추정 ${s.estimate||0}`));
    for(const option of options.slice(0,menuHeight))rows.push(line(`${option===menu[this.menuIndex]?' ›':'  '} ${option}`));
    const inputTop=rows.length;
    const inputLabel=fit(` ─ ${pending?.hidden?'키 숨김 입력':pending&&!pending.normal?pending.label:'메시지'} `,w);
    rows.push(accent(inputLabel+'─'.repeat(Math.max(0,w-displayWidth(inputLabel)))));
    for(let i=0;i<inputHeight;i++)rows.push(line(` ${i===0?'›':'│'} ${draftLines[first+i]||''}`));
    rows.push(line(this.hint||' Enter 전송 · Alt+Enter/Ctrl+J 줄바꿈 · PgUp/PgDn 스크롤 · F2 로그'));
    const rendered=rows.slice(0,h).map((r,i)=>`\x1b[${i+1};1H\x1b[2K${r}`).join('');
    const cursorY=Math.min(h-1,inputTop+2+cursorRow-first);
    const cursorX=Math.min(w,4+position.col);
    this.output.write(`\x1b[?25l\x1b[H${rendered}\x1b[${cursorY};${cursorX}H\x1b[?25h`);
  }
  close() {
    if(this.closed)return;
    if(this.pending)this.finish(undefined,new Error('Closed.'));
    this.closed=true;this.input.off('keypress',this.keyListener);this.input.off('end',this.endListener);this.output.off('resize',this.resizeListener);
    this.input.setRawMode?.(this.oldRaw);this.input.pause();
    this.output.write('\x1b[?2004l\x1b[?25h\x1b[?1049l');this.emit('close');
  }
}
