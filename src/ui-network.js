export function validateRoutes(routes){
 if(routes===undefined)return;
 if(!Array.isArray(routes)||routes.length<1||routes.length>5)throw Error('routes requires 1–5 API routes.');
 const seen=new Set();
 for(const route of routes){
  if(!route||Object.keys(route).some(k=>!['path','method','responses'].includes(k))||typeof route.path!=='string'||!/^\/(?!\/)[^?#\\\s]{1,200}$/.test(route.path)||!['GET','POST'].includes(route.method))throw Error('API route requires an exact path and GET/POST method.');
  const parsed=new URL(route.path,'http://localhost');
  if(parsed.pathname!==route.path)throw Error('Use a normalized API path.');
  const key=route.method+' '+route.path;if(seen.has(key))throw Error('Duplicate API route.');seen.add(key);
  if(!Array.isArray(route.responses)||!route.responses.length||route.responses.length>5)throw Error('Each route requires 1–5 responses.');
  for(const response of route.responses){
   if(!response||Object.keys(response).some(k=>!['status','json','delayMs'].includes(k))||!Number.isInteger(response.status)||response.status<200||response.status>599||response.status===204||response.status===304||!Object.hasOwn(response,'json'))throw Error('Response requires a JSON body and status (200–599, except 204/304).');
   if(response.delayMs!==undefined&&(!Number.isInteger(response.delayMs)||response.delayMs<0||response.delayMs>3000))throw Error('delayMs must be 0–3000.');
   const body=JSON.stringify(response.json);if(body===undefined||body.length>16000)throw Error('Mock JSON exceeds 16,000 characters.');
  }
 }
}
export async function installRoutes(context,url,routes){
 validateRoutes(routes);
 const origin=new URL(url).origin,counts=(routes||[]).map(()=>0),completed=(routes||[]).map(()=>0),events=[],errors=[],mocked=new WeakSet();
 if(routes?.length)await context.route('**/*',async handler=>{
  const request=handler.request(),target=new URL(request.url());
  const index=routes.findIndex(r=>target.origin===origin&&target.pathname===r.path&&request.method()===r.method&&['fetch','xhr'].includes(request.resourceType()));
  if(index<0){await handler.continue();return;}
  const route=routes[index],sequence=counts[index]++,response=route.responses[Math.min(sequence,route.responses.length-1)];
  mocked.add(request);
  try{
   if(response.delayMs)await new Promise(resolve=>setTimeout(resolve,response.delayMs));
   await handler.fulfill({status:response.status,contentType:'application/json',body:JSON.stringify(response.json)});
   completed[index]++;
   if(events.length<30)events.push({path:route.path,method:route.method,response:sequence+1,status:response.status,delayMs:response.delayMs||0});
  }catch{errors.push('Mock response could not complete.');}
 });
 return {isMocked:request=>mocked.has(request),summary:()=>({enabled:Boolean(routes?.length),events,errors:errors.slice(0,5),coverage:(routes||[]).map((r,i)=>({path:r.path,method:r.method,planned:r.responses.length,requested:counts[i],completed:completed[i]})),complete:errors.length===0&&(routes||[]).every((r,i)=>completed[i]>=r.responses.length&&completed[i]===counts[i])})};
}
