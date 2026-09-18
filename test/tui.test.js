import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { ConsoleUI, wrapText, cursorPositions } from '../src/tui.js';
import { chatPrompt } from '../src/terminal-view.js';
function fixture(t){
 const input=new PassThrough();input.isTTY=true;input.isRaw=false;input.setRawMode=value=>{input.isRaw=value;};
 let outputText='';const output=new Writable({write(c,_e,cb){outputText+=c;cb();}});output.columns=60;output.rows=18;
 const ui=new ConsoleUI({input,output,status:()=>({budget:10000,used:300,estimate:10,model:'test'})});
 t.after(()=>ui.close());return {ui,input,output,text:()=>outputText,clear:()=>{outputText='';}};
}
test('fixed input supports bracketed multiline paste without executing command text',async t=>{
 const {ui,input}=fixture(t);let done=false;
 const answer=ui.question(chatPrompt).then(v=>{done=true;return v;});
 input.write('\x1b[200~/exit\nhello\nworld\x1b[201~');
 await new Promise(r=>setImmediate(r));assert.equal(done,false);assert.equal(ui.buffer,'/exit\nhello\nworld');
 input.write('\r');assert.equal(await answer,'/exit\nhello\nworld');assert.equal(ui.lastInputWasPaste,true);
});
test('smart scroll preserves viewport while output arrives and supports jump to latest',t=>{
 const {ui}=fixture(t);ui.append(Array.from({length:70},(_,i)=>`line ${i}`).join('\n'));
 ui.key('',{name:'pageup'});const end=ui.lines().length-ui.scroll;
 ui.append('\nnew output\nmore output');assert.equal(ui.lines().length-ui.scroll,end);
 ui.key('',{ctrl:true,name:'end'});assert.equal(ui.scroll,0);
});
test('menu selects before sending and multiline cursor stays visible after resize',async t=>{
 const {ui,input,output}=fixture(t);const answer=ui.question(chatPrompt);
 input.write('/set');ui.key('',{name:'tab'});input.write('\r');assert.equal(ui.buffer,'/settings');assert(ui.pending);
 input.write('\r');assert.equal(await answer,'/settings');
 const next=ui.question(chatPrompt);input.write('한글'.repeat(80));const before=ui.buffer;output.columns=26;output.emit('resize');
 assert.equal(ui.buffer,before);ui.key('',{name:'up'});assert(ui.cursor<160);
 input.write('\r');assert.equal(await next,before);
});
test('hidden setting never enters transcript; cancel restores unsent draft and closes raw mode',async t=>{
 const {ui,input,text}=fixture(t);ui.buffer='unsent';ui.cursor=6;
 const controller=new AbortController();const answer=ui.questionHidden('Key:',{signal:controller.signal});
 input.write('fake-api-secret');assert(!text().includes('fake-api-secret'));assert(!JSON.stringify(ui.entries).includes('fake-api-secret'));
 controller.abort();await assert.rejects(answer,/Cancelled/);assert.equal(ui.buffer,'unsent');ui.close();assert.equal(input.isRaw,false);assert(text().includes('\x1b[?1049l'));
});
test('logs expand and review panel preserves proposed changes until explicit approval',async t=>{
 const {ui,input}=fixture(t);ui.log('read complete','long tool body');assert(!ui.lines().join('').includes('long tool body'));
 ui.key('',{name:'f2'});assert(ui.lines().join('').includes('long tool body'));
 ui.preview('--- before\nold\n+++ after\nnew');const response=ui.question('변경 적용 승인 y / 취소 n: ');input.write('n\r');assert.equal(await response,'n');assert.equal(ui.panel,'변경 검토');
});
test('CJK wrapping and cursor positions use display cells',()=>{
 assert.deepEqual(wrapText('가나다라',4),['가나','다라']);assert.deepEqual(cursorPositions('가나',4).at(-1),{row:1,col:0});
 assert.deepEqual(cursorPositions('가나\n다',4).at(-1),{row:1,col:2});
});
test('file references complete inside natural language before submission',async t=>{
 const {ui,input}=fixture(t);ui.files=['src/Button.vue','src/Card.svelte'];
 const answer=ui.question(chatPrompt);input.write('수정해줘 @src/B');
 ui.key('',{name:'tab'});input.write('\r');assert.equal(ui.buffer,'수정해줘 @src/Button.vue');assert(ui.pending);
 input.write('\r');assert.equal(await answer,'수정해줘 @src/Button.vue');
});
test('history search restores multiline input without sending and excludes settings secrets',async t=>{
 const {ui,input}=fixture(t);
 let answer=ui.question(chatPrompt);input.write('\x1b[200~한글\n수정 요청\x1b[201~\r');await answer;
 answer=ui.questionHidden('API key');input.write('secret-example\r');await answer;
 answer=ui.question('모델 이름');input.write('private-model\r');await answer;
 const next=ui.question(chatPrompt);input.write('기존 초안');ui.key('',{ctrl:true,name:'r'});input.write('수정');
 assert.equal(ui.choices().length,1);assert.equal(ui.history.length,1);
 input.write('\r');assert.equal(ui.buffer,'한글\n수정 요청');assert(ui.pending);assert.equal(ui.hasPaste,true);
 input.write('\r');assert.equal(await next,'한글\n수정 요청');
});
test('Korean palette inserts commands, Escape preserves drafts, and empty search does not submit',async t=>{
 const {ui,input}=fixture(t);const next=ui.question(chatPrompt);input.write('원래 요청');
 ui.key('',{ctrl:true,name:'p'});input.write('없는명령어');input.write('\r');assert(ui.overlay);assert(ui.pending);
 ui.key('',{name:'escape'});assert.equal(ui.buffer,'원래 요청');
 ui.key('',{ctrl:true,name:'p'});input.write('모델 설정');input.write('\r');assert.equal(ui.buffer,'/settings');assert(ui.pending);
 input.write('\r');assert.equal(await next,'/settings');
});
test('cancel recovery preserves newer drafts and settings disable history shortcuts',async t=>{
 const {ui,input}=fixture(t);ui.buffer='다음 요청';ui.cursor=5;
 ui.recoverPrompt('취소된 요청');assert.equal(ui.buffer,'다음 요청');assert(ui.recovery);
 ui.key('',{name:'f4'});assert.equal(ui.buffer,'다음 요청');
 ui.buffer='';ui.cursor=0;ui.key('',{name:'f4'});assert.equal(ui.buffer,'취소된 요청');assert.equal(ui.recovery,null);
 const key=ui.questionHidden('Key');ui.key('',{ctrl:true,name:'r'});assert.equal(ui.overlay,null);
 assert.match(ui.shortcuts(),/기록하지/);input.write('fake\r');await key;assert.equal(ui.buffer,'취소된 요청');assert.equal(ui.history.length,0);
});
test('cancelled prompt restores immediately when no newer draft exists',t=>{
 const {ui}=fixture(t);ui.recoverPrompt('/exit\ncode',true);assert.equal(ui.buffer,'/exit\ncode');assert.equal(ui.hasPaste,true);
});
test('multiline mode uses Enter for newline and F5 for explicit send; settings remain single-line',async t=>{
 const {ui,input}=fixture(t);const answer=ui.question(chatPrompt);ui.key('',{name:'f3'});
 input.write('첫 줄\r둘째 줄');assert(ui.pending);assert.equal(ui.buffer,'첫 줄\n둘째 줄');
 ui.key('',{name:'f5'});assert.equal(await answer,'첫 줄\n둘째 줄');
 const setting=ui.question('설정');input.write('value\r');assert.equal(await setting,'value');
});
test('completion does not intercept arrows until Tab; line editing preserves surrounding text',async t=>{
 const {ui,input}=fixture(t);const answer=ui.question(chatPrompt);input.write('/set');ui.key('',{name:'down'});assert.equal(ui.menuIndex,-1);
 input.write('\r');assert.equal(await answer,'/set');
 ui.buffer='앞 줄\nhello world\n뒤 줄';ui.cursor=15;
 ui.key('',{ctrl:true,name:'w'});assert.equal(ui.buffer,'앞 줄\nhello \n뒤 줄');
 ui.key('',{ctrl:true,name:'a'});assert.equal(ui.cursor,4);
 ui.key('',{ctrl:true,name:'k'});assert.equal(ui.buffer,'앞 줄\n\n뒤 줄');
});
test('unchanged screen rows are not rewritten on cursor-only movement',t=>{
 const {ui,text,clear}=fixture(t);ui.append('기존 대화');ui.insert('입력');ui.render();clear();ui.key('',{name:'left'});assert(!text().includes('기존 대화'));
});
