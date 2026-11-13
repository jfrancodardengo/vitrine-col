// Grava os pedidos da cliente (RF-10, RN-03, RN-04, RN-06). Devolve dados ou lança ErroApp.
import { exigirSupabase } from "../supabaseClient.js";
import { ErroApp } from "../modelos/ErroApp.js";
import { Cliente } from "../modelos/Cliente.js";
import { Sacola } from "../modelos/Sacola.js";
import { Pedido } from "../modelos/Pedido.js";
import { paraErroApp } from "./errosSupabase.js";
import { usuariaAtual } from "./authServico.js";
import { formatarPreco } from "../ui/formatadores.js";

// Antes de gravar, confere no banco se cada produto continua à venda e se o preço é o mesmo da sacola.
// O preço da sacola foi guardado quando a peça entrou nela; a lojista pode ter mudado o preço desde então.
// Se mudou, NÃO gravamos o pedido: atualizamos a sacola e pedimos para a cliente conferir o total.
// Assim ela nunca paga um valor que não viu (RN-06: o preço entra no pedido no momento da compra).
async function conferirProdutosDaSacola(supabase, sacola) {
  const itens = sacola.itens;
  const ids = [...new Set(itens.map((item) => item.produtoId))];

  const { data, error } = await supabase.from("produtos").select("id, nome, preco, ativo").in("id", ids);
  if (error) {
    throw error;
  }

  // As regras RLS só mostram produtos ativos para quem não é a dona; produto que não veio está inativo ou foi excluído (RN-08)
  const produtosPorId = new Map(data.map((produto) => [produto.id, produto]));

  const indisponiveis = itens.filter((item) => !produtosPorId.get(item.produtoId)?.ativo);
  if (indisponiveis.length > 0) {
    const nomes = [...new Set(indisponiveis.map((item) => item.nome))].join(", ");
    throw new ErroApp(
      "produto_indisponivel",
      "Estes produtos não estão mais disponíveis: " + nomes + ". Remova-os da sacola para continuar."
    );
  }

  const precosAtuais = new Map(data.map((produto) => [produto.id, Number(produto.preco)]));
  const alterados = sacola.atualizarPrecos(precosAtuais);
  if (alterados.length > 0) {
    sacola.salvar(); // a sacola guardada já fica com os preços novos
    const detalhes = alterados.map((a) => a.nome + " (de " + formatarPreco(a.de) + " para " + formatarPreco(a.para) + ")").join("; ");
    throw new ErroApp(
      "preco_mudou",
      "O preço mudou: " + detalhes + ". Atualizamos a sacola; confira o novo total e finalize de novo."
    );
  }
}

// Cria um pedido por loja a partir da sacola e devolve a lista de objetos Pedido criados (cada um com o seu id).
//
// Só uma cliente logada faz pedido (RN-04). O status inicial é "novo", e todos os pedidos da mesma finalização
// têm o mesmo grupo_id (RN-03). Os ids dos pedidos nascem no navegador (crypto.randomUUID(), dentro de
// Pedido.criarPorLoja) e tudo é gravado por UMA chamada à função criar_pedidos() do banco (database/04_melhorias.sql),
// que roda numa transação: ou grava todos os pedidos e itens, ou não grava nada.
// O banco também recalcula o total, confere o preço e o estoque e não aceita pedido gravado direto nas tabelas.
export async function criarPedidos(sacola) {
  try {
    const usuaria = await usuariaAtual();
    if (!usuaria) {
      throw new ErroApp("exige_login", "Entre na sua conta para finalizar o pedido.");
    }
    if (!(usuaria instanceof Cliente)) {
      throw new ErroApp("exige_cliente", "Só contas de cliente fazem pedidos. Entre com uma conta de cliente.");
    }
    if (!(sacola instanceof Sacola) || sacola.estaVazia()) {
      throw new ErroApp("sacola_vazia", "A sacola está vazia.");
    }

    const supabase = exigirSupabase();
    await conferirProdutosDaSacola(supabase, sacola);

    // Um Pedido por loja, todos com o mesmo grupoId
    const pedidos = Pedido.criarPorLoja(sacola);

    // O total não vai no envio: quem soma é o banco
    const dadosDosPedidos = pedidos.map((pedido) => ({
      id: pedido.id,
      loja_id: pedido.lojaId,
      itens: pedido.itens.map((item) => ({
        produto_id: item.produtoId,
        tamanho: item.tamanho,
        quantidade: item.quantidade,
        preco_unitario: item.precoUnitario,
      })),
    }));

    const { error } = await supabase.rpc("criar_pedidos", {
      p_grupo_id: pedidos[0].grupoId,
      p_pedidos: dadosDosPedidos,
    });
    if (error) {
      throw error;
    }

    return pedidos;
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível enviar o pedido. Verifique sua conexão e tente novamente.");
  }
}

// =====================================================================
// Acompanhamento do pedidos: Meus pedidos, pedidos recebidos e aviso de novidades
// (RF-11, RF-20, RF-22, RN-13). Quem pode ler ou alterar o quê é decidido pelas regras RLS do banco.
// =====================================================================

// Colunas do pedido, com a loja e os itens (cada item com o nome do produto).
const CAMPOS_DO_PEDIDO =
  "id, grupo_id, loja_id, cliente_id, status, total, mensagem_loja, status_visto, atualizado_em, criado_em, " +
  "lojas ( id, nome ), " +
  "itens_pedido ( id, produto_id, tamanho, quantidade, preco_unitario, produtos ( nome ) )";

