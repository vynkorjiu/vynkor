import QRCode from 'qrcode';
import { createIcons, Plus, X, Check, Download, ExternalLink, Copy, LogOut, ChevronLeft, ChevronRight, Search, ShieldCheck, ShieldX, FileSearch, Pencil, Ban, History, RefreshCw } from 'lucide';
const icons = { Plus, X, Check, Download, ExternalLink, Copy, LogOut, ChevronLeft, ChevronRight, Search, ShieldCheck, ShieldX, FileSearch, Pencil, Ban, History, RefreshCw };
const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const draw = () => createIcons({ icons });
const date = value => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
const badge = row => `<span class="badge ${row.status === 'revoked'?'revoked':''}">${row.status === 'valid'?'Válido':'Cancelado'}</span>`;
const link = id => `https://vynkor.co/certificados/${id}`;
let rows = [], page = 0, editing = null, current = null, createId = null, busy = false;
let loadSequence = 0;
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers:{'Content-Type':'application/json',...options.headers}, cache:'no-store' });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Sua sessão terminou. Entre novamente no painel.');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir.');
  return data;
}
function notice(message) { $('#notice').textContent=message; $('#notice').style.display='block'; clearTimeout(notice.timer); notice.timer=setTimeout(()=>$('#notice').style.display='none',5000); }
function fields(row) { return `<dl class="details-list"><dt>Graduação</dt><dd>${esc(row.graduation)}</dd><dt>Data da graduação</dt><dd>${date(row.awarded_on)}</dd><dt>Responsável</dt><dd>${esc(row.instructor)}</dd><dt>Emitido por</dt><dd>VYNKOR Jiu-Jítsu</dd></dl>`; }
function close(dialog) { if (!busy) dialog.close(); }
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>close($('#editor')));
$('#editor').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
function openEditor(row = null) {
  editing = row; createId = row?.id || crypto.randomUUID().replaceAll('-','');
  const form = $('#certificate-form'); form.reset();
  for (const name of ['student','graduation','awarded_on','instructor']) form.elements[name].value=row?.[name] || '';
  const today = new Date().toLocaleDateString('en-CA');
  form.elements.awarded_on.max=today;
  $('#editor-title').textContent=row?'Corrigir certificado':'Emitir certificado';
  $('#save-label').textContent=row?'Salvar correção':'Emitir certificado';
  $('#form-error').textContent=''; $('#editor').showModal();
}
$('#certificate-form').addEventListener('submit', async event => {
  event.preventDefault(); if(busy)return;
  busy=true; const button=event.submitter; button.disabled=true;
  $('#form-error').textContent='';
  try {
    const data=Object.fromEntries(new FormData(event.target));
    const row=await api('/api/admin/certificados'+(editing?`/${editing.id}`:''),{method:editing?'PATCH':'POST',body:JSON.stringify({...data,id:createId,...(editing?{version:editing.version,status:editing.status}:{})})});
    $('#editor').close(); notice(editing?'Correção salva.':'Certificado emitido.');
    await load(); await details(row);
  } catch(error){$('#form-error').textContent=error.message;} finally {busy=false;button.disabled=false;}
});
async function load() {
  const sequence=++loadSequence;
  $('#list').innerHTML='<p class="empty">Carregando certificados…</p>';
  try {
    const data=await api(`/api/admin/certificados?q=${encodeURIComponent($('#search').value)}&status=${$('#status').value}&page=${page}`);
    if(sequence!==loadSequence)return;
    rows=data.items;
    $('#list').innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th>Aluno</th><th>Graduação</th><th>Data</th><th>Situação</th><th><span class="hidden">Ações</span></th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.student)}</td><td>${esc(row.graduation)}</td><td>${date(row.awarded_on)}</td><td>${badge(row)}</td><td><button data-id="${row.id}"><i data-lucide="file-search"></i>Abrir</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">Nenhum certificado encontrado.</p>';
    $('#page').textContent=`Página ${page+1}`; $('#prev').disabled=page===0;$('#next').disabled=!data.hasMore;
    document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>details(rows.find(r=>r.id===b.dataset.id)));draw();
  }catch(error){if(sequence!==loadSequence)return;$('#list').innerHTML=`<p class="empty error">${esc(error.message)}</p>`;$('#next').disabled=true;}
}
async function download(format,row) {
  try {
    const options={errorCorrectionLevel:'M',margin:4,width:1200};
    let content;
    if(format==='svg') content=new Blob([await QRCode.toString(link(row.id),{...options,type:'svg'})],{type:'image/svg+xml'});
    else { const canvas=document.createElement('canvas'); await QRCode.toCanvas(canvas,link(row.id),options); content=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG unavailable')),'image/png')); }
    const url=URL.createObjectURL(content);const a=document.createElement('a');a.href=url;a.download=`vynkor-${row.id}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch{notice('Não foi possível gerar o QR code. Tente novamente.');}
}
async function details(row) {
  current=row;
  $('#detail-body').innerHTML=`<div class="dialog-heading"><h2 id="detail-title">${esc(row.student)}</h2><button class="icon" id="close-details" aria-label="Fechar" title="Fechar"><i data-lucide="x"></i></button></div>${badge(row)}${fields(row)}<p class="code">${esc(row.id)}</p><canvas class="qr" id="qr" aria-label="QR code de validação"></canvas><div class="actions"><button id="png"><i data-lucide="download"></i>PNG</button><button id="svg"><i data-lucide="download"></i>SVG</button><button id="copy"><i data-lucide="copy"></i>Copiar link</button><a class="button" target="_blank" rel="noopener" href="${link(row.id)}"><i data-lucide="external-link"></i>Validar</a></div><div class="actions"><button id="edit"><i data-lucide="pencil"></i>Corrigir</button><button id="revoke"><i data-lucide="${row.status==='valid'?'ban':'refresh-cw'}"></i>${row.status==='valid'?'Cancelar certificado':'Reativar certificado'}</button><button id="history"><i data-lucide="history"></i>Histórico</button></div><div id="history-list"></div>`;
  $('#close-details').onclick=()=>$('#details').close();
  $('#png').onclick=()=>download('png',row);$('#svg').onclick=()=>download('svg',row);
  $('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(link(row.id));notice('Link copiado.');}catch{notice('Não foi possível copiar o link.');}};
  $('#edit').onclick=()=>{$('#details').close();openEditor(row);};
  $('#history').onclick=async()=>{try{const history=await api(`/api/admin/certificados/${row.id}/historico`);$('#history-list').innerHTML=`<ul class="history">${history.map(item=>{const snapshot=JSON.parse(item.snapshot);return `<li><strong>Versão ${item.version} · ${snapshot.status==='valid'?'Válido':'Cancelado'}</strong><span>${esc(item.actor)} · ${new Date(item.occurred_at).toLocaleString('pt-BR')}</span><span>${esc(snapshot.student)} · ${esc(snapshot.graduation)} · ${date(snapshot.awarded_on)} · ${esc(snapshot.instructor)}</span></li>`;}).join('')}</ul>`;}catch(error){notice(error.message);}};
  $('#revoke').onclick=()=>{
    const revoke=row.status==='valid';
    $('#confirm-title').textContent=revoke?'Cancelar certificado?':'Reativar certificado?';
    $('#confirmation p').textContent=revoke?'A consulta pública passará a mostrar este certificado como cancelado. O endereço será preservado.':'A consulta pública voltará a mostrar este certificado como válido.';
    $('#confirmation button[value="yes"]').textContent=revoke?'Cancelar certificado':'Reativar certificado';
    $('#confirmation').showModal();
  };
  if(!$('#details').open)$('#details').showModal();draw();
  try{await QRCode.toCanvas($('#qr'),link(row.id),{width:440,margin:4,errorCorrectionLevel:'M'});$('#qr').style.width='220px';$('#qr').style.height='220px';}catch{notice('Não foi possível gerar o QR code.');}
}
$('#confirmation').addEventListener('close',async()=>{
  if($('#confirmation').returnValue!=='yes'||busy)return;
  busy=true;$('#revoke').disabled=true;
  try{const row=await api(`/api/admin/certificados/${current.id}`,{method:'PATCH',body:JSON.stringify({...current,status:current.status==='valid'?'revoked':'valid'})});await details(row);await load();notice('Situação atualizada.');}catch(error){notice(error.message);$('#revoke').disabled=false;}finally{busy=false;}
});
async function main() {
  if(location.pathname.startsWith('/admin')){
    try{
      const me=await api('/api/admin/me');
      $('#account').innerHTML=`<span>${esc(me.email)}</span><a href="/cdn-cgi/access/logout" title="Sair" aria-label="Sair"><i data-lucide="log-out"></i></a>`;
      $('#app').innerHTML='<div class="heading"><h1>Certificados</h1><button class="primary" id="new"><i data-lucide="plus"></i>Emitir certificado</button></div><form class="filters" id="filters"><label><input id="search" type="search" placeholder="Buscar aluno ou código" aria-label="Buscar aluno ou código" maxlength="120"></label><label><select id="status" aria-label="Situação"><option value="">Todas as situações</option><option value="valid">Válidos</option><option value="revoked">Cancelados</option></select></label><button type="submit" class="icon" title="Buscar" aria-label="Buscar"><i data-lucide="search"></i></button></form><div id="list"></div><div class="pager"><button id="prev" class="icon" title="Página anterior" aria-label="Página anterior"><i data-lucide="chevron-left"></i></button><span id="page"></span><button id="next" class="icon" title="Próxima página" aria-label="Próxima página"><i data-lucide="chevron-right"></i></button></div>';
      $('#new').onclick=()=>openEditor();$('#filters').onsubmit=e=>{e.preventDefault();page=0;load();};$('#status').onchange=()=>{page=0;load();};$('#prev').onclick=()=>{page--;load();};$('#next').onclick=()=>{page++;load();};await load();
    }catch(error){$('#app').innerHTML=`<div class="empty"><h1>Acesso ao painel</h1><p>${esc(error.message)}</p><a class="button" href="/admin">Entrar novamente</a></div>`;}
  }else{
    const id=location.pathname.split('/').filter(Boolean)[1];
    try{
      if(!/^[a-f0-9]{32}$/.test(id||''))throw new Error('Certificado não encontrado. Confira o endereço do QR code.');
      const row=await api(`/api/certificados/${id}`);const valid=row.status==='valid';
      $('#app').className='public';$('#app').innerHTML=`<p class="muted">VYNKOR JIU-JÍTSU · VALIDAÇÃO</p><div class="status-title ${valid?'':'revoked'}"><i data-lucide="${valid?'shield-check':'shield-x'}"></i><h1>Certificado ${valid?'válido':'cancelado'}</h1></div><p>${valid?'A VYNKOR confirma a emissão deste certificado.':'Este certificado foi cancelado pela VYNKOR e não deve ser aceito como válido.'}</p><h2>${esc(row.student)}</h2>${fields(row)}<p class="muted">Código de verificação</p><p class="code">${row.id}</p><a class="button" href="/">Conheça a Vynkor</a>`;
    }catch(error){$('#app').className='public';$('#app').innerHTML=`<h1>Não foi possível validar</h1><p>${esc(error.message)}</p><button id="retry">Tentar novamente</button>`;$('#retry').onclick=()=>location.reload();}
  }draw();
}
main();
