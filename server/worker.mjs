import { authenticate } from './auth.mjs';

const idPattern = /^[a-f0-9]{32}$/;
const publicColumns = 'id, student, graduation, awarded_on, instructor, status, created_at, updated_at, version';
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function json(data, status = 200) { return Response.json(data, { status }); }
export function validate(data) {
  const result = {};
  for (const [key, max] of [['student',120],['graduation',100],['instructor',120]]) {
    if (typeof data[key] !== 'string') fail(400, 'Preencha nome, graduação e responsável.');
    const value = data[key].trim().normalize('NFC');
    if (value.length < 2 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail(400, 'Confira o tamanho e o conteúdo dos campos.');
    result[key] = value;
  }
  const date = data.awarded_on;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date || date < '2000-01-01' || date > new Date().toISOString().slice(0,10)) fail(400, 'Informe uma data de graduação válida, até hoje.');
  result.awarded_on = date;
  return result;
}
async function body(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'Envie os dados em JSON.');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'Dados ausentes.');
  let size = 0; const parts = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 8192) { await reader.cancel(); fail(413, 'Dados muito grandes.'); } parts.push(value); }
  try { const data = JSON.parse(await new Blob(parts).text()); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); return data; } catch { fail(400, 'Dados inválidos.'); }
}
function headers(response) {
  const result = new Response(response.body, response);
  result.headers.set('Cache-Control','no-store');
  result.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
  result.headers.set('X-Content-Type-Options','nosniff');
  result.headers.set('Referrer-Policy','no-referrer');
  result.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  return result;
}
export function createHandler(auth = authenticate) {
  return async function handle(request, env) {
    const url = new URL(request.url); const path = url.pathname.replace(/\/$/,'');
    const admin = path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin/');
    const publicPage = path === '/certificados' || path.startsWith('/certificados/');
    const publicAPI = path.startsWith('/api/certificados/');
    if (!admin && !publicPage && !publicAPI) return env.ASSETS.fetch(request);
    try {
      let actor;
      if (admin) actor = await auth(request, env);
      if ((admin || publicAPI) && !['GET','HEAD'].includes(request.method)) {
        if (request.headers.get('Origin') !== url.origin) fail(403, 'Origem não autorizada.');
      }
      if (path === '/api/admin/me' && request.method === 'GET') return headers(json({ email: actor }));
      if ((path === '/admin' || publicPage) && ['GET','HEAD'].includes(request.method)) {
        const asset = new URL('/certificate-app.html',url);
        return headers(await env.ASSETS.fetch(new Request(asset, { method: request.method })));
      }
      if (!env.CERTIFICATES) fail(503, 'Serviço de certificados temporariamente indisponível.');
      const db = env.CERTIFICATES;
      if (publicAPI && request.method === 'GET') {
        const id = path.slice('/api/certificados/'.length);
        if (!idPattern.test(id)) fail(404,'Certificado não encontrado.');
        const row = await db.prepare(`SELECT ${publicColumns} FROM certificates WHERE id=?`).bind(id).first();
        if (!row) fail(404,'Certificado não encontrado.');
        return headers(json(row));
      }
      if (path === '/api/admin/certificados' && request.method === 'GET') {
        const search = (url.searchParams.get('q') || '').trim().slice(0,120);
        const status = url.searchParams.get('status') || '';
        if (!['','valid','revoked'].includes(status)) fail(400,'Filtro inválido.');
        const page = Math.min(100000, Math.max(0, parseInt(url.searchParams.get('page') || '0',10) || 0));
        const match = `%${search.replace(/[\\%_]/g,'\\$&')}%`;
        const where = "WHERE (student LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\') AND (?='' OR status=?)";
        const { results } = await db.prepare(`SELECT ${publicColumns} FROM certificates ${where} ORDER BY created_at DESC,id LIMIT 21 OFFSET ?`).bind(match,match,status,status,page*20).all();
        return headers(json({ items: results.slice(0,20), hasMore: results.length > 20, page }));
      }
      if (path === '/api/admin/certificados' && request.method === 'POST') {
        const input = await body(request); const data = validate(input);
        // The browser keeps this random id for retries, so a lost response cannot issue twice.
        if (!idPattern.test(input.id || '')) fail(400,'Identificador inválido.');
        const existing = await db.prepare(`SELECT ${publicColumns} FROM certificates WHERE id=?`).bind(input.id).first();
        if (existing) {
          if (Object.keys(data).some(k=>existing[k]!==data[k])) fail(409,'Identificador já utilizado.');
          return headers(json(existing));
        }
        const now = new Date().toISOString();
        await db.prepare('INSERT OR IGNORE INTO certificates(id,student,graduation,awarded_on,instructor,created_at,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?)').bind(input.id,data.student,data.graduation,data.awarded_on,data.instructor,now,now,actor).run();
        const issued = await db.prepare(`SELECT ${publicColumns} FROM certificates WHERE id=?`).bind(input.id).first();
        if (!issued || Object.keys(data).some(k=>issued[k]!==data[k])) fail(409,'Identificador já utilizado.');
        return headers(json(issued,201));
      }
      const detail = path.match(/^\/api\/admin\/certificados\/([a-f0-9]{32})(\/historico)?$/);
      if (detail && request.method === 'GET') {
        if (detail[2]) {
          const { results } = await db.prepare('SELECT version,actor,occurred_at,snapshot FROM certificate_events WHERE certificate_id=? ORDER BY version DESC').bind(detail[1]).all();
          return headers(json(results));
        }
        const row = await db.prepare(`SELECT ${publicColumns} FROM certificates WHERE id=?`).bind(detail[1]).first();
        if (!row) fail(404,'Certificado não encontrado.');
        return headers(json(row));
      }
      if (detail && !detail[2] && request.method === 'PATCH') {
        const input = await body(request); const data = validate(input);
        if (!Number.isInteger(input.version) || input.version < 1 || !['valid','revoked'].includes(input.status)) fail(400,'Versão ou situação inválida.');
        const result = await db.prepare('UPDATE certificates SET student=?,graduation=?,awarded_on=?,instructor=?,status=?,version=version+1,updated_at=?,updated_by=? WHERE id=? AND version=?').bind(data.student,data.graduation,data.awarded_on,data.instructor,input.status,new Date().toISOString(),actor,detail[1],input.version).run();
        if (!result.meta.changes) fail(409,'Este certificado foi alterado. Atualize a lista antes de salvar novamente.');
        return headers(json(await db.prepare(`SELECT ${publicColumns} FROM certificates WHERE id=?`).bind(detail[1]).first()));
      }
      fail(404,'Página não encontrada.');
    } catch (error) {
      if (!error.status) console.error('Certificate request failed:', error.name);
      return headers(json({ error: error.status ? error.message : 'Não foi possível concluir. Tente novamente.' },error.status || 500));
    }
  };
}
export default { fetch: createHandler() };