// Para a lojista, o pedido vem também com o nome e o telefone da cliente (as regras RLS liberam só as clientes dos pedidos dela)
const CAMPOS_DO_PEDIDO_COM_CLIENTE = CAMPOS_DO_PEDIDO + ", perfis ( nome, telefone )";

const TAMANHO_MAXIMO_DO_RECADO = 500;

// RF-11: os pedidos da cliente logada, do mais recente ao mais antigo (a página agrupa por compra, usando o grupo_id).
// Devolve as linhas do banco; a página transforma cada uma em Pedido com Pedido.deLinha().
export async function listarMeusPedidos() {
  try {
    const usuaria = await usuariaAtual();
    if (!(usuaria instanceof Cliente)) {
      throw new ErroApp("exige_cliente", "Entre com uma conta de cliente para ver os seus pedidos.");
    }

    const supabase = exigirSupabase();
    const { data, error } = await supabase
      .from("pedidos")
      .select(CAMPOS_DO_PEDIDO)
      .eq("cliente_id", usuaria.id)
      .order("criado_em", { ascending: false });

    if (error) {
      throw error;
    }
    return data;
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível carregar os seus pedidos. Verifique sua conexão e tente novamente.");
  }
}

// RF-20: os pedidos recebidos pela loja da lojista, do mais recente ao mais antigo, com o nome e o telefone da cliente.
export async function listarPedidosDaMinhaLoja(lojaId) {
  try {
    const supabase = exigirSupabase();
    const { data, error } = await supabase
      .from("pedidos")
      .select(CAMPOS_DO_PEDIDO_COM_CLIENTE)
      .eq("loja_id", lojaId)
      .order("criado_em", { ascending: false });

    if (error) {
      throw error;
    }
    return data;
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível carregar os pedidos recebidos. Verifique sua conexão e tente novamente.");
  }
}

// RF-20, RN-05, RN-13: a lojista muda o status e/ou deixa um recado, numa ÚNICA atualização.
// Os dois campos são opcionais: só o recado ({ mensagemLoja }) ou só o status ({ status }) também valem.
// Um recado vazio apaga o recado. Devolve o pedido já atualizado (mesmo formato de listarPedidosDaMinhaLoja).
//
// O banco só deixa mudar status e recado (um gatilho recusa o resto) e marca o pedido como novidade para a cliente.
// Mas o banco NÃO confere o fluxo da RN-05; quem impede, por exemplo, "cancelado" voltar para "confirmado" é este código.
export async function atualizarPedido(id, { status, mensagemLoja } = {}) {
  try {
    const mudancas = {};

    if (mensagemLoja !== undefined) {
      const recado = String(mensagemLoja ?? "").trim();
      if (recado.length > TAMANHO_MAXIMO_DO_RECADO) {
        throw new ErroApp("recado_longo", "O recado deve ter no máximo " + TAMANHO_MAXIMO_DO_RECADO + " caracteres.");
      }
      mudancas.mensagem_loja = recado === "" ? null : recado;
    }

    const supabase = exigirSupabase();

    // Como o pedido está agora: serve para conferir a transição de status
    const { data: atual, error: erroAoLer } = await supabase.from("pedidos").select("id, status").eq("id", id).maybeSingle();
    if (erroAoLer) {
      throw erroAoLer;
    }
    if (!atual) {
      throw new ErroApp("pedido_nao_encontrado", "Pedido não encontrado.");
    }

    if (status !== undefined && status !== atual.status) {
      if (!Pedido.statusPermitidos(atual.status).includes(status)) {
        throw new ErroApp("status_nao_permitido", "Esta mudança de status não é permitida para este pedido.");
      }
      mudancas.status = status;
    }

    if (Object.keys(mudancas).length === 0) {
      throw new ErroApp("nada_a_salvar", "Não há nenhuma mudança para salvar.");
    }

    // O filtro por status evita atropelar uma mudança feita em outra aba ou aparelho
    const { data: alterados, error: erroAoAtualizar } = await supabase
      .from("pedidos")
      .update(mudancas)
      .eq("id", id)
      .eq("status", atual.status)
      .select(CAMPOS_DO_PEDIDO_COM_CLIENTE);

    if (erroAoAtualizar) {
      throw erroAoAtualizar;
    }
    if (alterados.length === 0) {
      throw new ErroApp("pedido_nao_atualizado", "O pedido mudou em outro lugar ou não é da sua loja. Recarregue a página.");
    }
    return alterados[0];
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível atualizar o pedido. Verifique sua conexão e tente novamente.");
  }
}

// RF-22: quantos pedidos da cliente têm novidade (status_visto = false). Para quem não é cliente, zero.
export async function contarNovidades() {
  try {
    const usuaria = await usuariaAtual();
    if (!(usuaria instanceof Cliente)) {
      return 0;
    }

    const supabase = exigirSupabase();
    // head: true devolve só a contagem, sem trazer os pedidos
    const { count, error } = await supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", usuaria.id)
      .eq("status_visto", false);

    if (error) {
      throw error;
    }
    return count ?? 0;
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível verificar as novidades dos pedidos.");
  }
}

// RN-13: a cliente abriu Meus pedidos, então as novidades passam a "vistas".
// É uma função do banco (e não um update direto) para a cliente não poder alterar nenhuma outra coluna.
export async function marcarComoVistos() {
  try {
    const supabase = exigirSupabase();
    const { error } = await supabase.rpc("marcar_pedidos_como_vistos");

    if (error) {
      throw error;
    }
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível marcar os pedidos como vistos.");
  }
}