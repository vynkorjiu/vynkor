import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../scripts/local-db.mjs';
import { createHandler,validate } from '../server/worker.mjs';
import { authenticate } from '../server/auth.mjs';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

const data={id:'a'.repeat(32),student:'Aluno de teste',graduation:'Faixa azul',awarded_on:'2026-10-01',instructor:'Professor de teste'};
test('emissão, idempotência, correção, histórico, conflito e cancelamento',async()=>{
  const db=database();const handle=createHandler(async()=> 'authorized@example.com');
  const call=(path,method='GET',body)=>handle(new Request('https://vynkor.co'+path,{method,headers:{Origin:'https://vynkor.co','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{CERTIFICATES:db});
  try{
    let response=await call('/api/admin/certificados','POST',data);assert.equal(response.status,201);let row=await response.json();assert.equal(row.version,1);
    assert.equal((await call('/api/admin/certificados','POST',data)).status,200);
    assert.equal((await(await call('/api/admin/certificados')).json()).items.length,1);
    response=await call('/api/admin/certificados/'+data.id,'PATCH',{...data,student:'Nome corrigido',version:1,status:'valid'});assert.equal(response.status,200);
    assert.equal((await call('/api/admin/certificados/'+data.id,'PATCH',{...data,version:1,status:'valid'})).status,409);
    response=await call('/api/admin/certificados/'+data.id,'PATCH',{...data,student:'Nome corrigido',version:2,status:'revoked'});assert.equal(response.status,200);
    response=await call('/api/certificados/'+data.id);row=await response.json();assert.equal(row.status,'revoked');assert.equal(row.student,'Nome corrigido');assert.equal(row.id,data.id);assert.equal(row.updated_by,undefined);assert.equal(response.headers.get('Cache-Control'),'no-store');
    assert.equal((await(await call('/api/admin/certificados/'+data.id+'/historico')).json()).length,3);
    assert.equal((await call('/api/certificados/'+'b'.repeat(32))).status,404);
    assert.equal((await call('/api/admin/certificados','DELETE')).status,404);
    assert.equal((await(await call('/api/admin/certificados?q=%25')).json()).items.length,0);
  }finally{db.close();}
});
test('sem autenticação, sem configuração e sem origem confiável não há escrita',async()=>{
  await assert.rejects(()=>authenticate(new Request('https://vynkor.co/admin'),{}),{status:503});
  const env={ACCESS_TEAM_DOMAIN:'https://example.cloudflareaccess.com',ACCESS_AUD:'aud',ADMIN_EMAILS:'allowed@example.com'};
  await assert.rejects(()=>authenticate(new Request('https://vynkor.co/admin'),env),{status:401});
  const handler=createHandler();assert.equal((await handler(new Request('https://vynkor.co/api/admin/certificados'),env)).status,401);
  assert.equal((await handler(new Request('https://vynkor.pages.dev/api/admin/certificados',{headers:{'Cf-Access-Authenticated-User-Email':'allowed@example.com'}}),env)).status,401);
  const local=createHandler(async()=> 'allowed@example.com');assert.equal((await local(new Request('https://vynkor.co/api/admin/certificados',{method:'POST',headers:{Origin:'https://evil.example'}}),{})).status,403);
});
test('paginação e filtros preservam acesso aos certificados antigos',async()=>{
  const db=database();const handle=createHandler(async()=> 'allowed@example.com');
  const call=path=>handle(new Request('https://vynkor.co'+path),{CERTIFICATES:db});
  try {
    for(let i=0;i<23;i++) await db.prepare('INSERT INTO certificates(id,student,graduation,awarded_on,instructor,created_at,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?)').bind(i.toString(16).padStart(32,'0'),`Aluno ${i}`,'Faixa azul','2026-10-01','Professor','2026-10-01','2026-10-01','allowed@example.com').run();
    const first=await(await call('/api/admin/certificados')).json();const second=await(await call('/api/admin/certificados?page=1')).json();
    assert.equal(first.items.length,20);assert.equal(first.hasMore,true);assert.equal(second.items.length,3);assert.equal(second.hasMore,false);
    assert.equal(new Set([...first.items,...second.items].map(r=>r.id)).size,23);
    assert.equal((await(await call('/api/admin/certificados?q=Aluno%2022')).json()).items.length,1);
  }finally{db.close();}
});
test('validação de data e campos',()=>{
  assert.throws(()=>validate({...data,awarded_on:'2026-02-30'}));assert.throws(()=>validate({...data,student:''}));assert.throws(()=>validate({...data,awarded_on:'2099-01-01'}));assert.equal(validate(data).student,data.student);
});
test('QR code impresso decodifica o endereço permanente exato',async()=>{
  const url='https://vynkor.co/certificados/'+data.id;
  const buffer=await QRCode.toBuffer(url,{type:'png',width:1200,margin:4,errorCorrectionLevel:'M'});
  const png=PNG.sync.read(buffer);const decoded=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
  assert.equal(decoded.data,url);
});
