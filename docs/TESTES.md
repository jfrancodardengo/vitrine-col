# Casos de teste (CT-01 a CT-25)

Lista de verificação do sistema. A versão 1.0 é aceita quando todos os requisitos **Essenciais** passam nestes casos e
cada requisito **Importante** está pronto ou registrado como fora do escopo.

**Como usar:** execute cada caso no site **publicado ou rodando com o Supabase de verdade** (não vale testar só com o
`js/config.js` de exemplo). Preencha as colunas **Resultado** e **Observações**.

| | |
| --- | --- |
| Versão testada |1.0 |
| Endereço do site |localhost:5500 |
| Data |12/11/26 |
| Navegador e aparelho |Google Chrome; Notebook |
| Quem testou |José Augusto |

**Legenda do Resultado:** `OK` = passou · `FALHOU` = não passou (descreva em Observações) · `N/A` = não executado.

## Antes de começar (dados de teste)

1. O banco está pronto e os scripts de segurança (RLS e melhorias) já foram executados no Supabase.
2. Existem **duas lojas**, de **duas lojistas diferentes**, cada uma com WhatsApp e pelo menos 2 produtos ativos com fotos.
   Um dos produtos tem um tamanho com **estoque 0**.
3. Existe uma conta de **cliente** (de preferência com telefone) e uma de **lojista**.
4. Para os casos do console (CT-11, CT-18, CT-20 e CT-21), use os **roteiros do console** no fim deste arquivo.
5. Para o CT-22, o banco precisa ter 13 ou mais produtos ativos. Para o CT-23, o Supabase precisa ter o endereço de
   `recuperar-senha.html` liberado no painel do Supabase, em **Authentication** (em português: **Autenticação**), na parte **URL Configuration** (em português: **Configuração de URL**). Para o CT-24, use uma conta criada só para o teste.
6. Os casos CT-17, CT-18, CT-20 e CT-24 dependem de telas que só existem depois do Dia 26 (pedidos recebidos, Meus pedidos e
   Minha conta): antes disso, marque **N/A**.

## Lista de verificação

