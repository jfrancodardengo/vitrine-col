-- 02_rls.sql — Regras de acesso (Row Level Security) e Storage
-- Rodar só depois que o login funcionar (Fase 5). Pode ser rodado mais de uma vez: cada política
-- é apagada e criada de novo. Depois dele, rode o 04_melhorias.sql (gravação de pedidos e conta).
-- Se existir a política provisória de desenvolvimento, apague:
drop policy if exists "dev: envio de fotos" on storage.objects;

-- Funções auxiliares (security definer evita recursão entre políticas)
create or replace function public.sou_dono_da_loja(p_loja_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lojas where id = p_loja_id and dono_id = auth.uid()
  );
$$;

create or replace function public.sou_dono_do_produto(p_produto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.produtos pr
    join public.lojas l on l.id = pr.loja_id
    where pr.id = p_produto_id and l.dono_id = auth.uid()
  );
$$;

alter table public.perfis enable row level security;
alter table public.lojas enable row level security;
alter table public.categorias enable row level security;
alter table public.produtos enable row level security;
alter table public.tamanhos enable row level security;
alter table public.produto_fotos enable row level security;
alter table public.pedidos enable row level security;
alter table public.itens_pedido enable row level security;

-- perfis
drop policy if exists "perfis: ler o proprio" on public.perfis;
create policy "perfis: ler o proprio" on public.perfis
  for select to authenticated using (id = auth.uid());
drop policy if exists "perfis: lojista le clientes dos seus pedidos" on public.perfis;
create policy "perfis: lojista le clientes dos seus pedidos" on public.perfis
  for select to authenticated
  using (exists (
    select 1 from public.pedidos p
    where p.cliente_id = perfis.id and public.sou_dono_da_loja(p.loja_id)
  ));
drop policy if exists "perfis: alterar o proprio" on public.perfis;
create policy "perfis: alterar o proprio" on public.perfis
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- lojas
drop policy if exists "lojas: todos leem" on public.lojas;
create policy "lojas: todos leem" on public.lojas
  for select to anon, authenticated using (true);
drop policy if exists "lojas: lojista cria a propria" on public.lojas;
create policy "lojas: lojista cria a propria" on public.lojas
  for insert to authenticated
  with check (
    dono_id = auth.uid()
    and exists (select 1 from public.perfis where id = auth.uid() and tipo = 'lojista')
  );
drop policy if exists "lojas: dona altera" on public.lojas;
create policy "lojas: dona altera" on public.lojas
  for update to authenticated using (dono_id = auth.uid()) with check (dono_id = auth.uid());
drop policy if exists "lojas: dona exclui" on public.lojas;
create policy "lojas: dona exclui" on public.lojas
  for delete to authenticated using (dono_id = auth.uid());

-- categorias (somente leitura pelo aplicativo)
drop policy if exists "categorias: todos leem" on public.categorias;
create policy "categorias: todos leem" on public.categorias
  for select to anon, authenticated using (true);

-- produtos
drop policy if exists "produtos: todos leem os ativos" on public.produtos;
create policy "produtos: todos leem os ativos" on public.produtos
  for select to anon, authenticated using (ativo = true);
drop policy if exists "produtos: dona le todos os da loja" on public.produtos;
create policy "produtos: dona le todos os da loja" on public.produtos
  for select to authenticated using (public.sou_dono_da_loja(loja_id));
drop policy if exists "produtos: dona cria" on public.produtos;
create policy "produtos: dona cria" on public.produtos
  for insert to authenticated with check (public.sou_dono_da_loja(loja_id));
drop policy if exists "produtos: dona altera" on public.produtos;
create policy "produtos: dona altera" on public.produtos
  for update to authenticated
  using (public.sou_dono_da_loja(loja_id)) with check (public.sou_dono_da_loja(loja_id));
drop policy if exists "produtos: dona exclui" on public.produtos;
create policy "produtos: dona exclui" on public.produtos
  for delete to authenticated using (public.sou_dono_da_loja(loja_id));

-- tamanhos
drop policy if exists "tamanhos: todos leem" on public.tamanhos;
create policy "tamanhos: todos leem" on public.tamanhos
  for select to anon, authenticated using (true);
