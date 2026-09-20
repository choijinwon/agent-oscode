// Decimal strings -> integer minor units. Never round or parse money through Number.
export function erpScale(currency='KRW') {
 if(currency==='KRW'||currency==='JPY')return 0;
 if(currency==='USD'||currency==='EUR')return 2;
 throw Error('지원 통화: KRW, JPY, USD, EUR');
}
export function erpParseAmount(value='',scale=0) {
 const text=value.trim();if(text==='')return 0n;
 if(!Number.isInteger(scale)||scale<0||scale>2||text.length>30)return null;
 if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text))return null;
 const [whole,fraction='']=text.replaceAll(',','').split('.');
 if(whole.length>18||fraction.length>scale)return null;
 return BigInt(whole)*10n**BigInt(scale)+BigInt(fraction.padEnd(scale,'0')||'0');
}
export function erpFormatAmount(minor=0n,scale=0) {
 const negative=minor<0n,absolute=negative?-minor:minor,unit=10n**BigInt(scale);
 const whole=(absolute/unit).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');
 return (negative?'-':'')+whole+(scale?'.'+(absolute%unit).toString().padStart(scale,'0'):'');
}
export function erpValidateJournal(lines,currency='KRW') {
 const scale=erpScale(currency),errors=[],items=[];let debit=0n,credit=0n,amountsValid=true;
 for(const line of lines){
  if(![line.account,line.description,line.costCenter,line.debit,line.credit].some(value=>value.trim()))continue;
  const d=erpParseAmount(line.debit,scale),c=erpParseAmount(line.credit,scale),rowErrors=[];
  if(!/^[A-Za-z0-9]{1,10}$/.test(line.account.trim()))rowErrors.push('계정은 영문·숫자 1~10자');
  if(line.description.length>100)rowErrors.push('적요는 100자 이하');
  if(!/^[A-Za-z0-9-]{0,10}$/.test(line.costCenter.trim()))rowErrors.push('원가센터는 영문·숫자·하이픈 10자 이하');
  if(d===null||c===null){rowErrors.push(currency+' 금액 형식 또는 소수 자릿수 오류');amountsValid=false;}
  else{
   debit+=d;credit+=c;
   if(d>0n&&c>0n)rowErrors.push('차변과 대변 중 한쪽만 입력');
   if(d===0n&&c===0n)rowErrors.push('0보다 큰 금액 입력');
   items.push({id:line.id,account:line.account.trim(),description:line.description.trim(),costCenter:line.costCenter.trim(),debitMinor:d.toString(),creditMinor:c.toString()});
  }
  if(rowErrors.length)errors.push({id:line.id,messages:rowErrors});
 }
 const balanced=amountsValid&&debit===credit&&debit>0n;
 return {valid:errors.length===0&&items.length>=2&&balanced,balanced,amountsValid,scale,currency,errors,items,debitMinor:amountsValid?debit.toString():null,creditMinor:amountsValid?credit.toString():null,differenceMinor:amountsValid?(debit-credit).toString():null};
}
