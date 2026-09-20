import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {McpHub,validateMcpServer} from '../src/mcp.js';import {WorkspaceTools} from '../src/tools.js';
import {runTurn} from '../src/agent.js';import {newSession} from '../src/session.js';import {resolveConfig} from '../src/config.js';
const server=path.resolve('examples/mcp/project-server.js');
async function fixture(t){const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'oscode-mcp-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.writeFile(path.join(root,'package.json'),JSON.stringify({name:'fixture',scripts:{test:'node --test'}}));let approvals=0;const tools=new WorkspaceTools(root,{approve:async()=>{approvals++;return true;}});const hub=tools.mcp=new McpHub(tools);t.after(()=>hub.close());return {root,tools,hub,approvals:()=>approvals};}
test('stdio handshake, selection, input validation, PLAN and model dispatch work with real server',async t=>{
 const {hub,tools,approvals,root}=await fixture(t);
 await hub.add('project',{command:process.execPath,args:[server],readOnlyTools:['project_info']});
 await hub.connect('project');assert.equal(hub.definitions().length,0);hub.select('project','project_info');const name=hub.definitions()[0].name;
 assert((await tools.execute(name,{})).content.includes('fixture'));assert(approvals()>=3);
 assert((await tools.execute(name,{unexpected:1})).is_error);
 tools.readOnly=true;assert.equal(hub.definitions(true).length,1);assert(!(await tools.execute(name,{})).is_error);
 await assert.rejects(hub.connect('project'),/BUILD/);
 let calls=0;
 await runTurn({session:newSession(root),prompt:'Read project via selected MCP',config:resolveConfig({}, {plan:true},{}),tools,signal:new AbortController().signal,provider:{complete:async req=>{assert(req.tools.some(t=>t.name===name));return {content:++calls===1?'':'Project inspected',calls:calls===1?[{id:'m',name,input:{}}]:[],usage:{input:10,output:10,requests:1}};}}});
 assert.equal(calls,2);
 await hub.disconnect('project');assert.equal(hub.definitions().length,0);
});
test('untrusted tools do not become PLAN tools and denied approvals prevent calls',async t=>{
 const {hub,tools}=await fixture(t);await hub.add('project',{command:process.execPath,args:[server]});await hub.connect('project');hub.select('project','project_info');const name=hub.definitions()[0].name;
 tools.readOnly=true;assert.equal(hub.definitions(true).length,0);assert((await tools.execute(name,{})).is_error);
 tools.readOnly=false;tools.approve=async()=>false;assert((await tools.execute(name,{})).is_error);
 await hub.command('off');assert.equal(hub.definitions().length,0);
});
test('config validation and permission denial prevent server execution',async t=>{
 assert.throws(()=>validateMcpServer({command:'node',env:{TOKEN:'secret'}}));assert.throws(()=>validateMcpServer({command:'node',envNames:['bad-name']}));
 const {hub,tools,root}=await fixture(t);tools.permissions.write='deny';await assert.rejects(hub.add('local',{command:'node'}),/권한/);
 tools.permissions.write='ask';await hub.add('local',{command:process.execPath,args:[server]});tools.permissions.shell='deny';await assert.rejects(hub.connect('local'),/권한/);
 const file=path.join(root,'.oscode/mcp.json');await fs.unlink(file);await fs.symlink(path.join(root,'package.json'),file);await assert.rejects(hub.config(),/설정/);
});
test('registration preserves argument whitespace and cancellation does not call a server',async t=>{
 const {hub,tools}=await fixture(t);
 await hub.command('add spaces {"command":"node","args":["a  b.js"]}');assert.deepEqual((await hub.config()).servers.spaces.args,['a  b.js']);
 await hub.add('project',{command:process.execPath,args:[server]});await hub.connect('project');hub.select('project','project_info');
 const result=await tools.execute(hub.definitions()[0].name,{},AbortSignal.abort());assert(result.is_error);assert.match(result.content,/Cancelled/);
});
