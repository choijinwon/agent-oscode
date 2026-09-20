import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const page=await readFile(new URL('./index.html',import.meta.url));
const server=createServer((req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(page);}
 else if(req.url==='/api/items'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify([{name:'OSCODE 검증 완료'}]));}
 else{res.statusCode=404;res.end('Not found');}
});
server.listen(4195,'127.0.0.1',()=>console.log('OSCODE 상태 검증 예제: http://127.0.0.1:4195'));
