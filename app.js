// app.js
import { getClientes, saveClientes, insertCliente, getFichas, saveFichas, insertFicha, deleteCliente, deleteFicha, getNextCodigo } from './data.js';
// getClientes e getFichas são usados também após inserções para obter o id gerado pelo Supabase

// jsPDF + html2canvas (geração do PDF baixável) são carregados sob demanda,
// só quando o usuário clica em "Baixar PDF" — veja loadPdfLibs() mais abaixo.

const state = {
  clientes: [],
  fichas: [],
  view: 'list',          // list | clientForm | detail | fichaForm
  search: '',
  filterCidade: '',      // '' = todas as cidades
  selectedClientId: null,
  editingClientId: null,
  editingFichaId: null,
  confirmDelete: null,   // {kind:'cliente'|'ficha', id}
  loaded: false
};

// ---------------- Carregamento inicial ----------------
async function loadAll(){
  try{ state.clientes = await getClientes(); }catch(e){ state.clientes = []; showToast('Não foi possível carregar os clientes.', true); }
  try{ state.fichas = await getFichas(); }catch(e){ state.fichas = []; showToast('Não foi possível carregar as fichas.', true); }
  state.loaded = true;
  render();
}

async function persistClientes(changed){
  try{ await saveClientes(changed ? [changed] : state.clientes); }
  catch(e){ showToast('Não foi possível salvar. Tente novamente.', true); }
}

async function persistFichas(changed){
  try{ await saveFichas(changed ? [changed] : state.fichas); }
  catch(e){ showToast('Não foi possível salvar. Tente novamente.', true); }
}

// ---------------- Utils ----------------
function esc(s){ return (s==null?'':String(s)).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtDate(iso){
  if(!iso) return '—';
  const p = iso.split('-');
  if(p.length!==3) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
}
function fmtNum(n){
  if(n===undefined || n===null || n==='') return '—';
  const num = parseFloat(n);
  if(isNaN(num)) return '—';
  const sign = num > 0 ? '+' : '';
  return sign + num.toFixed(2);
}
function fmtMm(n){
  if(n===undefined || n===null || n==='') return '—';
  const num = parseFloat(n);
  if(isNaN(num)) return '—';
  return num.toFixed(1) + ' mm';
}
function calcIdade(nascimento){
  if(!nascimento) return '';
  const nasc = new Date(nascimento);
  const hoje = new Date();
  let a = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) a--;
  return a + ' anos';
}
function lastVisit(clienteId){
  const f = state.fichas.filter(x=>x.id_cliente===clienteId);
  if(!f.length) return null;
  return f.map(x=>x.data).sort().pop();
}
function fichasOf(clienteId){
  return state.fichas.filter(x=>x.id_cliente===clienteId).sort((a,b)=> b.data.localeCompare(a.data));
}
function getCidades(){
  const set = new Set(state.clientes.map(c => (c.cidade||'').trim()).filter(Boolean));
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}
function showToast(msg, isError){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = isError ? 'show error' : 'show';
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>{ t.className=''; }, 2600);
}

// ---------------- Rendering ----------------
function render(){
  const app = document.getElementById('app');
  if(!state.loaded){ app.innerHTML = '<div id="loading">Carregando dados…</div>'; return; }
  if(state.view==='list')            app.innerHTML = renderList();
  else if(state.view==='clientForm') app.innerHTML = renderClientForm();
  else if(state.view==='detail')     app.innerHTML = renderDetail();
  else if(state.view==='fichaForm')  app.innerHTML = renderFichaForm();
}

