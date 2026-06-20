// data.js — Ótica Precisão · Camada de dados (Supabase)
// ---------------------------------------------------------------------
// Os dados agora ficam salvos no Supabase e são compartilhados entre
// todos os dispositivos e funcionários em tempo real.
// ---------------------------------------------------------------------

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL  = 'https://kwonfxmwqraudjvxwhbk.supabase.co';
const SUPABASE_ANON = 'sb_publishable_zalsVfTLnDaxEP2bzfNlag_xhq15cOk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ---------- Autenticação ----------

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

// ---------- Clientes ----------

export async function getClientes() {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nome');
  if (error) throw error;
  return data;
}

/**
 * Recebe um único objeto cliente (com ou sem id) e faz upsert.
 * Chamado por persistClientes() em app.js — que passa o array inteiro.
 * Para manter compatibilidade com a assinatura original, percorremos o array.
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
  // Normaliza o campo id_cliente para número (vem como bigint do Postgres)
  return data.map(f => ({ ...f, id_cliente: Number(f.id_cliente) }));
}

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
