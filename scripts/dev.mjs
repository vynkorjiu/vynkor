import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { createHandler } from '../server/worker.mjs';
import { database } from './local-db.mjs';
const root=resolve('dist');
const db=database('.preview.sqlite');
// This preview identity exists only in this loopback-only process, never in the production bundle.
const handler=createHandler(async()=> 'professor@preview.local');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpeg':'image/jpeg','.webp':'image/webp','.txt':'text/plain'};
const env={CERTIFICATES:db,ASSETS:{async fetch(request){
  let path=new URL(request.url).pathname;if(path==='/')path='/index.html';
  const file=resolve(root,'.'+decodeURIComponent(path));
  if(!file.startsWith(root+sep)||path.includes('_worker'))return new Response('Not found',{status:404});
  try{let content=await readFile(file);if(path==='/certificate-app.html')content=content.toString().replace('<main ', '<aside class="preview">Prévia local · Certificados de teste, sem validade pública</aside><main ');return new Response(content,{headers:{'Content-Type':types[extname(file)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}
}}};
const server=createServer(async(req,res)=>{try{
  const buffers=[];for await(const part of req)buffers.push(part);
  const request=new Request(`http://127.0.0.1:8792${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(buffers)}:{})});
  const response=await handler(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
}catch{res.writeHead(500);res.end('Preview error');}});
server.listen(8792,'127.0.0.1',()=>console.log('Preview local: http://127.0.0.1:8792/admin (dados de teste)'));
process.on('SIGINT',()=>server.close(()=>{db.close();process.exit(0);}));
