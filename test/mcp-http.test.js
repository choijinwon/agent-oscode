import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {connectRemote,oauthSession,guardedFetch} from '../src/mcp-http.js';
import {validateMcpServer} from '../src/mcp.js';
async function listen(t,handler){const s=http.createServer(handler);await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>{s.closeAllConnections();s.close();});return `http://127.0.0.1:${s.address().port}`;}
test('remote MCP initializes, lists and calls tools with an explicit bearer token',async t=>{
 let count=0;
 const url=await listen(t,async(req,res)=>{
  assert.equal(req.headers.authorization,'Bearer fixture-token');
  if(req.method!=='POST'){res.writeHead(405).end();return;}
  const server=new Server({name:'fixture',version:'1'},{capabilities:{tools:{}}});
  server.setRequestHandler(ListToolsRequestSchema,()=>({tools:[{name:'ping',inputSchema:{type:'object'}}]}));
  server.setRequestHandler(CallToolRequestSchema,()=>{count++;return {content:[{type:'text',text:'pong'}]};});
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  res.on('close',()=>{transport.close();server.close();});await server.connect(transport);await transport.handleRequest(req,res);
 });
 process.env.OSCODE_MCP_TEST_TOKEN='fixture-token';t.after(()=>delete process.env.OSCODE_MCP_TEST_TOKEN);
 const {client,cleanup}=await connectRemote({url:url+'/mcp',tokenEnv:'OSCODE_MCP_TEST_TOKEN'});t.after(async()=>{await client.close();cleanup();});
 assert.equal((await client.listTools()).tools[0].name,'ping');assert.equal((await client.callTool({name:'ping',arguments:{}})).content[0].text,'pong');assert.equal(count,1);
});
test('OAuth callback validates state, keeps credentials in memory and closes on cancellation',async t=>{
 const c=new AbortController();let opened;
 const session=await oauthSession({signal:c.signal,open:async u=>{opened=u;}});t.after(()=>session.close());
 await session.provider.redirectToAuthorization(new URL('https://example.com/auth'));
 assert.equal(opened,'https://example.com/auth');
 const bad=await fetch(session.provider.redirectUrl+'?state=wrong&code=bad');assert.equal(bad.status,400);
 const good=await fetch(session.provider.redirectUrl+`?state=${session.provider.state()}&code=ok`);assert.equal(good.status,200);assert.equal(await session.code,'ok');
 session.provider.saveTokens({access_token:'secret',token_type:'Bearer'});session.close();assert.equal(session.provider.tokens(),undefined);
 const cancelled=await oauthSession({signal:c.signal});t.after(()=>cancelled.close());c.abort();await assert.rejects(cancelled.code,/취소/);
});
test('remote config and redirect restrictions prevent insecure or ambiguous credentials',async t=>{
 for(const s of [{url:'http://external.test/mcp'},{url:'https://user:secret@example.com/mcp'},{url:'https://example.com/mcp?key=secret'},{url:'https://example.com',command:'node'},{url:'https://example.com',oauth:true,tokenEnv:'TOKEN'}])assert.throws(()=>validateMcpServer(s));
 validateMcpServer({url:'https://example.com/mcp',oauth:true});
 const url=await listen(t,(req,res)=>res.writeHead(302,{Location:'https://example.com'}).end());await assert.rejects(guardedFetch(url));
 await assert.rejects(connectRemote({url,tokenEnv:'OSCODE_NONEXISTENT_TEST_TOKEN'}));
});
test('OAuth discovery, browser redirect, PKCE token exchange and authenticated reconnect',async t=>{
 let base,challenge,registered,exchanged=false;
 base=await listen(t,async(req,res)=>{
  const u=new URL(req.url,base);const json=v=>{res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(v));};
  if(u.pathname.startsWith('/.well-known/oauth-protected-resource'))return json({resource:base+'/mcp',authorization_servers:[base]});
  if(u.pathname.startsWith('/.well-known/oauth-authorization-server'))return json({issuer:base,authorization_endpoint:base+'/authorize',token_endpoint:base+'/token',registration_endpoint:base+'/register',response_types_supported:['code'],grant_types_supported:['authorization_code'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none']});
  if(u.pathname==='/register'){let body='';for await(const chunk of req)body+=chunk;registered=JSON.parse(body);return json({...registered,client_id:'fixture-client'});}
  if(u.pathname==='/token'){
   let body='';for await(const chunk of req)body+=chunk;const params=new URLSearchParams(body);
   assert.equal(params.get('code'),'fixture-code');const {createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(params.get('code_verifier')).digest('base64url'),challenge);
   exchanged=true;return json({access_token:'oauth-token',token_type:'Bearer',expires_in:3600});
  }
  if(u.pathname==='/mcp'){
   if(req.headers.authorization!=='Bearer oauth-token'){res.writeHead(401,{'WWW-Authenticate':`Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`}).end();return;}
   if(req.method!=='POST'){res.writeHead(405).end();return;}
   const server=new Server({name:'oauth-fixture',version:'1'},{capabilities:{tools:{}}});server.setRequestHandler(ListToolsRequestSchema,()=>({tools:[]}));
   const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});res.on('close',()=>{transport.close();server.close();});await server.connect(transport);return transport.handleRequest(req,res);
  }
  res.writeHead(404).end();
 });
 const connection=await connectRemote({url:base+'/mcp',oauth:true},undefined,{open:async value=>{
  const u=new URL(value);assert.equal(u.pathname,'/authorize');challenge=u.searchParams.get('code_challenge');assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('redirect_uri'),registered.redirect_uris[0]);
  await fetch(u.searchParams.get('redirect_uri')+`?code=fixture-code&state=${u.searchParams.get('state')}`);
 }});
 t.after(async()=>{await connection.client.close();connection.cleanup();});assert(exchanged);assert.deepEqual((await connection.client.listTools()).tools,[]);
});
