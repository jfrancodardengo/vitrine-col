// Cria os pedidos da cliente (RF-10, RN-03, RN-06). Devolve dados ou lança ErroApp.
import { exigirSupabase } from "../supabaseClient.js";
import { ErroApp } from "../modelos/ErroApp.js";
import { Sacola } from "../modelos/Sacola.js";
import { Pedido } from "../modelos/Pedido.js";
import { paraErroApp } from "./errosSupabase.js";
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

// Monta um pedido por loja a partir da sacola e devolve a lista de objetos Pedido (cada um com o seu id).
//
// PROVISÓRIO (Dia 12): por enquanto os pedidos só são montados na memória, para a tela mostrar os botões de WhatsApp.
// Quem GRAVA os pedidos no banco é a função criar_pedidos(), que entra no Dia 13, junto com o login (só uma cliente logada faz pedido).
export async function criarPedidos(sacola) {
  try {
    if (!(sacola instanceof Sacola) || sacola.estaVazia()) {
      throw new ErroApp("sacola_vazia", "A sacola está vazia.");
    }

    const supabase = exigirSupabase();
    await conferirProdutosDaSacola(supabase, sacola);

    // Um Pedido por loja, todos com o mesmo grupoId (RN-03)
    return Pedido.criarPorLoja(sacola);
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível enviar o pedido. Verifique sua conexão e tente novamente.");
  }
}