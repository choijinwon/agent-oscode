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
 input.write('/set');ui.key('',{name:'down'});input.write('\r');assert.equal(ui.buffer,'/settings');assert(ui.pending);
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
