-- 01_schema.sql — Estrutura do banco da plataforma de moda local
-- Rodar no SQL Editor do Supabase.

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('cliente', 'lojista')),
  telefone text check (telefone ~ '^[0-9]{12,13}$'),
  criado_em timestamptz not null default now()
);

create table public.lojas (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null unique references public.perfis (id) on delete cascade,
  nome text not null,
  descricao text,
  endereco text not null,
  cidade text not null,
  whatsapp text check (whatsapp ~ '^[0-9]{12,13}$'),
  link_mapa text,
  imagem_url text,
  criado_em timestamptz not null default now()
);

create table public.categorias (
  id bigint generated always as identity primary key,
  nome text not null unique
);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas (id) on delete cascade,
  categoria_id bigint not null references public.categorias (id),
  nome text not null,
  descricao text,
  preco numeric(10,2) not null check (preco > 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- RN-12: até 5 fotos por produto; a de menor ordem é a capa
create table public.produto_fotos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos (id) on delete cascade,
  url text not null,
  caminho text, -- caminho do arquivo no Storage (vazio se a foto for um link externo)
  ordem integer not null default 1 check (ordem between 1 and 5),
  criado_em timestamptz not null default now()
);

create table public.tamanhos (
  produto_id uuid not null references public.produtos (id) on delete cascade,
  tamanho text not null,
  estoque integer not null default 0 check (estoque >= 0),
  primary key (produto_id, tamanho)
);

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.perfis (id),
  loja_id uuid not null references public.lojas (id),
  status text not null default 'novo'
    check (status in ('novo', 'confirmado', 'concluido', 'cancelado')),
  total numeric(10,2) not null check (total >= 0),
  observacao text,
  -- RN-03: pedidos criados na mesma finalização da sacola (um por loja) compartilham o grupo_id
  grupo_id uuid not null default gen_random_uuid(),
  -- RN-13: recado da lojista e controle de aviso à cliente
  mensagem_loja text,
  status_visto boolean not null default true,
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

create table public.itens_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  produto_id uuid not null references public.produtos (id),
  tamanho text not null,
  quantidade integer not null check (quantidade >= 1),
  preco_unitario numeric(10,2) not null check (preco_unitario > 0)
);

create index on public.produtos (loja_id);
create index on public.produtos (categoria_id);
create index on public.produto_fotos (produto_id);
create index on public.pedidos (cliente_id);
create index on public.pedidos (loja_id);
create index on public.pedidos (grupo_id);
create index on public.itens_pedido (pedido_id);

-- Gatilho: cria o perfil quando uma usuária se cadastra (lê nome e tipo enviados no cadastro)
create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- só dígitos; vale apenas se tiver código do país + DDD + número (12 ou 13 dígitos)
  v_telefone text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'telefone', ''), '[^0-9]', '', 'g');
begin
  insert into public.perfis (id, nome, tipo, telefone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', 'Sem nome'),
    case when new.raw_user_meta_data ->> 'tipo' = 'lojista' then 'lojista' else 'cliente' end,
    case when v_telefone ~ '^[0-9]{12,13}$' then v_telefone else null end
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
after insert on auth.users
for each row execute function public.criar_perfil_novo_usuario();

-- RN-11: o perfil (cliente ou lojista) não muda depois do cadastro
create or replace function public.impedir_troca_de_tipo()
returns trigger
language plpgsql
as $$
begin
  if new.tipo <> old.tipo then
    raise exception 'O perfil da usuária não pode ser alterado.';
  end if;
  return new;
end;
$$;

create trigger perfis_nao_troca_tipo
before update on public.perfis
for each row execute function public.impedir_troca_de_tipo();

-- RN-12: no máximo 5 fotos por produto
create or replace function public.limitar_fotos_por_produto()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.produto_fotos where produto_id = new.produto_id) >= 5 then
    raise exception 'Cada produto pode ter no máximo 5 fotos.';
  end if;
  return new;
end;
$$;

create trigger fotos_limite_por_produto
before insert on public.produto_fotos
for each row execute function public.limitar_fotos_por_produto();

-- RN-13: a lojista só altera status e recado; quando eles mudam, a cliente passa a ter uma novidade
create or replace function public.proteger_e_marcar_pedido()
returns trigger
language plpgsql
as $$
begin
  if new.cliente_id <> old.cliente_id
     or new.loja_id <> old.loja_id
     or new.total <> old.total
     or new.grupo_id <> old.grupo_id
     or new.criado_em <> old.criado_em
     or new.observacao is distinct from old.observacao then
    raise exception 'Só o status e o recado do pedido podem ser alterados.';
  end if;

  if new.status <> old.status or new.mensagem_loja is distinct from old.mensagem_loja then
    new.status_visto := false;
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;

create trigger pedidos_protegidos
before update on public.pedidos
for each row execute function public.proteger_e_marcar_pedido();

-- RN-13: a cliente abre Meus pedidos e marca as novidades como vistas.
-- É uma função (e não um update direto) para a cliente não poder alterar nenhuma outra coluna.
create or replace function public.marcar_pedidos_como_vistos()
returns void
language sql
security definer
set search_path = public
as $$
  update public.pedidos
  set status_visto = true
  where cliente_id = auth.uid() and status_visto = false;
$$;

revoke execute on function public.marcar_pedidos_como_vistos() from public, anon;
grant execute on function public.marcar_pedidos_como_vistos() to authenticated;