drop policy if exists "tamanhos: dona cria" on public.tamanhos;
create policy "tamanhos: dona cria" on public.tamanhos
  for insert to authenticated with check (public.sou_dono_do_produto(produto_id));
drop policy if exists "tamanhos: dona altera" on public.tamanhos;
create policy "tamanhos: dona altera" on public.tamanhos
  for update to authenticated
  using (public.sou_dono_do_produto(produto_id)) with check (public.sou_dono_do_produto(produto_id));
drop policy if exists "tamanhos: dona exclui" on public.tamanhos;
create policy "tamanhos: dona exclui" on public.tamanhos
  for delete to authenticated using (public.sou_dono_do_produto(produto_id));

-- produto_fotos (o limite de 5 fotos é garantido pelo gatilho do 01_schema.sql)
drop policy if exists "fotos: todos leem" on public.produto_fotos;
create policy "fotos: todos leem" on public.produto_fotos
  for select to anon, authenticated using (true);
drop policy if exists "fotos: dona cria" on public.produto_fotos;
create policy "fotos: dona cria" on public.produto_fotos
  for insert to authenticated with check (public.sou_dono_do_produto(produto_id));
drop policy if exists "fotos: dona altera" on public.produto_fotos;
create policy "fotos: dona altera" on public.produto_fotos
  for update to authenticated
  using (public.sou_dono_do_produto(produto_id)) with check (public.sou_dono_do_produto(produto_id));
drop policy if exists "fotos: dona exclui" on public.produto_fotos;
create policy "fotos: dona exclui" on public.produto_fotos
  for delete to authenticated using (public.sou_dono_do_produto(produto_id));

-- pedidos
-- Não há política de INSERT: os pedidos e os itens são gravados só pela função criar_pedidos() (04_melhorias.sql).
-- A lojista altera o pedido da própria loja, mas o gatilho "pedidos_protegidos" só deixa mudar
-- status e recado. A cliente marca as novidades como vistas pela função marcar_pedidos_como_vistos().
drop policy if exists "pedidos: cliente e dona da loja leem" on public.pedidos;
create policy "pedidos: cliente e dona da loja leem" on public.pedidos
  for select to authenticated
  using (cliente_id = auth.uid() or public.sou_dono_da_loja(loja_id));
drop policy if exists "pedidos: dona da loja altera o status" on public.pedidos;
create policy "pedidos: dona da loja altera o status" on public.pedidos
  for update to authenticated
  using (public.sou_dono_da_loja(loja_id)) with check (public.sou_dono_da_loja(loja_id));

-- itens_pedido
drop policy if exists "itens: cliente e dona da loja leem" on public.itens_pedido;
create policy "itens: cliente e dona da loja leem" on public.itens_pedido
  for select to authenticated
  using (exists (
    select 1 from public.pedidos p
    where p.id = itens_pedido.pedido_id
      and (p.cliente_id = auth.uid() or public.sou_dono_da_loja(p.loja_id))
  ));

-- Storage: bucket público 'produtos'; fotos em pastas por loja ({loja_id}/{produto_id}/arquivo)
-- O servidor também recusa arquivos que não sejam JPG, PNG ou WebP, ou com mais de 2 MB (RN-12)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage: leitura publica" on storage.objects;
create policy "storage: leitura publica" on storage.objects
  for select using (bucket_id = 'produtos');
drop policy if exists "storage: lojista envia na pasta da propria loja" on storage.objects;
create policy "storage: lojista envia na pasta da propria loja" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'produtos'
    and public.sou_dono_da_loja(((storage.foldername(name))[1])::uuid)
  );
drop policy if exists "storage: lojista altera na pasta da propria loja" on storage.objects;
create policy "storage: lojista altera na pasta da propria loja" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'produtos'
    and public.sou_dono_da_loja(((storage.foldername(name))[1])::uuid)
  );
drop policy if exists "storage: lojista exclui na pasta da propria loja" on storage.objects;
create policy "storage: lojista exclui na pasta da propria loja" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'produtos'
    and public.sou_dono_da_loja(((storage.foldername(name))[1])::uuid)
  );