// data.js — Ótica Precisão · Camada de dados (Supabase)
// ---------------------------------------------------------------------
// Os dados agora ficam salvos no Supabase e são compartilhados entre
// todos os dispositivos e funcionários em tempo real.
// ---------------------------------------------------------------------

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://kwonfxmwqraudjvxwhbk.supabase.co';
const SUPABASE_ANON = 'sb_publishable_zalsVfTLnDaxEP2bzfNlag_xhq15cOk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ---------- Clientes ----------

/**
 * Retorna o próximo código sequencial disponível (ex: "0042").
 * Busca o maior código numérico existente e incrementa.
 */
export async function getNextCodigo() {
  const { data, error } = await supabase
    .from('clientes')
    .select('codigo')
    .not('codigo', 'is', null);
  if (error) throw error;
  const max = data.reduce((acc, row) => {
    const n = parseInt(row.codigo, 10);
    return isNaN(n) ? acc : Math.max(acc, n);
  }, 0);
  return String(max + 1).padStart(4, '0');
}

export async function getClientes() {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nome');
  if (error) throw error;
  // Normaliza id para número (vem como bigint do Postgres)
  return data.map(c => ({ ...c, id: Number(c.id) }));
}

/**
 * Insere um novo cliente (sem id — Supabase gera automaticamente).
 * Usar apenas na criação; para edição use saveClientes().
 */
export async function insertCliente(cliente) {
  const { error } = await supabase
    .from('clientes')
    .insert(cliente);
  if (error) throw error;
}

/**
 * Atualiza clientes existentes via upsert (objetos devem ter id).
 * Chamado pela edição de clientes.
 */
export async function saveClientes(clientes) {
  if (!Array.isArray(clientes) || clientes.length === 0) return;
  const { error } = await supabase
    .from('clientes')
    .upsert(clientes, { onConflict: 'id' });
  if (error) throw error;
}

// ---------- Fichas ----------

export async function getFichas() {
  const { data, error } = await supabase
    .from('fichas_consulta')
    .select('*')
    .order('data', { ascending: false });
  if (error) throw error;
  // Normaliza id e id_cliente para número (vem como bigint do Postgres)
  return data.map(f => ({ ...f, id: Number(f.id), id_cliente: Number(f.id_cliente) }));
}

/**
 * Insere uma nova ficha (sem id — Supabase gera automaticamente).
 * Usar apenas na criação; para edição use saveFichas().
 */
export async function insertFicha(ficha) {
  const { error } = await supabase
    .from('fichas_consulta')
    .insert(ficha);
  if (error) throw error;
}

/**
 * Atualiza fichas existentes via upsert (objetos devem ter id).
 * Chamado pela edição de fichas.
 */
export async function saveFichas(fichas) {
  if (!Array.isArray(fichas) || fichas.length === 0) return;
  const { error } = await supabase
    .from('fichas_consulta')
    .upsert(fichas, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteCliente(id) {
  const { error } = await supabase
    .from('clientes')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function deleteFicha(id) {
  const { error } = await supabase
    .from('fichas_consulta')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
