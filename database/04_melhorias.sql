-- 04_melhorias.sql — Melhorias de segurança e de conta (revisão final)
-- Rodar no SQL Editor DEPOIS do 01_schema.sql e do 02_rls.sql. Pode ser rodado mais de uma vez.
--
-- O que este script faz:
--   1) criar_pedidos(): grava os pedidos e os itens numa única transação (ou grava tudo, ou nada),
--      calcula o total no servidor e confere preço e estoque. O INSERT direto em pedidos/itens_pedido é fechado.
--   2) Gatilho dos pedidos: o banco passa a impor o fluxo de status (RN-05) e a proteger status_visto
--      e atualizado_em (RN-13).
--   3) excluir_minha_conta(): a usuária apaga a própria conta e os dados dela, sem SQL manual.
--   4) Limites do bucket "produtos": só JPG, PNG e WebP, até 2 MB (RN-12), também no servidor.

-- =====================================================================
-- 1) Pedido e itens numa transação só (RF-10, RN-03, RN-06)
-- =====================================================================

-- A cliente não insere mais direto nas tabelas: só pela função criar_pedidos() abaixo.
-- (Bancos criados com o 02_rls.sql antigo ainda têm estas duas políticas; aqui elas são apagadas.)
drop policy if exists "pedidos: cliente cria o proprio" on public.pedidos;
drop policy if exists "itens: cliente cria itens do proprio pedido" on public.itens_pedido;