| ID | Caso de teste | Requisitos | Como executar | Resultado esperado | Resultado | Observações |
| --- | --- | --- | --- | --- | --- | --- |
| CT-01 | Abrir o catálogo sem login | RF-01 (listar produtos) | Sem entrar na conta, abra `catalogo.html`. | Aparecem os produtos ativos (e nenhum inativo). |OK | |
| CT-02 | Filtrar por categoria e por loja | RF-02, RF-03 | Clique em uma categoria (por exemplo **Vestidos**) e depois escolha uma loja no filtro. Clique em **Todas** para limpar. | A lista mostra só o que corresponde ao filtro; **Todas** limpa. | OK| |
| CT-03 | Filtrar por tamanho sem estoque | RF-04 | Escolha no filtro de tamanho aquele que tem estoque 0 em algum produto. | O produto sem estoque nesse tamanho não aparece. |OK | |
| CT-04 | Adicionar produtos de duas lojas à sacola | RF-09, RN-03 | Abra um produto da loja A, escolha o tamanho e clique em **Adicionar à sacola**. Repita com um produto da loja B. Abra **Sacola**. | A sacola aceita as duas lojas (sem fazer pergunta) e mostra os itens agrupados por loja, com subtotal de cada uma e total. |OK | |
| CT-05 | Recarregar a página com itens na sacola | RF-09 | Com a sacola do CT-04, recarregue a página (F5). | Os itens, os subtotais e o total continuam iguais. |OK | |
| CT-06 | Finalizar pedido sem estar logada | RF-10, RN-04 | Sem entrar na conta, clique em **Finalizar sacola**. Entre com a conta de cliente. | Vai para o login e, depois de entrar, volta à sacola com os mesmos itens. |OK | |
| CT-07 | Finalizar a sacola logada, com peças de duas lojas | RF-10, RN-03, RN-06 | Logada como cliente, clique em **Finalizar sacola**. Confira os botões de WhatsApp. No SQL Editor: `select loja_id, status, total, grupo_id from public.pedidos order by criado_em desc limit 2;` | Dois pedidos gravados com status `novo` e o **mesmo** `grupo_id`; aparece um botão de WhatsApp por loja, cada um com o resumo só da respectiva loja. |OK | |
| CT-08 | Cadastrar com e-mail repetido | RF-12 | Em **Cadastrar**, use um e-mail que já tem conta. | Mensagem de erro clara ao lado do campo e-mail. |OK | |
| CT-09 | Cliente tenta abrir uma tela do painel | RF-14 | Logada como cliente, digite no navegador o endereço de `painel-loja.html`. | Acesso bloqueado: a cliente volta para a página inicial. |OK | |
| CT-10 | Lojista cadastra produto com 3 fotos | RF-16, RF-19 | Em **Painel** > **Meus produtos** > **Cadastrar produto**, preencha os dados e escolha 3 fotos. Salve. Abra o catálogo e a página do produto. | O card mostra a **primeira** foto como capa, e a página do produto mostra as 3 fotos na galeria. |OK | |
| CT-11 | Lojista tenta editar produto de outra loja pelo console do navegador | RN-09 (só a dona altera), segurança de acesso | Siga o **roteiro do CT-11** no fim deste arquivo. | O banco recusa a alteração: `data: []` e nada muda no painel da outra lojista. |OK | |
| CT-12 | Digitar um script em um campo de texto | segurança de conteúdo (nunca `innerHTML` com dados) | Cadastre um produto com o nome `<img src=x onerror=alert(1)>` (ou deixe esse texto no recado de um pedido). Veja o catálogo, a sacola e os pedidos. | O texto aparece como texto, sem ser executado (nenhuma janela de alerta). |OK | |
| CT-13 | Abrir as telas em 360 px e em 1280 px | responsividade | No navegador, F12 > modo de dispositivo. Abra cada tela nas duas larguras. | Sem rolagem horizontal. | OK| |
| CT-14 | Percorrer o fluxo de pedido só com o teclado | acessibilidade | Sem usar o mouse (Tab, Shift+Tab, Enter, espaço): escolha um produto, o tamanho, adicione à sacola e finalize. | Todos os passos são alcançáveis, com o foco sempre visível. |OK | |
| CT-15 | Simular falha de conexão com o Supabase | RF-21 | F12 > **Network** > marque **Offline**. Recarregue o catálogo e tente trocar um filtro. Repita no login. | Mensagem de erro em português e nenhuma tela em branco. |OK | |
| CT-16 | Enviar a 6ª foto de um produto ou um arquivo maior que 2 MB | RF-19, RN-12 | No formulário do produto, tente escolher uma 6ª foto. Depois tente um arquivo com mais de 2 MB (ou um `.gif`). | O sistema recusa com mensagem clara e mantém as 5 fotos já escolhidas. |OK | |
| CT-17 | A lojista confirma um pedido e a cliente abre o sistema | RF-11, RF-20, RF-22, RN-13 | Como lojista, em **Pedidos recebidos**, escreva um recado e clique em **Confirmar reserva**. Como cliente, veja o cabeçalho e abra **Meus pedidos**. Veja o cabeçalho de novo. | O link **Meus pedidos** mostra o contador; na tela o pedido aparece como **Atualizado**, com o status **Reserva confirmada** e o recado; depois de aberta, o contador some. |N/A | |
| CT-18 | A lojista tenta alterar o valor total de um pedido pelo console do navegador | RN-13, segurança de acesso | Siga o **roteiro do CT-18** no fim deste arquivo. | O banco recusa a alteração com a mensagem "Só o status e o recado do pedido podem ser alterados.". |N/A | |
| CT-19 | Abrir a página inicial e percorrer o carrossel | RF-23 | Sem entrar na conta, abra `index.html`. Use as setas do carrossel, os pontos, as teclas ← e → (com o foco no carrossel) e o botão de pausa. Clique em um tipo de roupa. | Aparecem o hero, o carrossel (um slide por vez), os tipos de roupa, os destaques e as lojas. A navegação funciona e a pausa para a troca automática. O tipo de roupa abre o catálogo já filtrado. | OK| |
| CT-20 | A lojista tenta pular uma etapa do status ou mexer no aviso da cliente pelo console | RN-05, RN-13, segurança de acesso | Siga o **roteiro do CT-20** no fim deste arquivo. | O banco recusa com "Esta mudança de status não é permitida para este pedido." e com "Só o status e o recado do pedido podem ser alterados.". |N/A | |
| CT-21 | A cliente tenta gravar um pedido com preço forjado ou direto na tabela pelo console | RN-06, segurança de acesso | Siga o **roteiro do CT-21** no fim deste arquivo. | O insert direto é recusado por row-level security, a função diz que o preço mudou, e nada é gravado. |OK | |
| CT-22 | Abrir o catálogo com mais de 12 produtos e clicar em Carregar mais produtos | RF-01 | Abra `catalogo.html`. Confira que aparecem 12 produtos e o botão. Clique no botão. Depois troque o filtro de tipo de roupa. | Entram os produtos seguintes, sem repetir nenhum, e o botão some quando acabam. Trocar o filtro volta à primeira página. |N/A | |
| CT-23 | Recuperar a senha pelo link do e-mail | RF-24 | Em **Entrar**, clique em **Esqueci minha senha**, informe o e-mail de uma conta, abra o e-mail recebido, clique no link e escolha a senha nova. Depois saia e entre com a senha nova. | A tela mostra a mensagem de e-mail enviado, o link abre a tela da senha nova, a senha nova entra e a antiga deixa de valer. |OK | |
| CT-24 | Excluir a própria conta | RF-25, RN-14 | Com uma conta de teste (de preferência uma lojista com loja, produto e foto), clique no seu nome no cabeçalho, digite `EXCLUIR` e confirme. Tente entrar de novo. | A conta e os dados dela somem (no Supabase, a loja, os produtos e as fotos da lojista também) e não dá mais para entrar. |N/A | |
| CT-25 | Enviar uma foto grande | RF-19 | No formulário do produto, escolha uma foto de câmera de mais de 1 MB (e menos de 2 MB) e salve. No Supabase, em **Storage** > **produtos**, veja o tamanho do arquivo. | O arquivo guardado é JPG e tem cerca de 200 KB. |OK | |

