import http from 'node:http';
const html=`<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><style>
body{font:16px system-ui;background:#f3f5f7;color:#16323d;padding:24px}.card{padding:24px;background:white;border-radius:16px;max-width:640px}h1{font-size:24px}button{padding:12px;margin-right:8px}#title{white-space:nowrap}#result{margin-top:16px}@media(prefers-color-scheme:dark){body{background:#12212b;color:#f3f5f7}.card{background:#203846}}
</style></head><body><section class="card" id="card"><h1 id="title" data-testid="project-title">OSCODE frontend lab</h1><p>소스 탐색 · 스타일 진단 · 요청 순서 테스트</p><button id="search">검색</button><div id="loading" hidden>불러오는 중</div><div id="result">준비</div></section><script>
let sequence=0;document.querySelector('#search').onclick=async()=>{const request=++sequence;document.querySelector('#loading').hidden=false;const result=await fetch('/api/search?q='+request).then(r=>r.json());document.querySelector('#result').textContent=result.label;document.querySelector('#loading').hidden=true;};
if(new URLSearchParams(location.search).has('hydration'))console.error('Hydration failed: server rendered HTML did not match the client');
</script></body></html>`;
const server=http.createServer((req,res)=>{if(req.url.startsWith('/api/search')){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({label:'테스트 결과'}));return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html);});
server.listen(4196,'127.0.0.1',()=>console.log('Frontend lab: http://127.0.0.1:4196 · 의도적으로 오래된 응답 덮어쓰기 버그가 있는 테스트 앱'));
