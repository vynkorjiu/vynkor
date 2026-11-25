const start = Date.parse('2026-11-25T00:00:00-03:00');
const sale = Date.parse('2026-11-27T00:00:00-03:00');
const end = Date.parse('2026-11-30T00:00:00-03:00');
const key = 'vynkor-black-2026-seen';
const plans = document.querySelector('#planos > div');
const originals = ['bf-semestral','bf-anual'].map(id => document.getElementById(id));
const saved = originals.map(el => el?.innerHTML);
const annualNote = originals[1]?.nextElementSibling;
const oldNote = annualNote?.textContent;
let phase = '';
let dialog, banner, opener;
const wa = text => 'https://wa.me/555199678647?text=' + encodeURIComponent(text);
function close() { dialog.close(); opener?.focus(); }
function open() { opener = document.activeElement; dialog.showModal(); try { sessionStorage.setItem(key+'-'+phase,'1'); } catch {} }
function render() {
  const now = Date.now();
  const next = now < start || now >= end ? 'off' : now >= sale ? 'sale' : 'teaser';
  if (next === phase) return;
  const wasOpen = dialog?.open;
  dialog?.close(); dialog?.remove(); banner?.remove();
  originals.forEach((el,i) => { if (el) el.innerHTML = saved[i]; });
  if (annualNote) annualNote.textContent = oldNote;
  phase = next;
  if (phase === 'off' || !plans) return;
  const active = phase === 'sale';
  const timing = active ? 'Até domingo, 29/11' : 'De 27 a 29 de novembro';
  banner = document.createElement('div');
  banner.className = 'bf-banner';
  banner.innerHTML = '<div><strong>BLACK FRIDAY VYNKOR · 10% OFF</strong><p>Semestral e anual. Sua matrícula já inclui a rashguard oficial.</p><small>'+timing+'</small></div><button type="button">Ver condição especial <span aria-hidden="true">↗</span></button>';
  plans.insertBefore(banner, plans.children[1]);
  banner.querySelector('button').addEventListener('click',open);
  dialog = document.createElement('dialog');
  dialog.className = 'bf-modal';
  dialog.setAttribute('aria-labelledby','bf-title');
  dialog.innerHTML = '<button class="bf-close" type="button" aria-label="Fechar promoção">×</button><div class="bf-content"><img class="bf-logo" src="./assets/vynkor-marca-vertical-branca.png" alt="VYNKOR"><p class="bf-kicker">BLACK FRIDAY · '+timing+'</p><h2 id="bf-title">'+(active ? 'Seu próximo passo<br>começa agora.' : 'Seu próximo passo<br>tem data.')+'</h2><div class="bf-discount">10% <span>OFF</span></div><p class="bf-scope">Nos planos semestral e anual</p><div class="bf-rash"><img src="./assets/rash-360/rash-01.png" alt="Rashguard oficial VYNKOR"><div><strong>Sua rashguard oficial<br>já vem com a matrícula.</strong><p>Entre para a equipe vestindo VYNKOR.</p><small>Matrícula: R$ 125,00, com rashguard inclusa.</small></div></div><a class="bf-cta" target="_blank" rel="noopener noreferrer" href="'+wa(active ? 'Olá! Quero aproveitar a Black Friday VYNKOR: 10% no semestral ou anual e matrícula com rashguard inclusa.' : 'Olá! Quero saber mais sobre a Black Friday VYNKOR de 27 a 29/11 e a matrícula com rashguard inclusa.')+'">'+(active ? 'Quero aproveitar' : 'Quero saber mais')+' ↗</a><p class="bf-terms">Oferta válida de 27 a 29/11/2026. Desconto somente nos planos semestral e anual. Mensal e matrícula não participam.</p></div>';
  document.body.append(dialog);
  if (active) {
    dialog.querySelector('#bf-title').textContent = 'É AGORA.';
    const prices = document.createElement('p');
    prices.className = 'bf-official-prices';
    prices.textContent = 'Semestral: 6x R$ 279 · Anual: 12x R$ 261';
    dialog.querySelector('.bf-scope').after(prices);
  }
  dialog.querySelector('button').addEventListener('click',close);
  dialog.addEventListener('click',e => { if (e.target === dialog) { const r=dialog.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) close(); } });
  if(active) {
    originals.forEach((el,i)=>{ if(el) el.innerHTML='<small class="bf-price-label">BLACK FRIDAY · 10% OFF</small><del class="bf-old">'+(i?'12x R$ 290':'6x R$ 310')+'</del><span class="bf-new-price '+(i?'bf-price-dark':'bf-price-light')+'">'+(i?'12x R$ 261':'6x R$ 279')+'</span>'; });
    if(annualNote) annualNote.textContent='Plano recorrente anual · condição Black Friday';
  }
  let seen = false; try { seen = sessionStorage.getItem(key+'-'+phase)==='1'; } catch {}
  if(wasOpen || !seen) open();
}
render();
setInterval(render,30000);
// Refresh exactly at campaign boundaries, even when the page stays open.
function scheduleBoundary() {
  const boundary = [start,sale,end].find(time => time > Date.now());
  if (!boundary) return;
  setTimeout(() => { render(); scheduleBoundary(); }, Math.min(boundary-Date.now(),2147483647));
}
scheduleBoundary();
document.addEventListener('visibilitychange',()=>{if(!document.hidden) render();});
