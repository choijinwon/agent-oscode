import path from 'node:path';
import {createHash} from 'node:crypto';
import {designMarkup,designCatalog,designAction,designCss} from './design-catalog.js';
import {validateTheme,defaultTheme} from './design-theme.js';
import {detectFrameworks} from './frameworks.js';
import {designMotion} from './design-motion.js';
import {adminAction} from './design-admin-behavior.js';
export const designFrameworks={react:{package:'react',extension:'.jsx',minimum:[18,0]},vue:{package:'vue',extension:'.vue',minimum:[3,5]},angular:{package:'@angular/core',extension:'.ts',minimum:[16,0]},svelte:{package:'svelte',extension:'.svelte',minimum:[5,20]}};
export function validateSelection(s){
 if(!s||Object.keys(s).some(k=>!['item','framework','variant','size','tokens','motion'].includes(k))||!Object.hasOwn(designMarkup,s.item)||!Object.hasOwn(designFrameworks,s.framework))throw Error('디자인과 프레임워크를 선택하세요.');
 if(s.variant!==undefined&&!['solid','soft','outline'].includes(s.variant))throw Error('variant: solid/soft/outline');
 if(s.size!==undefined&&!['small','medium','large'].includes(s.size))throw Error('size: small/medium/large');
 if(s.motion!==undefined&&!['auto','reduced','off'].includes(s.motion))throw Error('motion: auto/reduced/off');
 if(s.tokens)validateTheme(s.tokens);return s;
}
function markupFor(raw,framework){
 let result=raw.replace(/([\w-]+)="__id__([^\"]*)"/g,(_all,attribute,suffix)=>{
  if(framework==='react')return `${attribute==='for'?'htmlFor':attribute}={id + ${JSON.stringify(suffix)}}`;
  if(framework==='vue')return `:${attribute}="id + '${suffix}'"`;
  if(framework==='angular')return `[attr.${attribute}]="id + '${suffix}'"`;
  return `${attribute}={id + ${JSON.stringify(suffix)}}`;
 });
 if(framework==='react')result=result.replace(/\bclass=/g,'className=').replace(/\btabindex=/g,'tabIndex=').replace(/\bautocomplete=/g,'autoComplete=').replace(/\binputmode=/g,'inputMode=').replace(/\benterkeyhint=/g,'enterKeyHint=').replace(/<(input)(\s[^>]*?)?>/g,'<$1$2 />');
 if(framework==='svelte')result=result.replace(/<div class="(oc-table-scroll|oc-admin-table-scroll)"/g,'<!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable region needs keyboard access.) -->\n<div class="$1"');
 return result;
}
export function designRecipe(selection,filename){
 validateSelection(selection);const {item,framework,variant='solid',size='medium',motion='auto',tokens=defaultTheme}=selection;
 const name='Design'+item.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join(''),extension=designFrameworks[framework].extension;
 const file=filename||name+extension;if(path.extname(file)!==extension)throw Error(`출력 확장자는 ${extension}입니다.`);
 const cssFile=path.basename(file,extension)+'.css';
 if(!/^[A-Za-z0-9_-]+\.css$/.test(cssFile))throw Error('파일 이름은 영문·숫자·하이픈·밑줄을 사용하세요.');
 const scope=path.basename(file,extension)+'-'+createHash('sha256').update(file+'\n'+JSON.stringify({...defaultTheme,...tokens})).digest('hex').slice(0,10);
 const mobile=designCatalog.find(x=>x.id===item).platform==='mobile-web';
 const admin=designCatalog.find(x=>x.id===item).platform==='admin-web';
 const html=markupFor(designMarkup[item],framework),attrs=`class="oc-design" data-design="${scope}" data-variant="${variant}" data-size="${size}" data-motion="${motion}"${mobile?' data-mobile="true"':''}${admin?' data-admin="true"':''}`;
 let runtime=designAction.toString();
 const handlerName=admin?'adminDesignAction':'designAction';
 if(admin)runtime+='\n'+designMotion.toString()+'\n'+adminAction.toString()+'\nfunction adminDesignAction(event,emit=()=>{}) { designAction(event,emit); adminAction(event,emit); }';
 if(framework==='angular')runtime=runtime.replace(/function (designAction|adminAction|adminDesignAction)\(event,\s*emit=\(\)=>\{\}\)/g,'function $1(event: Event,emit: (detail: Record<string, unknown>) => void)').replace('function designMotion(root,node)','function designMotion(root: HTMLElement,node: Element | null)').replaceAll('filter(node=>node instanceof HTMLTableRowElement)','filter((node): node is HTMLTableRowElement=>node instanceof HTMLTableRowElement)').replaceAll('filter(node=>node instanceof HTMLInputElement)','filter((node): node is HTMLInputElement=>node instanceof HTMLInputElement)');
 const events="['click','keydown','submit','input','change','focusin','focusout','mouseout']";
 let code;
 if(framework==='react')code=`'use client';\nimport { useId, useRef, useEffect } from 'react';\nimport './${cssFile}';\n\n${runtime}\n\nexport default function ${name}({ onAction }) {\n const id=useId(), root=useRef(null);\n useEffect(()=>{const el=root.current;if(!el)return;const handler=e=>${handlerName}(e,onAction);for(const type of ${events})el.addEventListener(type,handler);return()=>{for(const type of ${events})el.removeEventListener(type,handler);};},[onAction]);\n return <section ${attrs.replace('class=','className=')} ref={root}>${html}</section>;\n}\n`;
 if(framework==='vue')code=`<script setup>\nimport { ref, useId, onMounted, onBeforeUnmount } from 'vue';\nimport './${cssFile}';\nconst id=useId(), root=ref(null), emit=defineEmits(['action']);\n${runtime}\nconst handler=e=>${handlerName}(e,detail=>emit('action',detail));\nonMounted(()=>{for(const type of ${events})root.value.addEventListener(type,handler);});\nonBeforeUnmount(()=>{for(const type of ${events})root.value?.removeEventListener(type,handler);});\n</script>\n<template><section ${attrs} ref="root">${html}</section></template>\n`;
 if(framework==='svelte')code=`<script>\nimport './${cssFile}';\nlet { onaction=()=>{} }=$props();\nconst id=$props.id();\n${runtime}\nfunction wire(node){const handler=e=>${handlerName}(e,onaction);for(const type of ${events})node.addEventListener(type,handler);return{destroy(){for(const type of ${events})node.removeEventListener(type,handler);}};}\n</script>\n<section ${attrs} use:wire>${html}</section>\n`;
 if(framework==='angular')code=`import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';\nimport { isPlatformBrowser } from '@angular/common';\n\n${runtime}\n\n@Component({selector:'oscode-design-${item}',standalone:true,template:${JSON.stringify(`<section ${attrs} #root>${html}</section>`)},styleUrls:['./${cssFile}']})\nexport class ${name}Component implements AfterViewInit, OnDestroy {\n @Input({required:true}) id!: string;\n @Output() action=new EventEmitter<Record<string,unknown>>();\n @ViewChild('root') root!: ElementRef<HTMLElement>;\n private platform=inject(PLATFORM_ID);\n private handler=(event:Event)=>${handlerName}(event,detail=>this.action.emit(detail));\n ngAfterViewInit(){if(isPlatformBrowser(this.platform))for(const type of ${events})this.root.nativeElement.addEventListener(type,this.handler);}\n ngOnDestroy(){if(isPlatformBrowser(this.platform))for(const type of ${events})this.root?.nativeElement.removeEventListener(type,this.handler);}\n}\n`;
 return {item,framework,title:designCatalog.find(x=>x.id===item).name,extension,code,css:designCss(tokens,scope,mobile,admin),cssFile,minimum:designFrameworks[framework].minimum.join('.'),
  guidance:(admin?'Admin data is a local example. Implement invitation, routing, server pagination and server-side authorization in the host app; role choices do not enforce permissions. ':'')+'Native uncontrolled UI starter. Connect emitted action events to app data and backend. Form events expose the form; no credentials are logged or submitted by this starter. Angular requires a unique, stable id input. Gallery renders shared HTML behavior, not compiled framework components. Import component into the app and run its existing tests.'};
}
export async function assertDesignCompatibility(tools,framework,native=true){
 if(!Object.hasOwn(designFrameworks,framework))throw Error('지원하지 않는 프레임워크');
 let pkg={};try{pkg=JSON.parse(await tools.text(await tools.resolve('package.json')));}catch(e){if(e.code!=='ENOENT')throw e;}
 const frameworks=detectFrameworks({...pkg.dependencies,...pkg.devDependencies}),found=frameworks.find(f=>f.id===framework);
 if(frameworks.length&&!found)throw Error('프로젝트 프레임워크와 선택한 디자인이 다릅니다.');
 if(found&&native){const version=/^[~^]?(\d+)\.(\d+)(?:\.(?:\d+|x|\*))?$/.exec(found.version),minimum=designFrameworks[framework].minimum;
  if(!version)throw Error('프레임워크 버전 범위를 확인할 수 없습니다. 실제 버전을 확인해 단순 버전 선언으로 등록하세요.');
  if(+version[1]<minimum[0]||+version[1]===minimum[0]&&+version[2]<minimum[1])throw Error(`${framework} ${minimum.join('.')} 이상이 필요합니다.`);
 }
 return {declared:found?.version||null,note:found?'선언 버전만 확인했습니다. 실제 빌드가 필요합니다.':'프레임워크 선언이 없습니다. 설치·앱 연결은 별도입니다.'};
}
export async function applyDesign(tools,selection,file,signal){
 if(tools.readOnly||tools.permissions.write==='deny')throw Error('BUILD 모드와 쓰기 권한이 필요합니다.');
 validateSelection(selection);await assertDesignCompatibility(tools,selection.framework);
 const recipe=designRecipe(selection,file),cssPath=path.join(path.dirname(file),recipe.cssFile);
 // Preflight both files before the first write. Never overwrite an existing stylesheet.
 for(const name of [file,cssPath]){const resolved=await tools.resolve(name,true);try{await tools.text(resolved);throw Error(`기존 파일을 덮어쓰지 않습니다: ${name}`);}catch(e){if(e.code!=='ENOENT')throw e;}}
 const created=[];
 try{for(const [name,content]of [[file,recipe.code],[cssPath,recipe.css]]){signal?.throwIfAborted();await tools.perform('write_file',{path:name,content},signal);created.push(name);}}
 catch(e){throw Error(`${e.message}${created.length?' · 생성 완료: '+created.join(', ')+' · 나머지 생성 전 중단됨':''}`);}
 return {created,guidance:recipe.guidance,next:'앱에 import하고 action 이벤트와 데이터를 연결한 뒤 /inspect 또는 /states run으로 확인하세요.'};
}
