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
 const draft={provider:config.provider,baseUrl:config.baseUrl || defaultBase(config.provider),model:config.model || ''};
 let newKey, notice='항목을 선택해 변경한 뒤 적용하세요.';
 const options={signal};
 const check=()=>{if(signal?.aborted)throw new Error('Cancelled.');};
 try {
  while(true) {
   check();
   ui.settingsView={...draft,keyStatus:newKey ? '변경 대기' : readKey(draft.provider,draft.baseUrl) ? '저장됨' : '미설정',notice};ui.render();
   const action=await ui.choose('설정 · ↑↓ 선택 / Enter 열기',[
    {value:'provider',label:'공급자 변경'}, {value:'model',label:'모델 검색·선택'},
    {value:'address',label:'API 주소 변경'}, {value:'key',label:'API 키 입력 (숨김)'},
    {value:'apply',label:'적용하고 닫기'}, {value:'cancel',label:'취소 · 변경 버리기'}
   ],options);
   check();
   if(action==='cancel')return false;
   try {
    if(action==='provider') {
     const id=await ui.choose('공급자 선택',presets,options);const preset=presets.find(p=>p.value===id);
     if(preset) { const base=preset.baseUrl || (await ui.question('API 주소: ',options)).trim();endpoint(base,'models');
      if(draft.provider!==preset.provider || draft.baseUrl!==base) {draft.provider=preset.provider;draft.baseUrl=base;draft.model='';newKey=undefined;}
     }
    } else if(action==='address') {
     const base=(await ui.question(`API 주소 [${draft.baseUrl}]: `,options)).trim() || draft.baseUrl;endpoint(base,'models');
     if(base!==draft.baseUrl) {draft.baseUrl=base;draft.model='';newKey=undefined;}
    } else if(action==='key') {
     const key=(await ui.questionHidden('API 키 입력 · Enter 확인: ',options)).trim();
     if(!key || key.length>8192 || /[\s\x00-\x1f\x7f]/.test(key))throw new Error('키 형식을 확인하세요.');
     newKey=key;
    } else if(action==='model') {
     let models=[];notice='목록 조회 중…';ui.settingsView.notice=notice;ui.render();
     try {const result=await discover({...draft,key:newKey,signal});models=result.models;notice=result.partial ? '일부 목록 표시 · 직접 입력 가능' : '모델 목록 조회 완료';}
     catch(error) {check();notice=error.message;}
     ui.settingsView.notice=notice;ui.render();
     let model=await chooseModel(ui,models,draft.model,signal,()=>{});
     if(!model)model=(await ui.question('모델 ID 직접 입력: ',options)).trim();
     if(!model)throw new Error('모델을 선택하세요.');draft.model=model;
    } else if(action==='apply') {
     if(!draft.model)throw new Error('먼저 모델을 선택하세요.');endpoint(draft.baseUrl,'models');check();
     if(newKey)writeKey(draft.provider,draft.baseUrl,newKey);
     Object.assign(config,draft);return true;
    }
   } catch(error) {check();notice=error.message;}
  }
 } finally {ui.settingsView=null;ui.render();}
}
