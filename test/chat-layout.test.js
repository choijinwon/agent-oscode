import test from 'node:test';import assert from 'node:assert/strict';
import {conversationRows,paintConversationRow} from '../src/chat-layout.js';
import {wrapText} from '../src/tui.js';import {displayWidth} from '../src/terminal-view.js';
test('chat renders role alignment, markdown tables and code within terminal width',()=>{
 const entries=[{type:'user',text:'이런 화면으로 만들어줘'},{type:'assistant',text:'# 적용 결과\n\n**한글**과 `code` 설명\n\n| 개선 | 화면 변화 |\n| --- | --- |\n| 입력 | 한글 긴 설명 '.repeat(1)+'반복 '.repeat(10)+'|\n\n```js\nconst text = "hello";\n```'}];
 for(const width of [8,22,58,98]){
  const rows=conversationRows(entries,width,wrapText);assert(rows.every(r=>displayWidth(r.text)<=width));
  assert(rows.some(r=>r.kind==='user'));assert(rows.some(r=>r.kind==='heading'));assert(rows.some(r=>r.kind==='code'));
  assert(!rows.some(r=>r.text.includes('**한글**')));assert(rows.every(r=>!paintConversationRow(r,false).includes('\x1b')));
 }
});
