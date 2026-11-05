-- 03_seed.sql — Dados iniciais
-- Parte 1: categorias
insert into public.categorias (nome) values
  ('Blusas'), ('Camisetas'), ('Vestidos'), ('Calças'),
  ('Saias'), ('Shorts'), ('Jaquetas'), ('Acessórios')
on conflict (nome) do nothing;

-- Parte 2: loja e produtos de exemplo.
-- Antes, crie uma usuária lojista de teste em Authentication > Users, com os metadados
-- {"nome": "Lojista Teste", "tipo": "lojista"}, e troque o UUID abaixo pelo id dela.
-- As imagens são de exemplo: troque por fotos com autorização de uso (UC4).
do $$
declare
  v_dono uuid := '00000000-0000-0000-0000-000000000000'; -- TROQUE pelo id da lojista de teste
  v_loja uuid;
  v_produto uuid;
begin
  insert into public.lojas (dono_id, nome, descricao, endereco, cidade, whatsapp, link_mapa)
  values (
    v_dono, 'Loja Exemplo', 'Moda feminina casual e confortável',
    'Rua das Flores, 100, Centro', 'Cidade Exemplo', '5527999999999',
    'https://www.google.com/maps'
  )
  returning id into v_loja;

  insert into public.produtos (loja_id, categoria_id, nome, descricao, preco)
  values (
    v_loja, (select id from public.categorias where nome = 'Vestidos'),
    'Vestido midi floral', 'Tecido leve, ideal para o verão', 129.90
  )
  returning id into v_produto;
  insert into public.tamanhos (produto_id, tamanho, estoque)
  values (v_produto, 'P', 3), (v_produto, 'M', 5), (v_produto, 'G', 0);
  -- 3 fotos: a de ordem 1 é a capa
  insert into public.produto_fotos (produto_id, url, ordem)
  values
    (v_produto, 'https://picsum.photos/seed/vestido1/600/800', 1),
    (v_produto, 'https://picsum.photos/seed/vestido2/600/800', 2),
    (v_produto, 'https://picsum.photos/seed/vestido3/600/800', 3);

  insert into public.produtos (loja_id, categoria_id, nome, descricao, preco)
  values (
    v_loja, (select id from public.categorias where nome = 'Camisetas'),
    'Camiseta básica branca', 'Algodão, corte reto', 49.90
  )
  returning id into v_produto;
  insert into public.tamanhos (produto_id, tamanho, estoque)
  values (v_produto, 'P', 10), (v_produto, 'M', 10), (v_produto, 'G', 6);
  insert into public.produto_fotos (produto_id, url, ordem)
  values
    (v_produto, 'https://picsum.photos/seed/camiseta1/600/800', 1),
    (v_produto, 'https://picsum.photos/seed/camiseta2/600/800', 2);

  insert into public.produtos (loja_id, categoria_id, nome, descricao, preco)
  values (
    v_loja, (select id from public.categorias where nome = 'Calças'),
    'Calça jeans reta', 'Cintura alta, lavagem clara', 159.90
  )
  returning id into v_produto;
  insert into public.tamanhos (produto_id, tamanho, estoque)
  values (v_produto, '38', 2), (v_produto, '40', 4), (v_produto, '42', 1);
  insert into public.produto_fotos (produto_id, url, ordem)
  values (v_produto, 'https://picsum.photos/seed/calca1/600/800', 1);
end
$$;