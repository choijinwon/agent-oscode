import {appearance, palettes} from './appearance.js';
import {conversationRows,paintConversationRow} from './chat-layout.js';
import { searchCommands, commandPalette, primaryCommands } from './command-palette.js';
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
  constructor({ input = process.stdin, output = process.stdout, status = () => ({}), copy, paste, tabs, appearance: style } = {}) {
    super(); this.appearance=appearance(style); this.input = input; this.output = output; this.status = status; this.copy = copy; this.paste = paste; this.tabs = tabs;
    this.changes = new Map(); this.failure = null; this.history = []; this.overlay = null; this.recovery = null;
    this.files = []; this.entries = []; this.olderEntries = []; this.buffer = ''; this.cursor = 0; this.scroll = 0;
    this.multiline = false; this.completionOpen = false; this.inputOffset = 0; this.renderedRows = [];
    this.expanded = false; this.menuIndex = -1; this.closed = false;
    this.stage = '대기'; this.panel = '대화'; this.pasting = false;
    this.oldRaw = Boolean(input.isRaw);
    emitKeypressEvents(input);
    this.keyListener = (text, key) => this.key(text, key || {});
    this.resizeListener = () => { this.renderedRows = []; this.render(); };
    input.on('keypress', this.keyListener); output.on('resize', this.resizeListener);
    this.endListener = () => this.close(); input.on('end', this.endListener);
    input.setRawMode?.(true); input.resume();
    output.write('\x1b[?1049h\x1b[?2004h\x1b[?1000h\x1b[?1006h');
    this.render();
  }
  get width() { return Math.max(10, (this.output.columns || 80) - 1); }
  get composerWidth() { return Math.min(this.width, 88); }
  get height() { return Math.max(8, this.output.rows || 24); }
  lines() {
    return this.transcriptRows().map(row=>row.text);
  }
  transcriptRows() {
    return conversationRows([...this.olderEntries,...this.entries],this.composerWidth-2,wrapText,this.expanded,this.appearance.format);
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
  appendAnswer(text) {
    this.mutate(() => {
      const last=this.entries.at(-1);
      if(last?.type==='assistant')last.text+=safe(text);
      else this.entries.push({type:'assistant',text:safe(text)});
      this.bound();
    });
  }
  bound() { // Retain older entries for scrolling instead of discarding visible history.
    while (this.entries.length > 250 || this.entries.reduce((n,e)=>n+e.text.length,0) > 300000) this.olderEntries.push(this.entries.shift());
  }
  restoreSession(session) {
    this.entries=[];this.olderEntries=[];
    for(const turn of [...(session.archive||[]),...(session.turns||[])]) {
      for(const message of turn.messages||[]) {
        if(!['user','assistant'].includes(message.role)||typeof message.content!=='string'||!message.content.trim())continue;
        const content=message.role==='user'?message.content.split('\n\n[Selected source excerpts:')[0].split('\n\n[User-selected project skill:')[0]:message.content;
        this.entries.push({type:message.role,text:safe(content)});
      }
    }
    this.bound();this.scroll=0;this.render();
  }
  log(title, text) { this.mutate(() => { this.entries.push({ type: 'log', title: safe(title), text: `${safe(title)}\n${safe(text)}\n` }); this.bound(); }); }
  preview(text) { this.panel = text.startsWith('$') ? '실행 검토' : '변경 검토'; this.append(`\n── ${this.panel} (y 적용 / n 취소) ──\n${text}\n`); this.scroll = 0; this.render(); }
  setStage(stage) { this.stage = stage; this.render(); }
  setCommunicating(active) {
    if (this.closed) return;
    if (active && !this.communicationTimer) {
      this.communicationFrame = 0;
      this.communicationTimer = setInterval(() => {
        this.communicationFrame = (this.communicationFrame + 1) % 8;
        this.render();
      }, 240);
      this.communicationTimer.unref?.();
    } else if (!active) {
      clearInterval(this.communicationTimer); this.communicationTimer = null;
    }
    this.render();
  }
  communicationLabel() {
    if (!this.communicationTimer) return this.stage;
    const frames = ['🐳      ·', ' 🐳     ·', '  🐳    ˚', '   🐳   °', '    🐳  ˚', '   🐳   ·', '  🐳    ·', ' 🐳     ·'];
    return `${frames[this.communicationFrame]} 데이터 통신 중…`;
  }
  openOverlay(kind) {
    if (!this.pending?.normal || this.pending.hidden) return;
    if (this.overlay) this.closeOverlay();
    this.hint = '';
    this.overlay = { kind, buffer: this.buffer, cursor: this.cursor, hasPaste: this.hasPaste };
    this.buffer = ''; this.cursor = 0; this.hasPaste = false; this.menuIndex = 0; this.render();
  }
  closeOverlay(selected) {
    if (!this.overlay) return;
    const saved = this.overlay;
    this.overlay = null;
    if(saved.kind==='changes'&&selected){Object.assign(this,{buffer:saved.buffer,cursor:saved.cursor,hasPaste:saved.hasPaste});this.append(`\n파일 도구 변경 · ${selected.path} (누적 교체 범위)\n${selected.preview}\n`);this.scroll=0;this.render();return;}
    this.buffer = selected ? selected.text : saved.buffer;
    this.cursor = selected ? chars(selected.text).length : saved.cursor;
    this.hasPaste = selected ? selected.pasted : saved.hasPaste;
    this.menuIndex = -1; this.hint = ''; this.render();
  }
  choices() {
    if(this.overlay?.kind==='changes')return [...this.changes.values()].filter(item=>item.path.toLowerCase().includes(this.buffer.toLowerCase())).map(item=>({...item,label:`${item.path}  +${item.added} −${item.removed}`}));
    if(this.overlay?.kind==='files') return this.files.filter(file=>file.toLowerCase().includes(this.buffer.toLowerCase())).slice(0,100).map(file=>({text:`${this.overlay.buffer}${this.overlay.buffer && !/\s$/.test(this.overlay.buffer)?' ':''}@${/\s/.test(file)?JSON.stringify(file):file} `,label:file,pasted:this.overlay.hasPaste}));
    if (this.overlay?.kind === 'palette') return searchCommands(this.buffer).map(([text, label]) => ({text, label: `${label}  ${text}`, pasted: false}));
    if (this.overlay?.kind === 'history') return [...this.history].reverse().filter(item => item.text.toLowerCase().includes(this.buffer.toLowerCase())).map(item => ({...item, label: item.text.replace(/\n/g, ' ↵ ')}));
    return [];
  }
  recoverPrompt(text, pasted = false) {
    this.recovery = {text, pasted};
    if (!this.buffer && !this.pending && !this.overlay) this.restorePrompt();
    else { this.hint = '취소한 요청 보관됨 · 입력을 비운 뒤 F4 복구'; this.render(); }
  }
  restorePrompt() {
    if (!this.recovery || this.overlay || (this.pending && !this.pending.normal)) return;
    if (this.buffer) { this.hint = '현재 초안을 먼저 비워주세요. 취소한 요청은 보관되어 있습니다.'; this.render(); return; }
    this.buffer = this.recovery.text; this.hasPaste = this.recovery.pasted;
    this.cursor = chars(this.buffer).length; this.recovery = null;
    this.hint = '취소한 요청을 복구했습니다. 수정 후 Enter로 다시 전송하세요.'; this.render();
  }
  async copyContent(kind) {
    if (this.overlay || this.settingsView || (this.pending && !this.pending.normal)) return;
    if (this.copying) return;
    this.copying = true;
    this.hint = '클립보드에 복사 중…'; this.render();
    try {
      if (!this.copy) throw new Error('복사 기능을 사용할 수 없습니다.');
      if (kind === 'draft' && !this.buffer.trim()) throw new Error('작성 중인 입력이 없습니다.');
      await this.copy(kind, kind === 'draft' ? this.buffer : undefined);
      this.hint = `${kind === 'draft' ? '입력 내용' : kind === 'code' ? '코드 블록' : '마지막 완료 답변'}을 복사했습니다.`;
    } catch (error) { this.hint = `복사 실패: ${safe(error.message)}`; }
    finally { this.copying = false; this.render(); }
  }
  async pasteContent() {
    if(this.closed || this.pasteLoading || this.overlay || this.settingsView || this.pending && !this.pending.normal)return;
    const pending=this.pending,buffer=this.buffer,cursor=this.cursor;
    this.pasteLoading=true;
    try {
      if(!this.paste)throw new Error('클립보드를 사용할 수 없습니다. 터미널 붙여넣기를 사용하세요.');
      const value=await this.paste();
      if(this.closed)return;
      if(this.pending!==pending || this.buffer!==buffer || this.cursor!==cursor || this.overlay || this.settingsView) {
        this.hint='입력 상태가 바뀌었습니다. 다시 붙여넣어 주세요.';return;
      }
      const text=safe(String(value).replace(/\r\n?/g,'\n'));
      if(!text)throw new Error('클립보드에 텍스트가 없습니다.');
      if(Buffer.byteLength(this.buffer)+Buffer.byteLength(text)>65536)throw new Error('입력은 64 KiB 이내로 나눠주세요.');
      this.insert(text);this.hasPaste=true;this.completionOpen=false;this.menuIndex=-1;
      this.hint='붙여넣었습니다. 내용을 확인한 뒤 전송하세요.';
    }catch(error){this.hint=`붙여넣기 실패: ${safe(error.message)}`;}
    finally{this.pasteLoading=false;this.render();}
  }
  recordChange(path, preview, added, removed) {
    path=safe(path);preview=safe(preview);
    const previous=this.changes.get(path);
    this.changes.set(path,{path,preview:(previous?.preview||'')+'\n'+preview,added:(previous?.added||0)+added,removed:(previous?.removed||0)+removed});this.render();
  }
  showFailure(text, pasted=false) { this.failure={text,pasted};this.render(); }
  clearFailure() { this.failure=null;this.render(); }
  queuePrompt() {
    if(this.pending || !this.buffer.trim())return;
    if(this.queuedPrompt){this.hint='다음 요청 1개가 대기 중입니다. Esc로 꺼내 수정하세요.';this.render();return;}
    if(this.buffer.trim().startsWith('/')&&!this.hasPaste){this.hint='명령어는 작업이 끝난 뒤 실행하세요.';this.render();return;}
    this.queuedPrompt={text:this.buffer,pasted:Boolean(this.hasPaste)};
    this.buffer='';this.cursor=0;this.hasPaste=false;
    this.hint='다음 요청 대기 중 · 현재 작업 완료 후 실행 · Esc로 꺼내기';this.render();
  }
  pauseQueuedPrompt() {
    if(!this.queuedPrompt)return false;
    const queued=this.queuedPrompt;this.queuedPrompt=null;
    this.recoverPrompt(queued.text,queued.pasted);return true;
  }
  shortcuts() {
    if (this.completionOpen && this.buffer.startsWith('/')) return ' ↑↓ 명령 선택 · Enter 실행 · Esc 닫기';
    if (this.pending?.choices) return ' 이름 검색 · ↑↓ 선택 · Enter 확정 · Ctrl+C 취소';
    if (this.overlay) return ' ↑↓ 선택 · Enter 입력창에 넣기 · Esc 돌아가기';
    if (this.pending?.hidden) return ' Enter 키 저장 · Ctrl+C 취소 · 입력은 기록하지 않습니다';
    if (this.pending && !this.pending.normal) return /승인/.test(this.pending.label) ? ' y 승인 / n 취소 후 Enter · PgUp/PgDn 검토 · Ctrl+C 중단' : ' Enter 확인 · Ctrl+C 취소';
    if (!this.pending) return this.queuedPrompt?' 다음 요청 대기 중 · Esc 꺼내기 · Ctrl+C 작업 취소':this.multiline?' Enter 줄바꿈 · F5 다음 요청 대기 · Ctrl+C 취소':' Enter 다음 요청 대기 · Ctrl+C 취소 · F2 로그';
    return this.multiline ? ' Enter 줄바꿈 · F5 전송 · Tab 모드 전환 · F3 한 줄' : ' Enter 전송   ·   Ctrl+J 줄바꿈   ·   / 명령';
  }
  menu() {
    if (this.pending?.choices) return this.selection().map(item=>item.label);
    if (this.overlay) return this.choices().map(item => item.label);
    if (!this.pending || this.pending.hidden || this.pending.label !== chatPrompt) return [];
    const prefix = chars(this.buffer).slice(0, this.cursor).join('');
    const references = fileCompletions(prefix, this.files);
    if (references.length) return references.map(value => value + chars(this.buffer).slice(this.cursor).join(''));
    if (!this.buffer.startsWith('/') || this.buffer.includes('\n')) return [];
    if(this.buffer==='/')return primaryCommands;
    return [...chatCommands, '/status', '/verbose', '/connect', '/diff'].filter((v,i,a)=>a.indexOf(v)===i && v.startsWith(this.buffer));
  }
  choose(label, choices, {signal} = {}) {
    const result=this.ask(label,false,signal);
    if(this.pending) { this.pending.choices=choices;this.menuIndex=0;this.render(); }
    return result;
  }
  selection() { return (this.pending?.choices || []).filter(item=>item.label.toLowerCase().includes(this.buffer.toLowerCase())); }
  question(label, { signal } = {}) { return this.ask(label, false, signal); }
  questionHidden(label, { signal } = {}) { return this.ask(label, true, signal); }
  ask(label, hidden, signal) {
    if (this.closed || signal?.aborted) return Promise.reject(new Error('Cancelled.'));
    if (this.pending) return Promise.reject(new Error('Input already pending.'));
    if (this.overlay) this.closeOverlay();
    const normal = label === chatPrompt;
    if (!normal) { this.savedDraft = { buffer: this.buffer, cursor: this.cursor, hasPaste: this.hasPaste }; this.hasPaste = false; this.buffer = ''; this.cursor = 0; }
    return new Promise((resolve, reject) => {
      const abort = () => this.finish(undefined, new Error('Cancelled.'));
      this.pending = { label: safe(label), hidden, normal, resolve, reject, signal, abort };
      signal?.addEventListener('abort', abort, { once: true });
      this.menuIndex = -1; this.hint='';
      if(normal && this.queuedPrompt) {
        const queued=this.queuedPrompt;this.queuedPrompt=null;
        const draft={buffer:this.buffer,cursor:this.cursor,hasPaste:this.hasPaste};
        this.hasPaste=queued.pasted;this.finish(queued.text);Object.assign(this,draft);
      }
      this.render();
    });
  }
  finish(value, error) {
    const pending = this.pending; if (!pending) return;
    if (!error && pending.normal && value?.trim()) {
      this.history = this.history.filter(item => item.text !== value);
      this.history.push({text: value, pasted: Boolean(this.hasPaste)});
      while (this.history.length > 100 || this.history.reduce((n, item) => n + item.text.length, 0) > 200000) this.history.shift();
    }
    this.pending = null; this.lastInputWasPaste = pending.normal && Boolean(this.hasPaste); this.hasPaste = false; pending.signal?.removeEventListener('abort', pending.abort);
    if (!error && !pending.hidden && !this.settingsView && value?.trim()) {
      this.mutate(()=>{this.entries.push({type:'user',text:safe(value)});this.bound();});
    }
    this.buffer = ''; this.cursor = 0; this.menuIndex = -1; this.completionOpen = false;
    if (!pending.normal && this.savedDraft) { Object.assign(this, this.savedDraft); this.savedDraft = null; }
    if (error) pending.reject(error); else pending.resolve(value);
    this.render();
  }
  insert(text) {
    if (Buffer.byteLength(this.buffer) + Buffer.byteLength(text) > 65536) { this.hint = '입력은 64 KiB 이내로 나눠주세요.'; return; }
    const parts = chars(this.buffer);parts.splice(this.cursor,0,...chars(text));this.buffer=parts.join('');this.cursor+=chars(text).length;
  }
  buttonAction(action) {
    if(action==='newAgent'&&!this.closed){this.emit('newAgent');return;}
    if(action.startsWith('agent:')&&!this.closed){this.emit('selectAgent',Number(action.slice(6)));return;}
    if(this.closed || this.overlay || this.settingsView || this.pending && !this.pending.normal)return;
    if(action==='dropqueue'){this.queuedPrompt=null;this.render();return;}
    if(action==='changes'){this.openOverlay('changes');return;}
    if(['retry','editfailed'].includes(action)&&this.failure&&this.pending?.normal){
      const failed=this.failure;
      if(action==='editfailed'){this.recoverPrompt(failed.text,failed.pasted);if(!this.buffer)this.restorePrompt();return;}
      this.failure=null;const draft={buffer:this.buffer,cursor:this.cursor,hasPaste:this.hasPaste};
      this.hasPaste=failed.pasted;this.finish(failed.text);Object.assign(this,draft);this.render();return;
    }
    if(action==='more'){this.moreActions=!this.moreActions;this.render();return;}
    if(action==='copy')return this.copyContent('answer');
    if(action==='paste')return this.pasteContent();
    if(action==='stop'){if(!this.pending)this.emit('SIGINT');return;}
    if(action==='queue')return this.queuePrompt();
    if(action==='unqueue'&&!this.pending)return this.pauseQueuedPrompt();
    if(!this.pending?.normal)return;
    if(action==='send'){if(this.buffer.trim())this.finish(this.buffer);return;}
    if(action==='attach'){this.openOverlay('files');return;}
    if(action==='mode'){this.emit('toggleMode');this.render();return;}
    if(action==='settings'||action==='preview'||action==='skills'||action==='style'||action==='approval'||action==='review'||action==='reviewshow') {
      const draft={buffer:this.buffer,cursor:this.cursor,hasPaste:this.hasPaste};
      this.finish(action==='preview'?'/preview':action==='skills'?'/skills':action==='style'?'/style':action==='approval'?'/approval':action==='review'?'/review':action==='reviewshow'?'/review show':'/settings');Object.assign(this,draft);this.render();
    }
  }
  mouse(sequence) {
    const match=sequence.match(/^(\d+);(\d+);(\d+)([Mm])$/);if(!match||match[4]!=='M')return;
    const [,button,x,y]=match;
    if((Number(button)&64)!==0){this.scroll=Math.max(0,this.scroll+((Number(button)&1)?-3:3));this.render();return;}
    if(Number(button)!==0)return;
    const hit=[...(this.tabButtons||[]),...(this.buttons||[]),...(this.cardButtons||[])].find(b=>Number(y)===b.y && Number(x)>=b.x && Number(x)<b.x+b.width);
    if(hit)this.buttonAction(hit.action);
  }
  key(text = '', key) {
    if (this.closed) return;
    if (key.name === 'paste-start') { this.completionOpen = false; this.menuIndex = -1; this.pasting = true; this.hasPaste = true; this.pasteText = ''; return; }
    if (key.name === 'paste-end') { this.pasting = false; this.insert(safe(this.pasteText)); this.pasteText = ''; this.render(); return; }
    if (this.pasting) { if (text && this.pasteText.length <= 65536) this.pasteText += text.replace(/\r/g,'\n'); return; }
    if(key.sequence==='\x1b[<'){this.mouseBuffer='';return;}
    if(this.mouseBuffer!==undefined) {
      this.mouseBuffer+=text||key.sequence||'';
      if(/[Mm]$/.test(this.mouseBuffer)){const value=this.mouseBuffer;this.mouseBuffer=undefined;this.mouse(value);}
      else if(this.mouseBuffer.length>32||!/^[0-9;]*$/.test(this.mouseBuffer))this.mouseBuffer=undefined;
      return;
    }
    if(key.ctrl && key.name==='v')return this.pasteContent();
    if(key.ctrl && key.name==='n' && this.tabs){this.emit('newAgent');return;}
    if(key.ctrl && ['left','right'].includes(key.name) && this.tabs){this.emit('nextAgent',key.name==='right'?1:-1);return;}
    if(key.name==='f9'){this.buttonAction('attach');return;}
    if(key.name==='f10'){this.buttonAction('settings');return;}
    if (['f6','f7','f8'].includes(key.name)) { return this.copyContent({f6:'answer',f7:'code',f8:'draft'}[key.name]); }
    if (key.ctrl && key.name === 'c') { if (this.overlay) this.closeOverlay(); else this.emit('SIGINT'); return; }
    if (key.ctrl && ['r','p'].includes(key.name)) { this.openOverlay(key.name === 'r' ? 'history' : 'palette'); return; }
    if (key.name === 'f3' && !this.overlay && (!this.pending || this.pending.normal)) { this.multiline = !this.multiline; this.hint = ''; this.render(); return; }
    if (key.name === 'f5' && !this.overlay && (!this.pending || this.pending.normal)) { if(this.pending)this.finish(this.buffer);else this.queuePrompt(); return; }
    if (key.name === 'return' && this.multiline && !this.overlay && (!this.pending || this.pending.normal) && !this.completionOpen) { this.insert('\n'); this.render(); return; }
    if (key.name === 'f4') { this.restorePrompt(); return; }
    if (key.name === 'pageup') { this.scroll = Math.min(this.lines().length, this.scroll + Math.max(1,this.height-8)); this.render(); return; }
    if (key.name === 'pagedown') { this.scroll = Math.max(0, this.scroll - Math.max(1,this.height-8)); this.render(); return; }
    if (key.ctrl && key.name === 'home') { this.scroll=this.lines().length; this.render(); return; }
    if (key.ctrl && key.name === 'end') { this.scroll = 0; this.render(); return; }
    if (key.name === 'f2') { this.expanded = !this.expanded;this.scroll=0;this.render();return; }
    if (key.name === 'escape' && this.queuedPrompt && !this.overlay && !this.pending) {this.pauseQueuedPrompt();return;}
    if (key.name === 'escape') { this.completionOpen = false; if (this.overlay) { this.closeOverlay(); return; } this.menuIndex=-1; this.render();return; }
    this.hint='';
    const menu=this.menu();
    if (key.name === 'tab' && !menu.length && !this.overlay && !this.pending?.choices) {
      if (this.pending?.normal) this.emit('toggleMode');
      else this.hint = '대화 입력 대기 중에만 모드를 전환할 수 있습니다.';
      this.render(); return;
    }
    if (key.name === 'tab' && !this.overlay && !this.completionOpen && menu.length) { this.completionOpen = true; this.menuIndex = 0; this.render(); return; }
    if(menu.length && (this.overlay || this.pending?.choices || this.completionOpen) && ['up','down','tab'].includes(key.name)) {
      const direction=key.name==='up'?-1:1;this.menuIndex=(this.menuIndex+direction+menu.length)%menu.length;this.render();return;
    }
    if (key.name==='return' && !key.meta && !key.shift) {
      if (this.pending?.choices) { const choice=this.selection()[Math.max(0,this.menuIndex)]; if(choice)this.finish(choice.value);return; }
      if (this.overlay) { const choice = this.choices()[Math.max(0,this.menuIndex)]; if (choice) this.closeOverlay(choice); return; }
      if(this.completionOpen && menu.length && this.menuIndex>=0){
        const slash=this.buffer.startsWith('/') && !this.hasPaste;
        this.completionOpen=false;this.buffer=menu[this.menuIndex];this.cursor=chars(this.buffer).length;this.menuIndex=-1;
        if(slash && !this.buffer.endsWith(' '))this.finish(this.buffer);
        else this.render();
        return;
      }
      if(this.pending) this.finish(this.buffer); else this.queuePrompt(); return;
    }
    const previousBuffer = this.buffer;
    const parts = chars(this.buffer);
    const lineStart = parts.slice(0,this.cursor).lastIndexOf('\n') + 1;
    const nextBreak = parts.indexOf('\n',this.cursor);
    const lineEnd = nextBreak < 0 ? parts.length : nextBreak;
    if (key.ctrl && key.name === 'a') this.cursor = lineStart;
    else if (key.ctrl && key.name === 'e') this.cursor = lineEnd;
    else if (key.ctrl && key.name === 'u') { parts.splice(lineStart,this.cursor-lineStart); this.cursor=lineStart; this.buffer=parts.join(''); }
    else if (key.ctrl && key.name === 'k') { parts.splice(this.cursor,lineEnd-this.cursor || (nextBreak >= 0 ? 1 : 0)); this.buffer=parts.join(''); }
    else if (key.ctrl && key.name === 'w') { let start=this.cursor; while(start>0 && /\s/u.test(parts[start-1])) start--; while(start>0 && !/\s/u.test(parts[start-1])) start--; parts.splice(start,this.cursor-start); this.cursor=start; this.buffer=parts.join(''); }
    else if ((key.name==='return' && (key.meta||key.shift)) || key.name==='enter' || (key.ctrl&&key.name==='j')) this.insert('\n');
    else if (key.name==='up' || key.name==='down') {
      const positions=cursorPositions(this.buffer,this.composerWidth-4), current=positions[this.cursor];
      const row=current.row+(key.name==='up'?-1:1);
      const candidates=positions.map((p,i)=>({...p,i})).filter(p=>p.row===row);
      if(candidates.length)this.cursor=candidates.reduce((best,p)=>Math.abs(p.col-current.col)<Math.abs(best.col-current.col)?p:best).i;
    }
    else if (key.name==='left') this.cursor=Math.max(0,this.cursor-1);
    else if (key.name==='right') this.cursor=Math.min(chars(this.buffer).length,this.cursor+1);
    else if (key.name==='home') this.cursor=lineStart;
    else if (key.name==='end') this.cursor=lineEnd;
    else if (key.name==='backspace') {const p=chars(this.buffer);if(this.cursor>0)p.splice(--this.cursor,1);this.buffer=p.join('');}
    else if (key.name==='delete') {const p=chars(this.buffer);p.splice(this.cursor,1);this.buffer=p.join('');}
    else if (text && !key.ctrl && !key.meta) this.insert(safe(text));
    const slash=this.pending?.normal && !this.overlay && !this.hasPaste && this.buffer.startsWith('/') && !this.buffer.includes('\n') && this.menu().length>0;
    this.completionOpen=Boolean(slash && (this.buffer!==previousBuffer || this.completionOpen));
    this.menuIndex=this.overlay || this.pending?.choices || this.completionOpen ? 0 : -1;this.render();
  }
  render() {
    if(this.closed)return;
    const w=this.width,screenHeight=this.height,s=this.status(), box=this.composerWidth;
    const home=this.entries.length===0 && this.olderEntries.length===0 && !this.settingsView;
    const h=screenHeight;
    const left=Math.floor((w-box)/2);
    const top=0;
    const color=!('NO_COLOR' in process.env)&&process.env.TERM!=='dumb';
    const palette=palettes[this.appearance.theme];
    const accent=t=>color?`\x1b[${palette.accent}m${t}\x1b[0m`:t;
    const border=t=>color?`\x1b[${palette.border}m${t}\x1b[0m`:t;
    const surface=t=>color?`\x1b[${palette.surface}m${t}\x1b[0m`:t;
    const line=t=>fit(t,box);
    const muted=t=>color?`\x1b[${palette.muted}m${t}\x1b[0m`:t;
    const pending=this.pending;
    const draft=pending?.hidden ? '•'.repeat(Math.min(chars(this.buffer).length,30)) : this.buffer;
    const draftLines=wrapText(draft,box-4);
    const prefix=pending?.hidden ? draft : chars(this.buffer).slice(0,this.cursor).join('');
    const position=cursorPositions(prefix,box-4).at(-1);const cursorRow=position.row;
    while(draftLines.length<=cursorRow)draftLines.push('');
    const toolbar=!this.overlay && !this.settingsView && (!pending || pending.normal) && h>=12 && box>=28;
    const cards=!this.overlay&&!this.settingsView&&(!pending||pending.normal)&&h>=16&&box>=40;
    const showReview=cards&&h>=22&&this.reviewLabel;
    const cardHeight=cards?((this.queuedPrompt?2:0)+(this.failure?2:0)+(this.changes.size?1:0)+(showReview?2:0)):0;
    const toolbarHeight=(toolbar?1:0)+cardHeight;
    const inputHeight=Math.min(8,Math.max(this.overlay || pending && !pending.normal ? 1 : 3,draftLines.length),Math.max(1,h-9-toolbarHeight));
    this.inputOffset=Math.max(0,Math.min(this.inputOffset,Math.max(0,draftLines.length-inputHeight)));
    if(cursorRow<this.inputOffset)this.inputOffset=cursorRow;
    if(cursorRow>=this.inputOffset+inputHeight)this.inputOffset=cursorRow-inputHeight+1;
    const first=this.inputOffset;
    const menu=this.overlay || this.pending?.choices || this.completionOpen ? this.menu() : [];const chosen=Math.max(0,this.menuIndex);const count=this.settingsView ? 6 : 3;
    const offset=Math.max(0,chosen-count+1);const options=menu.slice(offset,offset+count);
    if (this.overlay && !options.length) options.push('검색 결과가 없습니다.');
    const menuHeight=Math.min(options.length,Math.max(0,h-inputHeight-8-toolbarHeight));
    const bodyHeight=Math.max(1,h-inputHeight-menuHeight-6-toolbarHeight);
    const styled=this.transcriptRows();const all=styled.map(row=>row.text);this.scroll=Math.min(this.scroll,Math.max(0,all.length-bodyHeight));
    const end=Math.max(0,all.length-this.scroll), start=Math.max(0,end-bodyHeight);
    let body=all.slice(start,end);
    if(this.settingsView) {
      const view=this.settingsView;
      body=['설정', '현재 채팅에 적용 · API 키는 별도 저장', '', `공급자  ${view.provider}`, `모델    ${view.model || '선택 필요'}`, `주소    ${view.baseUrl || 'Codex 공식 연결'}`, `${view.provider==='chatgpt' ? '인증' : 'API 키'}  ${view.keyStatus}`, '', view.notice].map(s=>fit(s,box-2)).slice(0,bodyHeight);
      if(view.loginURL)body=['브라우저 로그인',view.notice,'',...wrapText(view.loginURL,box-2)].slice(0,bodyHeight);
      while(body.length<bodyHeight)body.push('');
    } else if(home) {
      const welcome = [
        '무엇을 만들어볼까요?',
        '',
        '아이디어를 적거나, @파일을 첨부하세요.',
        'React · Vue · Angular · Svelte',
        '',
        '/ 명령 찾기    ·    + 도구 더 보기',
        ''
      ];
      body=welcome.slice(0,bodyHeight);
      while(body.length<bodyHeight)body.unshift('');
    } else {
      // Anchor the newest conversation row above the fixed composer; older rows grow upward.
      while(body.length<bodyHeight)body.unshift('');
    }
    const rows=[accent(line(` OSCODE  /  ${s.project||s.directory?.split('/').filter(Boolean).at(-1)||'workspace'}`)),muted(line(` ${s.model||'모델을 연결하세요'}${s.approval?`  ·  ${s.approval}`:''}${s.skill?`  ·  ${safe(s.skill)}`:''}  ·  ${this.stage}`)),...body.map((t,i)=>{
      if(home && t==='무엇을 만들어볼까요?')return accent(line(' '+t));
      const index=i-(bodyHeight-(end-start));
      if(!home && !this.settingsView && index>=0 && index<end-start) {
        const row=styled[start+index];const track=all.length>bodyHeight;
        const thumb=Math.max(1,Math.floor(bodyHeight*bodyHeight/all.length));
        const thumbTop=Math.round(start/Math.max(1,all.length-bodyHeight)*(bodyHeight-thumb));
        return ' '+paintConversationRow(row,color,palette)+(track?' '.repeat(Math.max(0,box-2-displayWidth(row.text)))+muted(index>=thumbTop&&index<thumbTop+thumb?'┃':'│'):'');
      }
      return line(' '+t);
    })];
    this.tabButtons=[];
    if(this.tabs) {
      let strip='';const tabList=this.tabs();
      for(const tab of tabList) {
        const label=`[${tab.selected?'●':'○'} ${tab.id} ${tab.state}] `;
        if(displayWidth(strip+label)>box-5)break;
        this.tabButtons.push({action:`agent:${tab.id}`,x:left+1+displayWidth(strip),y:top+1,width:displayWidth(label)});strip+=label;
      }
      this.tabButtons.push({action:'newAgent',x:left+1+displayWidth(strip),y:top+1,width:3});
      rows[0]=accent(strip+'[+]');
    }
    const number = value => Number(value || 0).toLocaleString('en-US');
    const usage = s.used ? `사용 ${number(s.used)} / ${number(s.budget)} 토큰${s.usageEstimated ? ' (추정 포함)' : ''}` : `예산 ${number(s.budget)} 토큰`;
    if(this.communicationTimer && !this.settingsView && !this.overlay) rows.push(accent(line(` ${this.communicationLabel()}${this.queuedPrompt?' · 다음 요청 대기 중':''} · Ctrl+C 취소`)));
    else rows.push(muted(line(` ${all.length>bodyHeight ? `${start+1}–${end}/${all.length} · 휠/PgUp · ${this.scroll?'최신 Ctrl+End':'처음 Ctrl+Home'} · ` : ''}${usage}${s.estimate ? ` · 입력 약 ${number(s.estimate)}` : ''}`)));
    for(const option of options.slice(0,menuHeight)) {
      const selected=option===menu[this.menuIndex];
      const description=!this.overlay&&!pending?.choices ? commandPalette.find(([command])=>command===option)?.[1] : '';
      const value=line(`${selected?' ›':'  '} ${option}${description?'  '+description:''}`);
      rows.push(selected?surface(value):muted(value));
    }
    this.cardButtons=[];
    const cardActions=items=>{
      let used=1;const parts=[];
      for(const [action,label,enabled] of items){const width=displayWidth(label);if(used+width>box)break;
        if(enabled)this.cardButtons.push({action,x:left+used+1,y:rows.length+1,width});
        parts.push(enabled?surface(label):muted(label));parts.push(' ');used+=width+1;
      }rows.push(' '+parts.join(''));
    };
    if(cards&&this.queuedPrompt){
      rows.push(muted(line(` 다음 요청 · ${safe(this.queuedPrompt.text).replace(/\n/g,' ↵ ')}`)));
      cardActions([['unqueue','[수정]',true],['dropqueue','[삭제]',true]]);
    }
    if(cards&&this.failure){
      rows.push(muted(line(' 요청이 중단되었습니다 · 다시 실행 전 변경 내용을 확인하세요')));
      cardActions([['retry','[재시도]',Boolean(pending)],['editfailed','[요청 수정]',Boolean(pending)],['settings','[모델 변경]',Boolean(pending)]]);
    }
    if(cards&&this.changes.size)cardActions([['changes',`[파일 도구 변경 ${this.changes.size}개 · 보기]`,Boolean(pending)]]);
    if(showReview){rows.push(muted(line(` 최근 검증 · ${this.reviewLabel}`)));cardActions([['reviewshow','[결과 보기]',Boolean(pending)],['review','[다시 검사]',Boolean(pending)]]);}
    const inputTop=rows.length;
    const title = this.overlay ? (this.overlay.kind === 'history' ? '입력 기록 검색' : this.overlay.kind === 'files' ? '첨부 파일 검색' : this.overlay.kind === 'changes' ? '변경 파일 검색 · Enter 상세' : '명령 검색') : pending?.hidden ? 'API 키 · 숨김 입력' : pending && !pending.normal ? pending.label : (this.multiline ? '여러 줄 작성' : '');
    const label = title ? fit(` ${title} `,box-2) : '';
    rows.push(border(`╭${label}${'─'.repeat(Math.max(0,box-2-displayWidth(label)))}╮`));
    for(let i=0;i<inputHeight;i++) {
      const placeholder=!draft && i===0 && !pending?.hidden && (!pending || pending.normal) && !this.overlay;
      const value=placeholder ? (!pending ? '다음 요청을 미리 적어두세요…' : '만들고 싶은 것을 설명해주세요…') : draftLines[first+i]||'';
      const content=fit(value,box-4);
      rows.push(`${border('│')}${surface('  '+content+' '.repeat(Math.max(0,box-4-displayWidth(content))))}${border('│')}`);
    }
    this.buttons=[];
    if(toolbar) {
      const compact=box<65;
      const primary=pending
        ? {action:'send',label:'[↑ 전송]',enabled:Boolean(this.buffer.trim()),primary:true}
        : this.queuedPrompt
          ? {action:'unqueue',label:box<40?'[↶ 수정]':'[↶ 대기 수정]',enabled:true,primary:true}
          : {action:'queue',label:box<40?'[↓ 대기]':'[↓ 다음 요청]',enabled:Boolean(this.buffer.trim()),primary:true};
      const actions=[...(!pending?[{action:'stop',label:'[■ 중단]',enabled:true}]:[]),primary];
      const more={action:'more',label:this.moreActions?'[×]':'[+]',enabled:true};
      const items=[more,...(this.moreActions ? [
        {action:'review',label:'[검증]',enabled:Boolean(pending)},
        {action:'approval',label:'[승인]',enabled:Boolean(pending)},
        {action:'style',label:'[스타일]',enabled:Boolean(pending)},
        ...(this.tabs?[{action:'newAgent',label:'[새 에이전트]',enabled:true}]:[]),
        {action:'paste',label:'[붙여넣기]',enabled:!this.pasteLoading},
        {action:'copy',label:'[복사]',enabled:!this.copying},
        {action:'preview',label:compact?'[웹]':'[미리보기]',enabled:Boolean(pending)},
        {action:'attach',label:'[첨부]',enabled:Boolean(pending)}
      ] : [
        {action:'skills',label:s.skill?'[스킬 ✓]':'[스킬]',enabled:Boolean(pending)},
        {action:'mode',label:`[${s.mode==='PLAN'?'계획':'빌드'} ▾]`,enabled:Boolean(pending)},
        {action:'settings',label:compact?'[모델 ▾]':`[${fit(s.model||'모델 연결',20)} ▾]`,enabled:Boolean(pending)}
      ]),...actions];
      const chip=item=>{
        if(!color)return item.label;
        const style=!item.enabled?palette.disabled:item.primary?palette.primary:palette.button;
        return `\x1b[${style}m ${item.label.slice(1,-1)} \x1b[0m`;
      };
      let used=0;const segments=[];
      const visibleItems=box<40?items.filter(item=>item.action==='more'||actions.includes(item)):items;
      for(const item of visibleItems) {
        const width=displayWidth(item.label);
        const remaining=actions.slice(actions.includes(item)?actions.indexOf(item)+1:0);
        const reserve=remaining.reduce((n,action)=>n+displayWidth(action.label)+1,0);
        if(used+width+reserve>box-4)continue;
        const gap=item===actions[0]?Math.max(0,box-4-used-width-reserve):0;
        segments.push(surface(' '.repeat(gap)));used+=gap;
        if(item.enabled)this.buttons.push({action:item.action,x:left+4+used,y:top+rows.length+1,width});
        segments.push(chip(item));used+=width;
        if(used<box-4){segments.push(surface(' '));used++;}
      }
      rows.push(border('│')+surface('  ')+segments.join('')+surface(' '.repeat(Math.max(0,box-4-used)))+border('│'));
    }
    const positionLabel=draftLines.length>1 ? ` ${cursorRow+1}/${draftLines.length}줄 ` : '';
    const bottom=fit(positionLabel,box-2);
    rows.push(border(`╰${'─'.repeat(Math.max(0,box-2-displayWidth(bottom)))}${bottom}╯`));
    rows.push(muted(line(this.hint||this.shortcuts())));
    const visible=Array.from({length:screenHeight},(_,i)=>i>=top && i<top+h ? ' '.repeat(left)+(rows[i-top]||'') : '');
    if(color){const base=`\x1b[${palette.base}${this.appearance.weight==='bold'?';1':''}m`;for(let i=0;i<visible.length;i++)visible[i]=base+visible[i].replaceAll('\x1b[0m','\x1b[0m'+base)+'\x1b[K\x1b[0m';}
    const rendered=visible.map((r,i)=>r===this.renderedRows[i] ? '' : `\x1b[${i+1};1H\x1b[2K${r}`).join('');
    this.renderedRows=visible;
    const cursorY=top+Math.min(h-1,inputTop+2+cursorRow-first);
    const cursorX=left+Math.min(box,4+position.col);
    this.output.write(`\x1b[?25l\x1b[H${rendered}\x1b[${cursorY};${cursorX}H\x1b[?25h`);
  }
  close() {
    if(this.closed)return;
    clearInterval(this.communicationTimer); this.communicationTimer = null;
    if(this.pending)this.finish(undefined,new Error('Closed.'));
    this.closed=true;this.input.off('keypress',this.keyListener);this.input.off('end',this.endListener);this.output.off('resize',this.resizeListener);
    this.input.setRawMode?.(this.oldRaw);this.input.pause();
    this.output.write('\x1b[?1000l\x1b[?1006l\x1b[?2004l\x1b[?25h\x1b[?1049l');this.emit('close');
  }
}
