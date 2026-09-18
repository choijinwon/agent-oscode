import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const codexHome=()=>path.join(os.homedir(),'.oscode','codex');
export const bridgeConfig={
 'approval_policy':'never','sandbox_mode':'read-only','web_search':'disabled',
 'cli_auth_credentials_store':'file','forced_login_method':'chatgpt',
 'features.shell_tool':false,'features.unified_exec':false,'features.apps':false,
 'features.multi_agent':false,'features.hooks':false,'features.browser_use':false,
 'features.computer_use':false,'features.image_generation':false,'features.view_image':false,
 'features.code_mode':false,'features.code_mode_host':false,'features.memories':false,
 'features.skill_search':false,'features.skip_host_skill_discovery':true,
 'features.remote_plugin':false,'features.tool_suggest':false,
 'features.workspace_dependencies':false,'features.sleep_tool':false,
 'features.goals':false,'features.shell_snapshot':false,'analytics.enabled':false
};
export class CodexClient extends EventEmitter {
 constructor(child){
  super();this.child=child;this.pending=new Map();this.sequence=0;this.buffer='';this.closed=false;
  child.stdout.setEncoding('utf8');child.stdout.on('data',data=>{
   this.buffer+=data;
   if(this.buffer.length>4000000){this.fail(new Error('Codex 응답 크기 초과'));return;}
   let at;
   while((at=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,at);this.buffer=this.buffer.slice(at+1);if(!line.trim())continue;
    let message;try{message=JSON.parse(line);}catch{this.fail(new Error('Codex 프로토콜 응답 오류'));return;}
    if(message.method && message.id!==undefined) { // No native tools or permission escalation in the model bridge.
     this.send({id:message.id,error:{code:-32601,message:'Native tool requests are disabled; return OSCODE actions in the output schema.'}});
    } else if(message.id!==undefined) {
     const job=this.pending.get(message.id);if(job){this.pending.delete(message.id);job.cleanup();message.error ? job.reject(new Error('Codex 요청 실패. 로그인·모델·런타임 버전을 확인하세요.')) : job.resolve(message.result);}
    } else if(message.method)this.emit('notification',message);
   }
  });
  child.stderr.resume(); // Do not forward raw runtime/auth logs into chat.
  child.stdin.on('error',()=>this.fail(new Error('Codex 연결 종료')));
  child.on('error',()=>this.fail(new Error('Codex 실행 실패. npm install 후 다시 시도하세요.')));
  child.on('exit',()=>this.fail(new Error('Codex 프로세스가 종료되었습니다.')));
 }
 send(value){if(!this.closed)this.child.stdin.write(JSON.stringify(value)+'\n');}
 request(method,params={},signal,timeout=30000){
  if(this.closed || signal?.aborted)return Promise.reject(new Error('Codex 요청 취소/종료'));
  return new Promise((resolve,reject)=>{
   const id=++this.sequence;
   const stop=()=>{this.pending.delete(id);cleanup();reject(new Error('Codex 요청 취소 또는 시간 초과'));};
   const timer=setTimeout(stop,timeout);const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);};
   this.pending.set(id,{resolve,reject,cleanup});signal?.addEventListener('abort',stop,{once:true});this.send({id,method,params});
  });
 }
 wait(method,predicate=()=>true,signal,timeout=180000){
  if(this.closed || signal?.aborted)return Promise.reject(new Error('Codex 대기 취소/종료'));
  return new Promise((resolve,reject)=>{
   const cleanup=()=>{clearTimeout(timer);this.off('notification',receive);this.off('closed',failed);signal?.removeEventListener('abort',stop);};
   const receive=message=>{if(message.method===method && predicate(message.params)){cleanup();resolve(message.params);}};
   const failed=error=>{cleanup();reject(error);};const stop=()=>failed(new Error('Codex 대기 취소 또는 시간 초과'));
   const timer=setTimeout(stop,timeout);this.on('notification',receive);this.once('closed',failed);signal?.addEventListener('abort',stop,{once:true});
  });
 }
 fail(error){if(this.closed)return;this.closed=true;for(const job of this.pending.values()){job.cleanup();job.reject(error);}this.pending.clear();this.emit('closed',error);this.child.kill();}
 async close(){
  this.fail(new Error('Codex 연결을 닫았습니다.'));
  if(this.child.exitCode!==null || this.child.signalCode)return;
  await new Promise(resolve=>{const timer=setTimeout(()=>{this.child.kill('SIGKILL');resolve();},1000);this.child.once('exit',()=>{clearTimeout(timer);resolve();});});
 }
}
export async function startCodex({home=codexHome(),signal,spawnImpl=spawn}={}){
 await fs.mkdir(home,{recursive:true,mode:0o700});
 if((await fs.lstat(home)).isSymbolicLink() || (await fs.realpath(home))!==path.resolve(home))throw new Error('Codex 인증 폴더는 실제 경로여야 합니다.');
 await fs.chmod(home,0o700);
 const cwd=await fs.mkdtemp(path.join(home,'bridge-'));
 let runtime;try{runtime=path.join(path.dirname(createRequire(import.meta.url).resolve('@openai/codex/package.json')),'bin/codex.js');}catch{throw new Error('공식 Codex 런타임이 없습니다. npm install을 실행하세요.');}
 const env={};for(const key of ['PATH','HOME','USER','TMPDIR','TEMP','TMP','SystemRoot','APPDATA','LOCALAPPDATA'])if(process.env[key])env[key]=process.env[key];
 env.CODEX_HOME=home;
 const args=[runtime,'app-server','--listen','stdio://',...Object.entries(bridgeConfig).flatMap(([key,value])=>['-c',`${key}=${JSON.stringify(value)}`])];
 const client=new CodexClient(spawnImpl(process.execPath,args,{cwd,env,stdio:['pipe','pipe','pipe']}));client.cwd=cwd;
 const close=client.close.bind(client);client.close=async()=>{await close();await fs.rm(cwd,{recursive:true,force:true});};
 try{await client.request('initialize',{clientInfo:{name:'oscode',title:'OSCODE',version:'0.9.1'},capabilities:{experimentalApi:true}},signal);client.send({method:'initialized',params:{}});return client;}
 catch(error){await client.close();throw error;}
}
