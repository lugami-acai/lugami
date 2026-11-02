-- =====================================================================
--  Banco de dados da Lugami (Supabase).
--  Rode tudo de uma vez em: Supabase → SQL Editor → New query → Run.
--  No fim, troque o e-mail do administrador pelo seu.
-- =====================================================================

-- Quem pode entrar no painel da loja
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;  -- sem políticas: ninguém lê pela internet

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where email = auth.jwt() ->> 'email');
$$;

-- Configuração da loja: aberta/fechada, itens esgotados e cardápio editado no painel
create table if not exists public.config_loja (
  id int primary key default 1 check (id = 1),
  aberto boolean not null default true,
  esgotados text[] not null default '{}',
  cardapio jsonb            -- null = usa o cardápio do js/config.js
);
insert into public.config_loja (id) values (1) on conflict do nothing;
alter table public.config_loja enable row level security;

drop policy if exists "todos leem a config" on public.config_loja;
create policy "todos leem a config" on public.config_loja
  for select to anon, authenticated using (true);

drop policy if exists "admin altera a config" on public.config_loja;
create policy "admin altera a config" on public.config_loja
  for update to authenticated using (is_admin()) with check (is_admin());

-- Pedidos
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  status text not null default 'enviado'
    check (status in ('enviado', 'aceito', 'preparo', 'caminho', 'entregue', 'cancelado')),
  cliente_nome text not null,
  cliente_telefone text not null,
  tipo_entrega text not null check (tipo_entrega in ('entrega', 'retirada')),
  endereco text,
  referencia text,
  pagamento text not null,
  troco_para numeric,
  observacoes text,
  itens jsonb not null,
  subtotal numeric not null,
  taxa_entrega numeric not null default 0,
  total numeric not null,
  previsao_min int,
  motivo_cancelamento text
);
alter table public.pedidos enable row level security;

-- Só o admin lê/altera a lista de pedidos (com nomes, telefones e endereços)
drop policy if exists "admin gerencia pedidos" on public.pedidos;
create policy "admin gerencia pedidos" on public.pedidos
  for all to authenticated using (is_admin()) with check (is_admin());

-- O cliente cria pedido por esta função (não tem acesso direto à tabela)
create or replace function public.criar_pedido(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  novo pedidos;
begin
  if not (select aberto from config_loja where id = 1) then
    raise exception 'A loja está fechada no momento.';
  end if;
  if length(trim(coalesce(p->>'cliente_nome', ''))) < 2
     or length(regexp_replace(coalesce(p->>'cliente_telefone', ''), '\D', '', 'g')) < 10 then
    raise exception 'Informe nome e telefone.';
  end if;
  if jsonb_typeof(p->'itens') is distinct from 'array'
     or jsonb_array_length(p->'itens') = 0 or jsonb_array_length(p->'itens') > 30 then
    raise exception 'Pedido sem itens.';
  end if;

  insert into pedidos (cliente_nome, cliente_telefone, tipo_entrega, endereco, referencia,
                       pagamento, troco_para, observacoes, itens, subtotal, taxa_entrega, total)
  values (left(trim(p->>'cliente_nome'), 80),
          left(regexp_replace(p->>'cliente_telefone', '\D', '', 'g'), 13),
          p->>'tipo_entrega',
          left(p->>'endereco', 300),
          left(p->>'referencia', 200),
          left(p->>'pagamento', 40),
          nullif(p->>'troco_para', '')::numeric,
          left(p->>'observacoes', 500),
          p->'itens',
          (p->>'subtotal')::numeric,
          coalesce((p->>'taxa_entrega')::numeric, 0),
          (p->>'total')::numeric)
  returning * into novo;

  return jsonb_build_object('id', novo.id, 'numero', novo.numero);
end;
$$;

-- O cliente acompanha o próprio pedido pelo id (link), sem ver telefone/endereço
create or replace function public.ver_pedido(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', id, 'numero', numero, 'criado_em', criado_em, 'status', status,
    'tipo_entrega', tipo_entrega, 'itens', itens, 'subtotal', subtotal,
    'taxa_entrega', taxa_entrega, 'total', total, 'pagamento', pagamento,
    'previsao_min', previsao_min, 'motivo_cancelamento', motivo_cancelamento)
  from pedidos where id = p_id;
$$;

grant execute on function public.criar_pedido(jsonb) to anon, authenticated;
grant execute on function public.ver_pedido(uuid) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- Aviso em tempo real de novos pedidos no painel
do $$ begin
  alter publication supabase_realtime add table public.pedidos;
exception when duplicate_object then null;
end $$;

-- >>> TROQUE pelo e-mail que você vai usar para entrar no painel <<<
insert into public.admins (email) values ('SEU-EMAIL@exemplo.com') on conflict do nothing;