## Roteiros do console

Para os roteiros, abra qualquer página do site, depois o Console (F12 > **Console**). Troque os textos em MAIÚSCULAS pelos ids
reais (você os acha no **SQL Editor** com `select id, nome from public.produtos;`, `select id from public.pedidos;` etc.).

**Roteiro do CT-11** (entre como a **segunda lojista** e troque `ID-DO-PRODUTO-DA-PRIMEIRA` pelo id de um produto da primeira):

```js
const { supabase } = await import(new URL("js/supabaseClient.js", location.href));
const id = "ID-DO-PRODUTO-DA-PRIMEIRA";
console.log("alterar produto  ->", await supabase.from("produtos").update({ nome: "HACK" }).eq("id", id).select("id"));
console.log("apagar produto   ->", await supabase.from("produtos").delete().eq("id", id).select("id"));
console.log("alterar tamanhos ->", await supabase.from("tamanhos").update({ estoque: 999 }).eq("produto_id", id).select("tamanho"));
console.log("apagar fotos     ->", await supabase.from("produto_fotos").delete().eq("produto_id", id).select("id"));
```

Esperado: cada linha mostra `data: []`. Para o Storage (troque `ID-DA-LOJA` pelo id da loja da primeira lojista):

```js
const arquivo = new File([new Uint8Array(10)], "hack.png", { type: "image/png" });
console.log(await supabase.storage.from("produtos").upload("ID-DA-LOJA/teste/hack.png", arquivo));
```

Esperado: `error` com a mensagem `new row violates row-level security policy`.

**Roteiro do CT-18** (entre como **lojista**, troque `ID-DO-PEDIDO` por um pedido da sua loja):

```js
const { supabase } = await import(new URL("js/supabaseClient.js", location.href));
console.log(await supabase.from("pedidos").update({ total: 1 }).eq("id", "ID-DO-PEDIDO").select("id"));
```

Esperado: `error` com a mensagem "Só o status e o recado do pedido podem ser alterados.". Repita com a conta da **outra** lojista: `data: []`.

**Roteiro do CT-20** (entre como **lojista**, troque `ID-DO-PEDIDO` por um pedido **novo** da sua loja):

```js
const { supabase } = await import(new URL("js/supabaseClient.js", location.href));
const id = "ID-DO-PEDIDO";
console.log("pular etapa  ->", (await supabase.from("pedidos").update({ status: "concluido" }).eq("id", id)).error?.message);
console.log("mexer no aviso ->", (await supabase.from("pedidos").update({ status_visto: true }).eq("id", id)).error?.message);
```

Esperado: "Esta mudança de status não é permitida para este pedido." para o primeiro. O segundo só é recusado depois que o pedido
tem uma novidade (por exemplo, depois de confirmar): então a mensagem é "Só o status e o recado do pedido podem ser alterados.".

**Roteiro do CT-21** (entre como **cliente**; troque `ID-DE-UM-PRODUTO` e `ID-DA-LOJA` pelo id de um produto ativo e da loja dele):

```js
const { supabase } = await import(new URL("js/supabaseClient.js", location.href));
const direto = await supabase.from("pedidos").insert({ cliente_id: crypto.randomUUID(), loja_id: "ID-DA-LOJA", total: 0.01 });
console.log("insert direto ->", direto.error?.message);
const forjado = await supabase.rpc("criar_pedidos", {
  p_grupo_id: crypto.randomUUID(),
  p_pedidos: [{ id: crypto.randomUUID(), loja_id: "ID-DA-LOJA",
    itens: [{ produto_id: "ID-DE-UM-PRODUTO", tamanho: "P", quantidade: 1, preco_unitario: 0.01 }] }],
});
console.log("preço forjado ->", forjado.error?.message);
```

Esperado: o primeiro recusa por row-level security; o segundo diz que o preço mudou. Nada é gravado.

## Resumo

| Total de casos | OK | FALHOU | N/A |
| --- | --- | --- | --- |
| 25 |20 | |5 |

**Observações gerais:**