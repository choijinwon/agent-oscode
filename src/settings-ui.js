import {loginChatGPT, chatgptAccount, chatgptModels, logoutChatGPT} from './codex-provider.js';
import {loginOpenRouter} from './openrouter-login.js';
import {defaultBase, getCredential, setCredential} from './credentials.js';
import {endpoint} from './providers.js';
import {listModels, chooseModel} from './model-list.js';

const presets = [
 {value:'anthropic',label:'Anthropic · Claude',provider:'anthropic',baseUrl:defaultBase('anthropic')},
 {value:'openrouter',label:'OpenRouter · 여러 공급자',provider:'compatible',baseUrl:defaultBase('compatible')},
 {value:'openai',label:'OpenAI 호환 · OpenAI API',provider:'compatible',baseUrl:'https://api.openai.com/v1'},
 {value:'local',label:'로컬 모델 · localhost:1234',provider:'compatible',baseUrl:'http://localhost:1234/v1'},
 {value:'custom',label:'사용자 지정 · OpenAI 호환',provider:'compatible',baseUrl:''}
];
export async function settingsUI(ui, config, signal, dependencies={}) {
 const readKey=dependencies.readKey || getCredential, writeKey=dependencies.writeKey || setCredential;
 const discover=dependencies.discover || listModels;
 const login=dependencies.login || loginOpenRouter;
 const chatLogin=dependencies.chatLogin || loginChatGPT, chatModels=dependencies.chatModels || chatgptModels, chatLogout=dependencies.chatLogout || logoutChatGPT;
 const account=dependencies.account || chatgptAccount;
 const draft={provider:config.provider,baseUrl:config.provider==='chatgpt' ? '' : config.baseUrl || defaultBase(config.provider),model:config.model || ''};
 let connected=false;
 let newKey, notice='항목을 선택해 변경한 뒤 적용하세요.';
 const options={signal};
 const check=()=>{if(signal?.aborted)throw new Error('Cancelled.');};
 try {
  if(draft.provider==='chatgpt') {try{connected=(await account({signal})).connected;}catch(error){check();notice=error.message;}}
  while(true) {
   check();
   ui.settingsView={...draft,keyStatus:draft.provider==='chatgpt' ? (connected ? 'ChatGPT 연결됨 · Codex 관리' : 'ChatGPT 로그인 필요') : newKey ? '변경 대기' : readKey(draft.provider,draft.baseUrl) ? '저장됨' : '미설정',notice};ui.render();
   const action=await ui.choose('설정 · ↑↓ 선택 / Enter 열기',[
    {value:'chatgpt',label:'ChatGPT 계정으로 로그인'},
    ...(draft.provider==='chatgpt' ? [{value:'logout',label:'ChatGPT 연결 해제 (즉시)'}] : []),
    {value:'login',label:'브라우저로 로그인 — OpenRouter'},
    {value:'provider',label:'공급자 변경'}, {value:'model',label:'모델 검색·선택'},
    {value:'address',label:'API 주소 변경'}, {value:'key',label:'API 키 입력 (숨김)'},
    {value:'apply',label:'적용하고 닫기'}, {value:'cancel',label:'취소 · 변경 버리기'}
   ],options);
   check();
   if(action==='cancel')return false;
   try {
    if(action==='chatgpt') {
     notice='브라우저에서 ChatGPT 계정으로 로그인하세요. Ctrl+C 취소';ui.settingsView.notice=notice;ui.render();
     await chatLogin({signal,onURL:url=>{ui.settingsView.loginURL=url;ui.settingsView.notice=notice;ui.render();},onNotice:text=>{if(ui.settingsView){ui.settingsView.notice=text;ui.render();}}});
     check();connected=true;draft.provider='chatgpt';draft.baseUrl='';draft.model='';newKey=undefined;
     notice='ChatGPT 로그인 완료 · 모델 선택 후 적용하세요. 인증은 Codex에 즉시 저장됩니다.';
     ui.settingsView={...draft,keyStatus:'ChatGPT 연결됨 · Codex 관리',notice};ui.render();
     const catalog=await chatModels({signal});draft.model=await chooseModel(ui,catalog.models,'',signal,()=>{});
     if(!draft.model)draft.model=(await ui.question('Codex 모델 ID: ',options)).trim();
    } else if(action==='logout') {
     await chatLogout({signal});connected=false;notice='ChatGPT 연결을 해제했습니다. 설정 취소로 되돌릴 수 없습니다.';
    } else if(action==='login') {
     notice='브라우저에서 OpenRouter 연결을 승인하세요. Ctrl+C 취소';ui.settingsView.notice=notice;ui.render();
     const key=await login({signal,onURL:url=>{ui.append?.(`\nOpenRouter 로그인 주소 (브라우저가 열리지 않으면 직접 열기):\n${url}\n`);ui.settingsView.loginURL=url;ui.settingsView.notice=notice;ui.render();},onNotice:text=>{if(ui.settingsView){ui.settingsView.notice=text;ui.render();}}});
     check();
     const base=defaultBase('compatible');
     if(draft.provider!=='compatible' || draft.baseUrl!==base)draft.model='';
     draft.provider='compatible';draft.baseUrl=base;newKey=key;
     notice='로그인 완료 · 모델을 선택하고 적용하세요. 취소 시 발급된 키는 OpenRouter에서 삭제할 수 있습니다.';
    } else if(action==='provider') {
     const id=await ui.choose('공급자 선택',presets,options);const preset=presets.find(p=>p.value===id);
     if(preset) { const base=preset.baseUrl || (await ui.question('API 주소: ',options)).trim();endpoint(base,'models');
      if(draft.provider!==preset.provider || draft.baseUrl!==base) {draft.provider=preset.provider;draft.baseUrl=base;draft.model='';newKey=undefined;}
     }
    } else if(action==='address') {
     if(draft.provider==='chatgpt')throw new Error('ChatGPT 연결은 공식 Codex 주소를 사용합니다.');
     const base=(await ui.question(`API 주소 [${draft.baseUrl}]: `,options)).trim() || draft.baseUrl;endpoint(base,'models');
     if(base!==draft.baseUrl) {draft.baseUrl=base;draft.model='';newKey=undefined;}
    } else if(action==='key') {
     if(draft.provider==='chatgpt')throw new Error('ChatGPT 인증은 브라우저 로그인으로 관리합니다.');
     const key=(await ui.questionHidden('API 키 입력 · Enter 확인: ',options)).trim();
     if(!key || key.length>8192 || /[\s\x00-\x1f\x7f]/.test(key))throw new Error('키 형식을 확인하세요.');
     newKey=key;
    } else if(action==='model') {
     let models=[];notice='목록 조회 중…';ui.settingsView.notice=notice;ui.render();
     try {const result=draft.provider==='chatgpt' ? await chatModels({signal}) : await discover({...draft,key:newKey,signal});models=result.models;notice=result.partial ? '일부 목록 표시 · 직접 입력 가능' : '모델 목록 조회 완료';}
     catch(error) {check();notice=error.message;}
     ui.settingsView.notice=notice;ui.render();
     let model=await chooseModel(ui,models,draft.model,signal,()=>{});
     if(!model)model=(await ui.question('모델 ID 직접 입력: ',options)).trim();
     if(!model)throw new Error('모델을 선택하세요.');draft.model=model;
    } else if(action==='apply') {
     if(!draft.model)throw new Error('먼저 모델을 선택하세요.');
     if(draft.provider==='chatgpt') {if(!connected)throw new Error('ChatGPT 로그인이 필요합니다.');}else endpoint(draft.baseUrl,'models');check();
     if(newKey)writeKey(draft.provider,draft.baseUrl,newKey);
     Object.assign(config,draft);if(draft.provider==='chatgpt')delete config.baseUrl;return true;
    }
   } catch(error) {check();notice=error.message;}
  }
 } finally {ui.settingsView=null;ui.render();}
}
