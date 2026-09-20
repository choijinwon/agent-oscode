// Pure validation: also embedded in generated theme components, with no Node dependencies.
export function validateDesignTokens(value){
 const keys=['accent','accentText','surface','background','text','muted','border','danger','radius','spacing','font'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw Error('지원하는 디자인 토큰 이름을 확인하세요.');
 for(const [key,v]of Object.entries(value)){
  if(typeof v!=='string'||v.length>120)throw Error(`잘못된 ${key}`);
  const valid=key==='font'?/^[a-zA-Z0-9 ,'"-]+$/.test(v)&&v.trim():['radius','spacing'].includes(key)?/^(?:0|\d+(?:\.\d+)?(?:px|rem|em))$/.test(v)&&parseFloat(v)<=100:/^(?:#[\da-fA-F]{3,4}|#[\da-fA-F]{6}|#[\da-fA-F]{8}|(?:rgb|hsl)a?\([\d\s.,%/+\-deg]+\)|oklch\([\d\s.%/+\-]+\)|transparent|currentColor|black|white)$/.test(v);
  if(!valid)throw Error(`${key}: 단순 색상·길이·글꼴 값만 지원합니다.`);
 }
 return value;
}
export function designTokenStyle(tokens={}){
 validateDesignTokens(tokens);
 return Object.fromEntries(Object.entries(tokens).map(([key,value])=>['--oc-theme-'+key,value]));
}
