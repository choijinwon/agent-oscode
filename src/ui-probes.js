export function validateProbe(probe){
 if(probe===undefined)return;
 if(!probe||typeof probe!=='object'||Array.isArray(probe)||Object.keys(probe).some(k=>!['width','colorScheme','text','settleMs','locale','textScale'].includes(k)))throw Error('잘못된 화면 테스트 조건');
 if(probe.width!==undefined&&(!Number.isInteger(probe.width)||probe.width<280||probe.width>1920))throw Error('width: 280–1920');
 if(probe.colorScheme!==undefined&&!['light','dark'].includes(probe.colorScheme))throw Error('colorScheme: light/dark');
 if(probe.settleMs!==undefined&&(!Number.isInteger(probe.settleMs)||probe.settleMs<0||probe.settleMs>3000))throw Error('settleMs: 0–3000');
 if(probe.locale!==undefined&&(typeof probe.locale!=='string'||!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/.test(probe.locale)))throw Error('유효한 locale이 필요합니다.');
 if(probe.textScale!==undefined&&(!Number.isFinite(probe.textScale)||probe.textScale<1||probe.textScale>2))throw Error('textScale: 1–2');
 if(probe.text!==undefined&&(!Array.isArray(probe.text)||probe.text.length>5||probe.text.some(x=>!x||Object.keys(x).some(k=>!['selector','value'].includes(k))||typeof x.selector!=='string'||!x.selector.trim()||x.selector.length>500||typeof x.value!=='string'||x.value.length>2000)))throw Error('text: 최대 5개 selector/value');
}
export async function applyProbe(page,probe={}){
 validateProbe(probe);const applied=[];
 for(const item of probe.text||[]){
  const locator=page.locator(item.selector);if(await locator.count()!==1)throw Error('텍스트 스트레스 대상은 단일 요소여야 합니다.');
  await locator.evaluate((el,value)=>{
   if(el.children.length||el.matches('input,textarea,select,script,style'))throw Error('텍스트만 있는 말단 요소를 선택하세요.');el.textContent=value;
  },item.value);applied.push(item.selector);
 }
 if(probe.textScale)await page.evaluate(scale=>{
  const nodes=[...document.querySelectorAll('body,body *')].slice(0,5000);const sizes=nodes.map(el=>parseFloat(getComputedStyle(el).fontSize));
  nodes.forEach((el,i)=>el.style.setProperty('font-size',sizes[i]*scale+'px','important'));
 },probe.textScale);
 return {text:applied,textScale:probe.textScale||1,note:'Temporary DOM stress, not an application data or zoom test. Renders may replace injected text.'};
}
