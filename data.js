// data.js
// ---------------------------------------------------------------------
// Camada de dados do sistema da Ótica Precisão.
//
// HOJE: os dados ficam salvos no localStorage do navegador. Funciona
// bem para testar, mas cada computador guarda sua própria cópia —
// os dados NÃO são compartilhados entre funcionários ainda.
//
// QUANDO CONECTAR O SUPABASE: troque só as 4 funções abaixo pelas
// chamadas ao Supabase (exemplo completo no final do arquivo).
// O resto do site (app.js) não precisa mudar nada.
// ---------------------------------------------------------------------

const STORAGE_KEYS = {
  clientes: 'otica_precisao_clientes',
  fichas: 'otica_precisao_fichas'
};

export async function getClientes() {
  const raw = localStorage.getItem(STORAGE_KEYS.clientes);
  return raw ? JSON.parse(raw) : [];
}

export async function saveClientes(clientes) {
  localStorage.setItem(STORAGE_KEYS.clientes, JSON.stringify(clientes));
}

export async function getFichas() {
  const raw = localStorage.getItem(STORAGE_KEYS.fichas);
  return raw ? JSON.parse(raw) : [];
}

export async function saveFichas(fichas) {
  localStorage.setItem(STORAGE_KEYS.fichas, JSON.stringify(fichas));
}

/* =======================================================================
   COMO TROCAR PARA SUPABASE (passo a passo)

   1) No index.html, antes de <script type="module" src="app.js">, adicione:
        <script type="module">
          import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
          window.supabase = createClient('SUA_URL_DO_PROJETO', 'SUA_CHAVE_PUBLICA_ANON');
        </script>

      (a URL e a chave aparecem no painel do Supabase, em Project Settings > API)

   2) Crie as tabelas no Supabase com o SQL abaixo.

   3) Substitua as 4 funções deste arquivo pelo bloco mais abaixo.

   -----------------------------------------------------------------------
   SQL PARA CRIAR AS TABELAS (cole no SQL Editor do Supabase):
   -----------------------------------------------------------------------

   create table clientes (
     id bigint generated always as identity primary key,
     nome text not null,
     telefone text not null,
     nascimento date,
     cidade text
   );

   create table fichas_consulta (
     id bigint generated always as identity primary key,
     id_cliente bigint not null references clientes(id) on delete cascade,
     data date not null,
     oculista text not null,
     -- Olho direito
     od_esf numeric(4,2),
     od_cil numeric(4,2),
     od_eixo int,
     od_dnp numeric(4,1),
     od_altura numeric(4,1),
     -- Olho esquerdo
     oe_esf numeric(4,2),
     oe_cil numeric(4,2),
     oe_eixo int,
     oe_dnp numeric(4,1),
     oe_altura numeric(4,1),
     -- Dados gerais
     adicao numeric(4,2),
     obs text
   );

   alter table clientes enable row level security;
   alter table fichas_consulta enable row level security;

   create policy "Acesso total clientes" on clientes for all using (true) with check (true);
   create policy "Acesso total fichas" on fichas_consulta for all using (true) with check (true);

   -----------------------------------------------------------------------
   FUNÇÕES SUPABASE (substituir as 4 funções acima):
   -----------------------------------------------------------------------

   export async function getClientes() {
     const { data, error } = await supabase.from('clientes').select('*');
     if (error) throw error;
     return data;
   }

   export async function saveClientes(clientes) {
     const { error } = await supabase.from('clientes').upsert(clientes);
     if (error) throw error;
   }

   export async function getFichas() {
     const { data, error } = await supabase.from('fichas_consulta').select('*');
     if (error) throw error;
     return data;
   }

   export async function saveFichas(fichas) {
     const { error } = await supabase.from('fichas_consulta').upsert(fichas);
     if (error) throw error;
   }

   Pronto — todos os funcionários que acessarem o site verão e editarão
   os mesmos dados, de qualquer computador ou celular.
======================================================================= */
