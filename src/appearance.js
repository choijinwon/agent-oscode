import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export const defaultAppearance={theme:'dark',weight:'normal',format:'markdown'};
const values={theme:['dark','light','contrast'],weight:['normal','bold'],format:['markdown','plain']};
export function appearance(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!values[key]))throw new Error('잘못된 화면 설정입니다.');
 const result={...defaultAppearance,...value};
 for(const key of Object.keys(values))if(!values[key].includes(result[key]))throw new Error(`지원하지 않는 화면 설정: ${key}`);
 return result;
}
export const palettes={
 dark:{base:'38;5;252;48;5;234',accent:'1;37',muted:'38;5;245',border:'38;5;240',surface:'48;5;235',code:'48;5;235;38;5;189',user:'48;5;237;37',button:'38;5;250;48;5;235',disabled:'38;5;242;48;5;235',primary:'1;38;5;232;48;5;255'},
 light:{base:'38;5;235;48;5;255',accent:'1;38;5;232',muted:'38;5;240',border:'38;5;245',surface:'48;5;253',code:'48;5;253;38;5;54',user:'48;5;250;38;5;232',button:'38;5;235;48;5;253',disabled:'38;5;245;48;5;253',primary:'1;38;5;255;48;5;235'},
 contrast:{base:'97;40',accent:'1;97',muted:'97',border:'97',surface:'40',code:'93;40',user:'30;107',button:'97;40',disabled:'90;40',primary:'1;30;107'}
};
async function folder(root,create=false){
 const dir=path.join(root,'.oscode');if(create)await fs.mkdir(dir,{recursive:true});
 try{const stat=await fs.lstat(dir);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('.oscode는 실제 폴더여야 합니다.');}
 catch(error){if(error.code==='ENOENT'&&!create)return null;throw error;}return dir;
}
export async function readAppearance(root){
 const dir=await folder(root);if(!dir)return {...defaultAppearance};
 try{const file=path.join(dir,'ui.json'),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4096)throw new Error('ui.json 형식을 확인하세요.');return appearance(JSON.parse(await fs.readFile(file,'utf8')));}
 catch(error){if(error.code==='ENOENT')return {...defaultAppearance};throw error;}
}
export async function saveAppearance(root,value){
 const data=appearance(value),dir=await folder(root,true),file=path.join(dir,'ui.json'),temp=path.join(dir,`.ui-${randomUUID()}.tmp`);
 try{await fs.writeFile(temp,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});await fs.rename(temp,file);}
 finally{await fs.rm(temp,{force:true});}
}
export async function appearanceUI(ui,{signal,save=async()=>{}}={}){
 const original={...ui.appearance};let applied=false;
 try{
  while(true){
   const action=await ui.choose('글자·화면 스타일 · 변경 미리보기',[
    {value:'theme',label:`테마 · ${ui.appearance.theme}`},{value:'weight',label:`글자 굵기 · ${ui.appearance.weight}`},
    {value:'format',label:`답변 서식 · ${ui.appearance.format}`},{value:'apply',label:'저장하고 닫기'},{value:'cancel',label:'취소 · 원래 스타일로'}
   ],{signal});
   if(action==='cancel')return false;
   if(action==='apply'){await save(ui.appearance);applied=true;return true;}
   const labels={theme:['다크','라이트','고대비'],weight:['기본','굵게'],format:['서식 적용 · 제목·표·코드','원문 · Markdown 그대로']};
   if(!values[action])continue;
   const value=await ui.choose('스타일 선택 · Enter 미리보기',values[action].map((value,i)=>({value,label:labels[action][i]})),{signal});
   ui.appearance=appearance({...ui.appearance,[action]:value});ui.renderedRows=[];ui.render();
  }
 }finally{if(!applied)ui.appearance=original;ui.renderedRows=[];ui.render();}
}
