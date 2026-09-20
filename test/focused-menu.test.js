import test from 'node:test';import assert from 'node:assert/strict';
import {searchCommands,primaryCommands} from '../src/command-palette.js';
import {completeCommand} from '../src/chat-console.js';
test('default menu is focused while secondary features remain searchable',()=>{
 assert.equal(primaryCommands.length,8);assert.deepEqual(completeCommand('/')[0],primaryCommands);
 assert.deepEqual(searchCommands('').map(item=>item[0]),primaryCommands);
 assert(searchCommands('ocr').some(item=>item[0]==='/ocr '));assert(!searchCommands('').some(item=>item[0]==='/ocr '));
 assert(completeCommand('/style')[0].includes('/style'));
});
