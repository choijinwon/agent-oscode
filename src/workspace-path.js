import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
export async function workspacePath(value, base=process.cwd()) {
 let input=String(value||'').trim();
 if(input.startsWith('"')) {try{input=JSON.parse(input);}catch{throw new Error('경로 따옴표를 확인하세요.');}}
 if(typeof input!=='string'||!input||input.includes('\0'))throw new Error('폴더 경로를 입력하세요.');
 if(input==='~')input=os.homedir();else if(input.startsWith('~/'))input=path.join(os.homedir(),input.slice(2));
 let root;try{root=await fs.realpath(path.resolve(base,input));}catch{throw new Error('폴더를 찾을 수 없습니다. 경로를 확인하세요.');}
 if(!(await fs.stat(root)).isDirectory())throw new Error('파일이 아닌 폴더를 지정하세요.');
 await fs.access(root,fs.constants.R_OK|fs.constants.X_OK);
 return root;
}