-- Recebe o grupo da compra e um pedido por loja, neste formato:
--   p_pedidos = [ { "id": uuid, "loja_id": uuid,
--                   "itens": [ { "produto_id": uuid, "tamanho": "M", "quantidade": 1, "preco_unitario": 89.90 } ] } ]
-- O total NÃO vem do navegador: é a soma de preço x quantidade calculada aqui.
-- O preço que a cliente viu (preco_unitario) precisa ser o preço atual; se mudou, nada é gravado (RN-06).
-- As mensagens estão em português porque o site as mostra para a cliente como vieram.
create or replace function public.criar_pedidos(p_grupo_id uuid, p_pedidos jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente uuid := auth.uid();
  v_pedido jsonb;
  v_item jsonb;
  v_produto record;
  v_pedido_id uuid;
  v_loja_id uuid;
  v_quantidade integer;
  v_total numeric(10,2);
begin
  if v_cliente is null then
    raise exception 'Entre na sua conta para finalizar o pedido.';
  end if;
  if not exists (select 1 from public.perfis where id = v_cliente and tipo = 'cliente') then
    raise exception 'Só contas de cliente fazem pedidos.';
  end if;
  if p_grupo_id is null
     or p_pedidos is null
     or jsonb_typeof(p_pedidos) <> 'array'
     or jsonb_array_length(p_pedidos) = 0 then
    raise exception 'A sacola está vazia.';
  end if;
  -- Limite de bom senso: impede um envio gigante feito à mão pelo console
  if jsonb_array_length(p_pedidos) > 20 then
    raise exception 'Muitas lojas em uma só compra. Finalize em partes.';
  end if;

  for v_pedido in select * from jsonb_array_elements(p_pedidos) loop
    v_pedido_id := (v_pedido ->> 'id')::uuid;
    v_loja_id := (v_pedido ->> 'loja_id')::uuid;

    if jsonb_typeof(v_pedido -> 'itens') <> 'array' or jsonb_array_length(v_pedido -> 'itens') = 0 then
      raise exception 'Cada pedido precisa ter pelo menos um item.';
    end if;
    if jsonb_array_length(v_pedido -> 'itens') > 100 then
      raise exception 'Itens demais em um só pedido.';
    end if;

    -- 1ª passada: confere cada item e soma o total. Nada é gravado ainda.
    v_total := 0;
    for v_item in select * from jsonb_array_elements(v_pedido -> 'itens') loop
      v_quantidade := (v_item ->> 'quantidade')::integer;
      if v_quantidade is null or v_quantidade < 1 or v_quantidade > 99 then
        raise exception 'A quantidade de cada peça deve ser de 1 a 99.';
      end if;

      -- O produto precisa estar ativo (RN-08) e ser da loja do pedido
      select pr.id, pr.nome, pr.preco into v_produto
      from public.produtos pr
      where pr.id = (v_item ->> 'produto_id')::uuid and pr.ativo and pr.loja_id = v_loja_id;
      if not found then
        raise exception 'Um dos produtos da sacola não está mais disponível. Atualize a sacola.';
      end if;

      -- RN-07: o estoque não é baixado, mas o tamanho precisa existir e ter estoque
      if not exists (
        select 1 from public.tamanhos t
        where t.produto_id = v_produto.id and t.tamanho = (v_item ->> 'tamanho') and t.estoque > 0
      ) then
        raise exception 'O tamanho % de "%" está sem estoque. Remova a peça da sacola.', (v_item ->> 'tamanho'), v_produto.nome;
      end if;

      -- RN-06: a cliente só paga o preço que viu
      if (v_item ->> 'preco_unitario')::numeric is distinct from v_produto.preco then
        raise exception 'O preço de "%" mudou. Atualize a sacola e confira o novo total.', v_produto.nome;
      end if;

      v_total := v_total + v_produto.preco * v_quantidade;
    end loop;

    -- 2ª passada: grava o pedido (status sempre "novo", RN-04) e os itens com o preço do banco
    insert into public.pedidos (id, cliente_id, loja_id, status, total, grupo_id)
    values (v_pedido_id, v_cliente, v_loja_id, 'novo', v_total, p_grupo_id);

    insert into public.itens_pedido (pedido_id, produto_id, tamanho, quantidade, preco_unitario)
    select v_pedido_id, pr.id, i.tamanho, i.quantidade, pr.preco
    from jsonb_to_recordset(v_pedido -> 'itens') as i(produto_id uuid, tamanho text, quantidade integer)
    join public.produtos pr on pr.id = i.produto_id;
  end loop;
end;
$$;

revoke execute on function public.criar_pedidos(uuid, jsonb) from public, anon;
grant execute on function public.criar_pedidos(uuid, jsonb) to authenticated;

-- =====================================================================
-- 2) Gatilho dos pedidos: fluxo de status (RN-05) e campos de aviso (RN-13)
-- =====================================================================

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

  -- status_visto e atualizado_em são controlados pelo banco. Um update vindo do navegador (papel
  -- authenticated ou anon) não pode mexer neles; a cliente usa marcar_pedidos_como_vistos(), que roda
  -- com o papel da dona da função e por isso passa por aqui.
  if current_user in ('authenticated', 'anon')
     and (new.status_visto is distinct from old.status_visto
          or new.atualizado_em is distinct from old.atualizado_em) then
    raise exception 'Só o status e o recado do pedido podem ser alterados.';
  end if;

  -- RN-05: novo -> confirmado ou cancelado; confirmado -> concluido ou cancelado; o resto é final
  if new.status <> old.status and not (
       (old.status = 'novo' and new.status in ('confirmado', 'cancelado'))
    or (old.status = 'confirmado' and new.status in ('concluido', 'cancelado'))
  ) then
    raise exception 'Esta mudança de status não é permitida para este pedido.';
  end if;

  if new.status <> old.status or new.mensagem_loja is distinct from old.mensagem_loja then
    new.status_visto := false;
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;

-- =====================================================================
-- 3) Excluir a própria conta (direito da titular, LGPD)
-- =====================================================================

-- Apaga os pedidos da conta (como cliente e, se for lojista, os recebidos pela loja dela) e depois a
-- usuária. O resto (perfil, loja, produtos, tamanhos, fotos) some em cascata pelas chaves estrangeiras.
-- Os arquivos de foto do Storage são removidos pelo site antes desta chamada (storageServico).
create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuaria uuid := auth.uid();
begin
  if v_usuaria is null then
    raise exception 'Entre na sua conta para excluí-la.';
  end if;

  delete from public.pedidos
  where cliente_id = v_usuaria
     or loja_id in (select id from public.lojas where dono_id = v_usuaria);

  delete from auth.users where id = v_usuaria;
end;
$$;

revoke execute on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;

-- =====================================================================
-- 4) Limites do bucket de fotos (RN-12) também no servidor
-- =====================================================================

update storage.buckets
set file_size_limit = 2097152, -- 2 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'produtos';