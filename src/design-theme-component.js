import path from 'node:path';
import {createHash} from 'node:crypto';
import {defaultTheme,validateTheme,projectTheme} from './design-theme.js';
import {validateDesignTokens,designTokenStyle} from './design-token-values.js';
import {designFrameworks,assertDesignCompatibility,writeDesignFiles} from './design-recipes.js';

export function themeComponentCss(tokens=defaultTheme,scope='shared'){
 validateTheme(tokens);
 if(!/^[A-Za-z0-9_-]+$/.test(scope))throw Error('잘못된 스타일 범위');
 const selector=`[data-oc-theme="${scope}"]`;
 // Nested wrappers inherit the parent's complete theme, applying only their inline overrides.
 return `${selector}:not([data-oc-theme] [data-oc-theme]){${Object.entries({...defaultTheme,...tokens}).map(([k,v])=>`--oc-theme-${k}:${v}`).join(';')}}\n${selector}{min-width:0;color:var(--oc-theme-text);font-family:var(--oc-theme-font)}\n`;
}

export function themeUsage(framework){
 const usage={
  react:`import DesignTheme from './components/DesignTheme.jsx';\nimport DesignButton from './components/DesignButton.jsx';\n\nexport default function Page() {\n return <DesignTheme tokens={{ accent: '#4338ca', radius: '20px' }}>\n  <DesignButton />\n  <DesignTheme tokens={{ accent: '#0f766e' }}>\n   <DesignButton />\n  </DesignTheme>\n </DesignTheme>;\n}`,
  vue:`<script setup>\nimport DesignTheme from './components/DesignTheme.vue';\nimport DesignButton from './components/DesignButton.vue';\n</script>\n<template>\n <DesignTheme :tokens="{ accent: '#4338ca', radius: '20px' }">\n  <DesignButton />\n  <DesignTheme :tokens="{ accent: '#0f766e' }"><DesignButton /></DesignTheme>\n </DesignTheme>\n</template>`,
  svelte:`<script>\nimport DesignTheme from './components/DesignTheme.svelte';\nimport DesignButton from './components/DesignButton.svelte';\n</script>\n<DesignTheme tokens={{ accent: '#4338ca', radius: '20px' }}>\n <DesignButton />\n <DesignTheme tokens={{ accent: '#0f766e' }}><DesignButton /></DesignTheme>\n</DesignTheme>`,
  angular:`import { Component } from '@angular/core';\nimport { DesignThemeComponent } from './components/DesignTheme';\nimport { DesignButtonComponent } from './components/DesignButton';\n\n@Component({\n selector: 'app-page', standalone: true,\n imports: [DesignThemeComponent, DesignButtonComponent],\n template: \`<oscode-design-theme [tokens]="{accent:'#4338ca',radius:'20px'}">\n  <oscode-design-button id="page-primary" />\n  <oscode-design-theme [tokens]="{accent:'#0f766e'}">\n   <oscode-design-button id="page-secondary" />\n  </oscode-design-theme>\n </oscode-design-theme>\`\n})\nexport class PageComponent {}`
 };
 if(!Object.hasOwn(usage,framework))throw Error('react/vue/angular/svelte 중 선택하세요.');
 return usage[framework];
}

export function themeComponentRecipe(framework,tokens=defaultTheme,filename){
 if(!Object.hasOwn(designFrameworks,framework))throw Error('react/vue/angular/svelte 중 선택하세요.');
 validateTheme(tokens);
 const {extension,minimum}=designFrameworks[framework],file=filename||'DesignTheme'+extension;
 if(path.extname(file)!==extension)throw Error(`출력 확장자는 ${extension}입니다.`);
 const base=path.basename(file,extension);if(!/^[A-Za-z0-9_-]+$/.test(base))throw Error('파일 이름은 영문·숫자·하이픈·밑줄을 사용하세요.');
 const cssFile=base+'.css',scope=base+'-'+createHash('sha256').update(file).digest('hex').slice(0,10);
 let runtime=validateDesignTokens.toString()+'\n'+designTokenStyle.toString(),code;
 const attr=`data-oc-theme="${scope}"`;
 if(framework==='react')code=`import './${cssFile}';\n${runtime}\n\nexport default function DesignTheme({ tokens={}, children }) {\n return <div ${attr} style={designTokenStyle(tokens)}>{children}</div>;\n}\n`;
 if(framework==='vue')code=`<script setup>\nimport { computed } from 'vue';\nimport './${cssFile}';\nconst props=defineProps({ tokens:{ type:Object, default:()=>({}) } });\n${runtime}\nconst styles=computed(()=>designTokenStyle(props.tokens));\n</script>\n<template><div ${attr} :style="styles"><slot /></div></template>\n`;
 if(framework==='svelte')code=`<script>\nimport './${cssFile}';\nlet { tokens={}, children }=$props();\n${runtime}\nconst styles=$derived(Object.entries(designTokenStyle(tokens)).map(([key,value])=>key+':'+value).join(';'));\n</script>\n<div ${attr} style={styles}>{@render children?.()}</div>\n`;
 if(framework==='angular'){
  runtime=runtime.replace('validateDesignTokens(value)','validateDesignTokens(value: Record<string,string>)').replace('designTokenStyle(tokens={})','designTokenStyle(tokens: Record<string,string>={})');
  code=`import { Component, Input, ViewEncapsulation } from '@angular/core';\n${runtime}\n\n@Component({selector:'oscode-design-theme',standalone:true,encapsulation:ViewEncapsulation.None,template:'<div ${attr} [attr.style]="styles"><ng-content /></div>',styleUrls:['./${cssFile}']})\nexport class DesignThemeComponent {\n @Input() tokens: Record<string,string>={};\n get styles(){return Object.entries(designTokenStyle(this.tokens)).map(([key,value])=>key+':'+value).join(';');}\n}\n`;
 }
 return {item:'theme',framework,title:'공통 스타일 컴포넌트',extension,minimum:minimum.join('.'),code,css:themeComponentCss(tokens,scope),cssFile,usage:themeUsage(framework),
  guidance:'Import this single DesignTheme component on each page. Edit its CSS once for shared defaults; pass a partial tokens object for a page or nested subtree. Nested wrappers inherit omitted values. Update tokens immutably. Only newly generated OSCODE design components consume these theme variables; existing files and third-party components are unchanged. The wrapper adds one div; the host page controls layout. No extra styling dependency.'};
}

export async function applyThemeComponent(tools,framework,file,signal){
 if(tools.readOnly||tools.permissions.write==='deny')throw Error('BUILD 모드와 쓰기 권한이 필요합니다.');
 await assertDesignCompatibility(tools,framework);
 const recipe=themeComponentRecipe(framework,(await projectTheme(tools,signal)).tokens,file);
 const created=await writeDesignFiles(tools,[[file,recipe.code],[path.join(path.dirname(file),recipe.cssFile),recipe.css]],signal);
 return {...recipe,created};
}