function renderList(){
  const term = state.search.trim().toLowerCase();
  const cidades = getCidades();
  let list = state.clientes.slice().sort((a,b)=>a.nome.localeCompare(b.nome));
  if(term){
    list = list.filter(c =>
      c.nome.toLowerCase().includes(term) ||
      (c.cidade||'').toLowerCase().includes(term) ||
      (c.telefone||'').toLowerCase().includes(term) ||
      (c.codigo||'').toLowerCase().includes(term)
    );
  }
  if(state.filterCidade){
    list = list.filter(c => (c.cidade||'').trim() === state.filterCidade);
  }
  const filtered = !!term || !!state.filterCidade;

  const rows = list.map(c => {
    const lv = lastVisit(c.id);
    const fichaCount = state.fichas.filter(x=>x.id_cliente===c.id).length;
    return `
      <button class="client-row" data-action="open-detail" data-id="${c.id}">
        <div>
          <div class="name">${esc(c.nome)}${c.codigo ? ` <span style="font-family:var(--font-mono);font-size:12px;color:var(--ink-soft);font-weight:400;margin-left:6px;">#${esc(c.codigo)}</span>` : ''}</div>
          <div class="sub">${esc(c.telefone)}${c.cidade ? ' · ' + esc(c.cidade) : ''}${c.nascimento ? ' · ' + fmtDate(c.nascimento) : ''}</div>
          <div class="sub" style="margin-top:2px;font-size:12px;">${fichaCount} ficha${fichaCount===1?'':'s'} de consulta</div>
        </div>
        <div class="visit">
          <span class="visit-label">Última consulta</span>
          ${lv ? fmtDate(lv) : 'Nenhuma'}
        </div>
      </button>`;
  }).join('');

  const body = list.length ? rows : `
    <div class="empty-state">
      <p>${filtered ? 'Nenhum cliente encontrado para esse filtro.' : 'Nenhum cliente cadastrado ainda.'}</p>
      ${filtered ? '' : '<button class="btn btn-primary" data-action="new-client">+ Cadastrar primeiro cliente</button>'}
    </div>`;

  const cidadeOptions = cidades.map(cid =>
    `<option value="${esc(cid)}" ${state.filterCidade===cid?'selected':''}>${esc(cid)}</option>`
  ).join('');

  return `
    <div class="view">
      <div class="toolbar">
        <input class="search-input" type="text" placeholder="🔍  Buscar por nome, telefone ou cidade…" value="${esc(state.search)}" data-bind="search">
        <select class="city-select" data-bind="cidade" ${cidades.length ? '' : 'disabled'} title="Filtrar por cidade">
          <option value="">Todas as cidades</option>
          ${cidadeOptions}
        </select>
        <button class="btn btn-primary" data-action="new-client">+ Novo cliente</button>
      </div>
      <p class="meta-line">${state.clientes.length} cliente${state.clientes.length===1?'':'s'} cadastrado${state.clientes.length===1?'':'s'}${filtered ? ` · ${list.length} resultado${list.length===1?'':'s'}` : ''}</p>
      ${body}
    </div>`;
}

function renderClientForm(){
  const editing = state.editingClientId != null;
  const c = editing ? state.clientes.find(x=>x.id===state.editingClientId) : null;
  return `
    <div class="view">
      <button class="back-link" data-action="cancel-client-form">← Voltar</button>
      <div class="card">
        <h2>${editing ? 'Editar cliente' : 'Novo cliente'}</h2>
        <form id="client-form">
          <div class="field">
            <label>Nome completo <span class="req">*</span></label>
            <input name="nome" required value="${c?esc(c.nome):''}">
          </div>
          <div class="field-row">
            <div class="field">
              <label>Telefone <span class="req">*</span></label>
              <input name="telefone" required placeholder="(00) 00000-0000" value="${c?esc(c.telefone):''}">
            </div>
            <div class="field">
              <label>Data de nascimento</label>
              <input type="date" name="nascimento" value="${c?esc(c.nascimento||''):''}">
            </div>
          </div>
          <div class="field">
            <label>Cidade</label>
            <input name="cidade" value="${c?esc(c.cidade||''):''}">
          </div>
          <div class="btn-row">
            <button type="submit" class="btn btn-primary">Salvar cliente</button>
            <button type="button" class="btn btn-secondary" data-action="cancel-client-form">Cancelar</button>
          </div>
        </form>
      </div>
    </div>`;
}

function renderDetail(){
  const c = state.clientes.find(x=>x.id===state.selectedClientId);
  if(!c){ state.view='list'; return renderList(); }
  const fichas = fichasOf(c.id);

  const confirmCliente = state.confirmDelete && state.confirmDelete.kind==='cliente' && state.confirmDelete.id===c.id
    ? `<div class="confirm-box">
         <span>Excluir este cliente e todo o histórico de consultas dele?</span>
         <span style="display:flex;gap:8px;">
           <button class="btn btn-danger" data-action="confirm-delete-client" data-id="${c.id}">Sim, excluir</button>
           <button class="btn btn-ghost" data-action="cancel-delete">Cancelar</button>
         </span>
       </div>` : '';

  const fichasHtml = fichas.length ? fichas.map(f => renderRxCard(f)).join('') : `
    <div class="empty-state"><p>Nenhuma ficha registrada ainda para este cliente.</p></div>`;

  return `
    <div class="view">
      <button class="back-link" data-action="back-to-list">← Voltar para clientes</button>
      <div class="card">
        <h2>${esc(c.nome)}</h2>
        ${c.codigo ? `<div style="font-family:var(--font-mono);font-size:13px;color:var(--ink-soft);margin-bottom:2px;">Código #${esc(c.codigo)}</div>` : ''}
        <div class="info-grid">
          <div><span class="label">Telefone</span>${esc(c.telefone)}</div>
          <div><span class="label">Cidade</span>${esc(c.cidade)||'—'}</div>
          <div><span class="label">Nascimento</span>${fmtDate(c.nascimento)}</div>
          <div><span class="label">Última consulta</span>${lastVisit(c.id)?fmtDate(lastVisit(c.id)):'Nenhuma'}</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-secondary" data-action="edit-client" data-id="${c.id}">Editar dados</button>
          <button class="btn btn-secondary" data-action="print-client" data-id="${c.id}">🖨️ Imprimir cadastro</button>
          <button class="btn btn-secondary" data-action="download-client" data-id="${c.id}">⬇️ Baixar PDF</button>
          <button class="btn btn-danger" data-action="ask-delete-client" data-id="${c.id}">Excluir cliente</button>
        </div>
        ${confirmCliente}
      </div>

      <div class="section-label">
        <span>Histórico de fichas (${fichas.length})</span>
        <button class="btn btn-primary" data-action="new-ficha" data-id="${c.id}">+ Nova ficha</button>
      </div>
      ${fichasHtml}
    </div>`;
}

function renderRxCard(f){
  const confirmFicha = state.confirmDelete && state.confirmDelete.kind==='ficha' && state.confirmDelete.id===f.id
    ? `<div class="confirm-box">
         <span>Excluir esta ficha de consulta?</span>
         <span style="display:flex;gap:8px;">
           <button class="btn btn-danger" data-action="confirm-delete-ficha" data-id="${f.id}">Sim, excluir</button>
           <button class="btn btn-ghost" data-action="cancel-delete">Cancelar</button>
         </span>
       </div>` : '';

  return `
    <div class="rx-card">
      <div class="rx-head">
        <span class="rx-date">${fmtDate(f.data)}</span>
        <span class="rx-doc">Dr(a). ${esc(f.oculista)}</span>
      </div>
      <div class="rx-grid">
        <div class="rx-eye">
          <div class="rx-eye-label">Olho direito (OD)</div>
          <div class="rx-meas"><span class="k">Esférico</span><span class="v">${fmtNum(f.od_esf)}</span></div>
          <div class="rx-meas"><span class="k">Cilíndrico</span><span class="v">${fmtNum(f.od_cil)}</span></div>
          <div class="rx-meas"><span class="k">Eixo</span><span class="v">${f.od_eixo||f.od_eixo===0?f.od_eixo+'°':'—'}</span></div>
          <div class="rx-meas"><span class="k">DNP</span><span class="v">${fmtMm(f.od_dnp)}</span></div>
          <div class="rx-meas"><span class="k">Altura</span><span class="v">${fmtMm(f.od_altura)}</span></div>
        </div>
        <div class="rx-divider"></div>
        <div class="rx-eye">
          <div class="rx-eye-label">Olho esquerdo (OE)</div>
          <div class="rx-meas"><span class="k">Esférico</span><span class="v">${fmtNum(f.oe_esf)}</span></div>
          <div class="rx-meas"><span class="k">Cilíndrico</span><span class="v">${fmtNum(f.oe_cil)}</span></div>
          <div class="rx-meas"><span class="k">Eixo</span><span class="v">${f.oe_eixo||f.oe_eixo===0?f.oe_eixo+'°':'—'}</span></div>
          <div class="rx-meas"><span class="k">DNP</span><span class="v">${fmtMm(f.oe_dnp)}</span></div>
          <div class="rx-meas"><span class="k">Altura</span><span class="v">${fmtMm(f.oe_altura)}</span></div>
        </div>
      </div>
      <div class="rx-foot">
        <span>Adição: <span class="v">${fmtNum(f.adicao)}</span></span>
      </div>
      ${f.obs ? `<div class="rx-obs">${esc(f.obs)}</div>` : ''}
      <div class="rx-actions">
        <button class="btn btn-secondary" data-action="edit-ficha" data-id="${f.id}">Editar</button>
        <button class="btn btn-secondary" data-action="print-ficha" data-id="${f.id}">🖨️ Imprimir</button>
        <button class="btn btn-secondary" data-action="download-ficha" data-id="${f.id}">⬇️ Baixar PDF</button>
        <button class="btn btn-danger" data-action="ask-delete-ficha" data-id="${f.id}">Excluir</button>
      </div>
      ${confirmFicha}
    </div>`;
}

function renderFichaForm(){
  const editing = state.editingFichaId != null;
  const f = editing ? state.fichas.find(x=>x.id===state.editingFichaId) : null;
  const clienteId = editing ? f.id_cliente : state.selectedClientId;
  const cliente = state.clientes.find(x=>x.id===clienteId);

  return `
    <div class="view">
      <button class="back-link" data-action="cancel-ficha-form">← Voltar</button>
      <div class="card">
        <h2>${editing ? 'Editar ficha' : 'Nova ficha de consulta'}</h2>
        <p class="meta-line">Cliente: <strong>${esc(cliente?cliente.nome:'')}</strong></p>
        <form id="ficha-form">
          <div class="field-row">
            <div class="field">
              <label>Data da consulta <span class="req">*</span></label>
              <input type="date" name="data" required value="${f?esc(f.data):''}">
            </div>
            <div class="field">
              <label>Oculista <span class="req">*</span></label>
              <input name="oculista" required placeholder="Nome do médico/optometrista" value="${f?esc(f.oculista):''}">
            </div>
          </div>

          <div class="field-group-label">Olho direito (OD)</div>
          <div class="field-row3">
            <div class="field"><label>Esférico</label><input type="number" step="0.25" name="od_esf" placeholder="ex: -2.00" value="${f&&f.od_esf!=null?f.od_esf:''}"></div>
            <div class="field"><label>Cilíndrico</label><input type="number" step="0.25" name="od_cil" placeholder="ex: -0.75" value="${f&&f.od_cil!=null?f.od_cil:''}"></div>
            <div class="field"><label>Eixo (0–180°)</label><input type="number" min="0" max="180" name="od_eixo" placeholder="ex: 90" value="${f&&f.od_eixo!=null?f.od_eixo:''}"></div>
          </div>
          <div class="field-row">
            <div class="field"><label>DNP (mm)</label><input type="number" step="0.5" min="20" max="40" name="od_dnp" placeholder="ex: 32.0" value="${f&&f.od_dnp!=null?f.od_dnp:''}"></div>
            <div class="field"><label>Altura (mm)</label><input type="number" step="0.5" min="10" max="40" name="od_altura" placeholder="ex: 18.0" value="${f&&f.od_altura!=null?f.od_altura:''}"></div>
          </div>

          <div class="field-group-label">Olho esquerdo (OE)</div>
          <div class="field-row3">
            <div class="field"><label>Esférico</label><input type="number" step="0.25" name="oe_esf" placeholder="ex: -2.00" value="${f&&f.oe_esf!=null?f.oe_esf:''}"></div>
            <div class="field"><label>Cilíndrico</label><input type="number" step="0.25" name="oe_cil" placeholder="ex: -0.75" value="${f&&f.oe_cil!=null?f.oe_cil:''}"></div>
            <div class="field"><label>Eixo (0–180°)</label><input type="number" min="0" max="180" name="oe_eixo" placeholder="ex: 90" value="${f&&f.oe_eixo!=null?f.oe_eixo:''}"></div>
          </div>
          <div class="field-row">
            <div class="field"><label>DNP (mm)</label><input type="number" step="0.5" min="20" max="40" name="oe_dnp" placeholder="ex: 31.0" value="${f&&f.oe_dnp!=null?f.oe_dnp:''}"></div>
            <div class="field"><label>Altura (mm)</label><input type="number" step="0.5" min="10" max="40" name="oe_altura" placeholder="ex: 18.0" value="${f&&f.oe_altura!=null?f.oe_altura:''}"></div>
          </div>

          <div class="field-group-label">Dados gerais</div>
          <div class="field-row">
            <div class="field"><label>Adição</label><input type="number" step="0.25" name="adicao" placeholder="ex: +2.00" value="${f&&f.adicao!=null?f.adicao:''}"></div>
          </div>
          <div class="field">
            <label>Observações</label>
            <textarea name="obs" placeholder="Tipo de lente, armação, observações clínicas…">${f?esc(f.obs||''):''}</textarea>
          </div>

          <div class="btn-row">
            <button type="submit" class="btn btn-primary">Salvar ficha</button>
            <button type="button" class="btn btn-secondary" data-action="cancel-ficha-form">Cancelar</button>
          </div>
        </form>
      </div>
    </div>`;
}

// ---------------- Eventos (delegados no #app) ----------------
const app = document.getElementById('app');

app.addEventListener('input', e=>{
  if(e.target.dataset.bind === 'search'){
    state.search = e.target.value;
    app.innerHTML = renderList();
    const input = app.querySelector('.search-input');
    if(input){ input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }
});

app.addEventListener('change', e=>{
  if(e.target.dataset.bind === 'cidade'){
    state.filterCidade = e.target.value;
    app.innerHTML = renderList();
  }
});

app.addEventListener('click', async (e)=>{
  const btn = e.target.closest('[data-action]');
  if(!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id ? parseInt(btn.dataset.id, 10) : null;

  if(action==='new-client'){ state.editingClientId=null; state.view='clientForm'; render(); }
  else if(action==='cancel-client-form'){ state.view = state.editingClientId!=null && state.selectedClientId ? 'detail' : 'list'; state.editingClientId=null; render(); }
  else if(action==='edit-client'){ state.editingClientId=id; state.view='clientForm'; render(); }
  else if(action==='open-detail'){ state.selectedClientId=id; state.confirmDelete=null; state.view='detail'; render(); }
  else if(action==='back-to-list'){ state.view='list'; state.confirmDelete=null; render(); }
  else if(action==='ask-delete-client'){ state.confirmDelete={kind:'cliente', id}; render(); }
  else if(action==='cancel-delete'){ state.confirmDelete=null; render(); }
  else if(action==='confirm-delete-client'){
    state.clientes = state.clientes.filter(c=>c.id!==id);
    state.fichas = state.fichas.filter(f=>f.id_cliente!==id);
    state.confirmDelete=null; state.view='list';
    render();
    try{ await deleteCliente(id); } catch(e){ showToast('Erro ao excluir cliente.', true); }
    showToast('Cliente excluído.');
  }
  else if(action==='new-ficha'){ state.editingFichaId=null; state.selectedClientId=id; state.view='fichaForm'; render(); }
  else if(action==='cancel-ficha-form'){ state.editingFichaId=null; state.view='detail'; render(); }
  else if(action==='edit-ficha'){ state.editingFichaId=id; state.view='fichaForm'; render(); }
  else if(action==='ask-delete-ficha'){ state.confirmDelete={kind:'ficha', id}; render(); }
  else if(action==='print-ficha'){ printFicha(id); }
  else if(action==='download-ficha'){ downloadFicha(id); }
  else if(action==='print-client'){ printClient(id); }
  else if(action==='download-client'){ downloadClient(id); }
  else if(action==='confirm-delete-ficha'){
    state.fichas = state.fichas.filter(f=>f.id!==id);
    state.confirmDelete=null; state.view='detail';
    render();
    try{ await deleteFicha(id); } catch(e){ showToast('Erro ao excluir ficha.', true); }
    showToast('Ficha excluída.');
  }
});

app.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(e.target.id === 'client-form'){
    const fd = new FormData(e.target);
    const nome = fd.get('nome').trim();
    const telefone = fd.get('telefone').trim();
    if(!nome || !telefone){ showToast('Preencha nome e telefone.', true); return; }

    if(state.editingClientId != null){
      // Edição: atualiza localmente e faz upsert
      const c = state.clientes.find(x=>x.id===state.editingClientId);
      c.nome = nome; c.telefone = telefone;
      c.nascimento = fd.get('nascimento') || null;
      c.cidade = fd.get('cidade').trim();
      state.editingClientId = null;
      state.view = 'detail';
      render();
      await persistClientes(c);
      showToast('Cliente salvo.');
    } else {
      // Inserção: usa insert (sem id) para o Supabase gerar → recarrega lista para obter o id real
      let codigo;
      try { codigo = await getNextCodigo(); } catch(e) { codigo = null; }
      const novo = { nome, telefone,
        nascimento: fd.get('nascimento') || null,
        cidade: fd.get('cidade').trim(),
        codigo };
      try {
        await insertCliente(novo);
        state.clientes = await getClientes();
      } catch(e) { showToast('Não foi possível salvar. Tente novamente.', true); return; }
      state.editingClientId = null;
      state.view = 'list';
      render();
      showToast('Cliente salvo.');
    }
  }

  if(e.target.id === 'ficha-form'){
    const fd = new FormData(e.target);
    const num = (key)=> fd.get(key)==='' ? null : parseFloat(fd.get(key));
    const data = fd.get('data');
    const oculista = fd.get('oculista').trim();
    if(!data || !oculista){ showToast('Preencha data e oculista.', true); return; }

    const payload = {
      data, oculista,
      od_esf:num('od_esf'), od_cil:num('od_cil'), od_eixo:num('od_eixo'),
      od_dnp:num('od_dnp'), od_altura:num('od_altura'),
      oe_esf:num('oe_esf'), oe_cil:num('oe_cil'), oe_eixo:num('oe_eixo'),
      oe_dnp:num('oe_dnp'), oe_altura:num('oe_altura'),
      adicao:num('adicao'),
      obs: fd.get('obs').trim()
    };

    if(state.editingFichaId != null){
      // Edição: atualiza localmente e faz upsert
      const f = state.fichas.find(x=>x.id===state.editingFichaId);
      Object.assign(f, payload);
      state.editingFichaId = null;
      state.view = 'detail';
      render();
      await persistFichas(f);
      showToast('Ficha salva.');
    } else {
      // Inserção: usa insert (sem id) para o Supabase gerar → recarrega fichas para obter o id real
      const nova = Object.assign({ id_cliente: state.selectedClientId }, payload);
      try {
        await insertFicha(nova);
        state.fichas = await getFichas();
      } catch(e) { showToast('Não foi possível salvar. Tente novamente.', true); return; }
      state.editingFichaId = null;
      state.view = 'detail';
      render();
      showToast('Ficha salva.');
    }
  }
});

// ---------------- Impressão / Download (ficha e cadastro) ----------------
// Os dois documentos (ficha de consulta e cadastro do cliente) compartilham
// o mesmo "papel timbrado" — por isso o CSS abaixo é único e reaproveitado.
const PR_STYLE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #14213D; background: #fff; padding: 28px 32px; }
  .pr-header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #14213D; padding-bottom: 14px; margin-bottom: 18px; }
  .pr-logo { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; }
  .pr-brand-name { font-family: Georgia, serif; font-size: 20px; font-weight: 700; letter-spacing: 0.04em; }
  .pr-brand-sub { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #6b7280; margin-top: 2px; }
  .pr-title { font-family: Georgia, serif; font-size: 16px; font-weight: 700; text-align: center; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 16px; color: #14213D; }
  .pr-client-box { background: #F7F5F0; border: 1px solid #D8D2C4; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; font-size: 13px; }
  .pr-cl-label { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #9A9486; display: block; margin-bottom: 1px; }
  .pr-cl-full { grid-column: 1 / -1; font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .pr-grid { display: grid; grid-template-columns: 1fr 1px 1fr; border: 1px solid #D8D2C4; border-radius: 6px; overflow: hidden; margin-bottom: 14px; }
  .pr-eye { padding: 12px 16px; }
  .pr-divider { background: #D8D2C4; }
  .pr-eye-label { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: #2F6F68; font-weight: 700; margin-bottom: 8px; }
  .pr-table { width: 100%; border-collapse: collapse; }
  .pr-table .pr-label { color: #6b7280; padding: 3px 0; width: 50%; }
  .pr-table .pr-val { font-family: 'Courier New', monospace; font-weight: 700; padding: 3px 0; }
  .pr-footer-row { display: flex; gap: 24px; border: 1px solid #D8D2C4; border-radius: 6px; padding: 10px 16px; font-size: 13px; margin-bottom: 14px; color: #6b7280; }
  .pr-fv { font-family: 'Courier New', monospace; font-weight: 700; color: #14213D; }
  .pr-obs-box { border: 1px solid #D8D2C4; border-radius: 6px; padding: 10px 16px; margin-bottom: 14px; }
  .pr-obs-label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #9A9486; display: block; margin-bottom: 4px; }
  .pr-obs-text { font-size: 13px; color: #14213D; line-height: 1.5; }
  .pr-sign { margin-top: 36px; display: flex; justify-content: flex-end; }
  .pr-sign-box { width: 220px; text-align: center; }
  .pr-sign-line { border-top: 1px solid #14213D; margin-bottom: 6px; }
  .pr-sign-label { font-size: 11px; color: #6b7280; }
  .pr-date-line { font-size: 11px; color: #9A9486; text-align: center; margin-top: 28px; }
  .pr-section-title { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #2F6F68; font-weight: 700; margin: 22px 0 10px; }
  .pr-hist-table { width: 100%; border-collapse: collapse; border: 1px solid #D8D2C4; border-radius: 6px; overflow: hidden; font-size: 12.5px; }
  .pr-hist-table th { text-align: left; background: #F7F5F0; color: #6b7280; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; padding: 8px 10px; border-bottom: 1px solid #D8D2C4; }
  .pr-hist-table td { padding: 8px 10px; border-bottom: 1px solid #E7E2D6; vertical-align: top; }
  .pr-hist-table tr:last-child td { border-bottom: none; }
  .pr-hist-empty { padding: 16px; text-align: center; color: #9A9486; font-size: 13px; }
  @media print { body { padding: 16px 20px; } @page { margin: 12mm; size: A4; } }
`;

const PR_HEADER = `
<div class="pr-header">
  <img class="pr-logo" src="logo.png" alt="Logo" onerror="this.style.display='none'">
  <div>
    <div class="pr-brand-name">Óticas Precisão</div>
    <div class="pr-brand-sub">Cuidando dos seus olhos</div>
  </div>
</div>`;

function fichaDocParts(fichaId) {
  const f = state.fichas.find(x => x.id === fichaId);
  if (!f) return null;
  const c = state.clientes.find(x => x.id === f.id_cliente);
  const idade = c && c.nascimento ? calcIdade(c.nascimento) : '';

  const row = (label, val) =>
    `<tr><td class="pr-label">${label}</td><td class="pr-val">${val}</td></tr>`;

  const obsHtml = f.obs
    ? `<div class="pr-obs-box"><span class="pr-obs-label">Observações</span><p class="pr-obs-text">${esc(f.obs)}</p></div>`
    : '';

  const bodyHtml = `
${PR_HEADER}
<div class="pr-title">Ficha de Consulta · Receita Óptica</div>
<div class="pr-client-box">
  <div class="pr-cl-full"><span class="pr-cl-label">Paciente</span>${esc(c ? c.nome : '—')}</div>
  <div><span class="pr-cl-label">Telefone</span>${esc(c ? c.telefone : '—')}</div>
  <div><span class="pr-cl-label">Data de nascimento</span>${c && c.nascimento ? fmtDate(c.nascimento) + (idade ? ' · ' + idade : '') : '—'}</div>
  <div><span class="pr-cl-label">Data da consulta</span>${fmtDate(f.data)}</div>
  <div><span class="pr-cl-label">Oculista / Optometrista</span>Dr(a). ${esc(f.oculista)}</div>
</div>
<div class="pr-grid">
  <div class="pr-eye">
    <div class="pr-eye-label">Olho Direito (OD)</div>
    <table class="pr-table">
      ${row('Esférico', fmtNum(f.od_esf))}
      ${row('Cilíndrico', fmtNum(f.od_cil))}
      ${row('Eixo', f.od_eixo || f.od_eixo === 0 ? f.od_eixo + '°' : '—')}
      ${row('DNP', fmtMm(f.od_dnp))}
      ${row('Altura', fmtMm(f.od_altura))}
    </table>
  </div>
  <div class="pr-divider"></div>
  <div class="pr-eye">
    <div class="pr-eye-label">Olho Esquerdo (OE)</div>
    <table class="pr-table">
      ${row('Esférico', fmtNum(f.oe_esf))}
      ${row('Cilíndrico', fmtNum(f.oe_cil))}
      ${row('Eixo', f.oe_eixo || f.oe_eixo === 0 ? f.oe_eixo + '°' : '—')}
      ${row('DNP', fmtMm(f.oe_dnp))}
      ${row('Altura', fmtMm(f.oe_altura))}
    </table>
  </div>
</div>
<div class="pr-footer-row">
  <span>Adição: <span class="pr-fv">${fmtNum(f.adicao)}</span></span>
</div>
${obsHtml}
<div class="pr-sign">
  <div class="pr-sign-box">
    <div class="pr-sign-line"></div>
    <div class="pr-sign-label">Assinatura / Carimbo do responsável</div>
  </div>
</div>
<div class="pr-date-line">Documento gerado em ${new Date().toLocaleDateString('pt-BR')} · Óticas Precisão</div>`;

  return {
    title: `Receita — ${c ? c.nome : ''} — ${fmtDate(f.data)}`,
    filename: `Receita_${(c ? c.nome : 'cliente').replace(/\s+/g, '_')}_${f.data}.pdf`,
    bodyHtml
  };
}

function clientDocParts(clientId) {
  const c = state.clientes.find(x => x.id === clientId);
  if (!c) return null;
  const fichas = fichasOf(c.id);
  const idade = c.nascimento ? calcIdade(c.nascimento) : '';
  const lv = lastVisit(c.id);

  const histRows = fichas.map(f => `
    <tr>
      <td>${fmtDate(f.data)}</td>
      <td>Dr(a). ${esc(f.oculista)}</td>
      <td>OD ${fmtNum(f.od_esf)} / ${fmtNum(f.od_cil)}</td>
      <td>OE ${fmtNum(f.oe_esf)} / ${fmtNum(f.oe_cil)}</td>
    </tr>`).join('');

  const histHtml = fichas.length
    ? `<table class="pr-hist-table">
         <thead><tr><th>Data</th><th>Oculista</th><th>OD (esf/cil)</th><th>OE (esf/cil)</th></tr></thead>
         <tbody>${histRows}</tbody>
       </table>`
    : `<div class="pr-hist-empty">Nenhuma ficha de consulta registrada.</div>`;

  const bodyHtml = `
${PR_HEADER}
<div class="pr-title">Ficha Cadastral do Cliente</div>
<div class="pr-client-box">
  <div class="pr-cl-full"><span class="pr-cl-label">Nome completo</span>${esc(c.nome)}${c.codigo ? ` <span style="font-family:'Courier New',monospace;font-size:12px;color:#6b7280;font-weight:400;margin-left:8px;">#${esc(c.codigo)}</span>` : ''}</div>
  <div><span class="pr-cl-label">Telefone</span>${esc(c.telefone) || '—'}</div>
  <div><span class="pr-cl-label">Cidade</span>${esc(c.cidade) || '—'}</div>
  <div><span class="pr-cl-label">Data de nascimento</span>${c.nascimento ? fmtDate(c.nascimento) + (idade ? ' · ' + idade : '') : '—'}</div>
  <div><span class="pr-cl-label">Última consulta</span>${lv ? fmtDate(lv) : 'Nenhuma'}</div>
</div>
<div class="pr-section-title">Histórico de consultas (${fichas.length})</div>
${histHtml}
<div class="pr-date-line">Documento gerado em ${new Date().toLocaleDateString('pt-BR')} · Óticas Precisão</div>`;

  return {
    title: `Cadastro — ${c.nome}`,
    filename: `Cadastro_${c.nome.replace(/\s+/g, '_')}.pdf`,
    bodyHtml
  };
}

function openPrintWindow(title, bodyHtml) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<style>${PR_STYLE}</style>
</head>
<body>${bodyHtml}</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { showToast('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.', true); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}

function waitForImages(container, timeout = 1500) {
  const imgs = Array.from(container.querySelectorAll('img'));
  if (!imgs.length) return Promise.resolve();
  return Promise.race([
    Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res; }))),
    new Promise(res => setTimeout(res, timeout))
  ]);
}

// Gera um PDF de verdade (não depende do diálogo de impressão do navegador),
// então funciona da mesma forma em computador e celular.
let _pdfLibsPromise = null;
function loadPdfLibs() {
  if (!_pdfLibsPromise) {
    _pdfLibsPromise = Promise.all([
      import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm'),
      import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm')
    ]).then(([jspdfMod, html2canvasMod]) => ({
      jsPDF: jspdfMod.jsPDF,
      html2canvas: html2canvasMod.default
    }));
  }
  return _pdfLibsPromise;
}

async function downloadAsPdf(filename, bodyHtml) {
  showToast('Gerando PDF…');

  let jsPDF, html2canvas;
  try {
    ({ jsPDF, html2canvas } = await loadPdfLibs());
  } catch (err) {
    console.error('Falha ao carregar bibliotecas de PDF:', err);
    showToast('Não foi possível carregar o gerador de PDF. Verifique sua conexão e tente de novo.', true);
    _pdfLibsPromise = null; // permite tentar de novo na próxima vez
    return;
  }

  const holder = document.createElement('div');
  holder.style.position = 'fixed';
  holder.style.left = '-10000px';
  holder.style.top = '0';
  holder.style.width = '794px'; // largura aproximada de uma página A4 a 96dpi
  holder.style.background = '#fff';

  const styleTag = document.createElement('style');
  styleTag.textContent = PR_STYLE;
  holder.appendChild(styleTag);

  const content = document.createElement('div');
  content.innerHTML = bodyHtml;
  holder.appendChild(content);
  document.body.appendChild(holder);

  try {
    await waitForImages(holder);
    const canvas = await html2canvas(holder, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
    showToast('PDF baixado.');
  } catch (err) {
    console.error(err);
    showToast('Não foi possível gerar o PDF.', true);
  } finally {
    document.body.removeChild(holder);
  }
}

function printFicha(fichaId) {
  const parts = fichaDocParts(fichaId);
  if (!parts) return;
  openPrintWindow(parts.title, parts.bodyHtml);
}

function downloadFicha(fichaId) {
  const parts = fichaDocParts(fichaId);
  if (!parts) return;
  downloadAsPdf(parts.filename, parts.bodyHtml);
}

function printClient(clientId) {
  const parts = clientDocParts(clientId);
  if (!parts) return;
  openPrintWindow(parts.title, parts.bodyHtml);
}

function downloadClient(clientId) {
  const parts = clientDocParts(clientId);
  if (!parts) return;
  downloadAsPdf(parts.filename, parts.bodyHtml);
}

loadAll();
