-- ============================================================
-- Óticas Precisão · Migração: adicionar código de cliente
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Adiciona a coluna codigo (texto, único, opcional por enquanto)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS codigo TEXT;

-- 2. Popula clientes existentes com códigos sequenciais
--    Ordenados por id (quem entrou primeiro recebe 0001)
WITH numerados AS (
  SELECT id,
         LPAD(ROW_NUMBER() OVER (ORDER BY id)::TEXT, 4, '0') AS novo_codigo
  FROM clientes
  WHERE codigo IS NULL
)
UPDATE clientes
SET codigo = numerados.novo_codigo
FROM numerados
WHERE clientes.id = numerados.id;

-- 3. Adiciona constraint UNIQUE para evitar duplicatas futuras
ALTER TABLE clientes
  ADD CONSTRAINT clientes_codigo_unique UNIQUE (codigo);
