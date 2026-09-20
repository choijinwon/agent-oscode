import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs/promises';
const server=new Server({name:'oscode-project-example',version:'1.0.0'},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:'project_info',description:'Read package name, scripts and dependency names from the current project.',inputSchema:{type:'object',properties:{},additionalProperties:false}}]}));
server.setRequestHandler(CallToolRequestSchema,async req=>{
 if(req.params.name!=='project_info')throw Error('Unknown tool');
 const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
 return {content:[{type:'text',text:JSON.stringify({name:pkg.name,scripts:pkg.scripts,dependencies:Object.keys(pkg.dependencies||{})})}]};
});
await server.connect(new StdioServerTransport());
