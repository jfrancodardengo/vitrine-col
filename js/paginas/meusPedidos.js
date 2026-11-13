// Meus pedidos (RF-11, RF-22, RN-13): os pedidos da cliente, agrupados por compra, com o status, o recado da loja
// e o destaque "Atualizado" nos pedidos com novidade. Só a cliente abre esta tela (RF-14).
import { montarCabecalho, atualizarContadorDeNovidades } from "../ui/cabecalho.js";
import { mostrarCarregando, mostrarErro, limparAvisos, mensagemDoErro } from "../ui/avisos.js";
import { exigirPerfil } from "../ui/protecao.js";
import { formatarPreco, formatarData } from "../ui/formatadores.js";
import { Pedido } from "../modelos/Pedido.js";
import { listarMeusPedidos, marcarComoVistos } from "../servicos/pedidoServico.js";
import { criarElemento } from "../ui/elementos.js";

const listaDeCompras = document.getElementById("lista-compras");
const mensagemSemPedidos = document.getElementById("mensagem-sem-pedidos");

// Pedidos da mesma finalização da sacola têm o mesmo grupo_id (RN-03): viram uma "compra".
// A lista já vem do mais recente ao mais antigo, e as compras seguem essa ordem.
function agruparPorCompra(pedidos) {
  const compras = new Map();

  pedidos.forEach((pedido) => {
    if (!compras.has(pedido.grupoId)) {
      compras.set(pedido.grupoId, []);
    }
    compras.get(pedido.grupoId).push(pedido);
  });
  return [...compras.values()];
}

// O cartão de uma loja dentro da compra: loja, status, itens, total e o recado.
function criarCartaoDoPedido(pedido) {
  const cartao = criarElemento("article", "pedido-loja");
  const idDoTitulo = "pedido-" + pedido.id;
  cartao.setAttribute("aria-labelledby", idDoTitulo);

  const topo = criarElemento("div", "pedido-loja-topo");
  const titulo = criarElemento("h3", "", pedido.lojaNome);
  titulo.id = idDoTitulo;

  const selos = criarElemento("span");
  // RF-22: "Atualizado" é TEXTO (não só cor) e aparece enquanto a cliente não tinha visto a novidade
  if (!pedido.statusVisto) {
    cartao.classList.add("pedido-novidade");
    selos.append(criarElemento("span", "selo selo-atualizado", "Atualizado"), " ");
  }
  selos.append(criarElemento("span", "selo selo-" + pedido.status, pedido.rotuloParaCliente()));
  topo.append(titulo, selos);

  const codigo = criarElemento("p", "", "Pedido ");
  codigo.append(criarElemento("strong", "", "#" + pedido.codigoCurto()));

  const itens = criarElemento("ul", "pedido-itens");
  pedido.itens.forEach((item) => {
    itens.append(
      criarElemento("li", "", item.quantidade + "x " + item.nome + " (tamanho " + item.tamanho + ") – " + formatarPreco(item.precoUnitario) + " cada")
    );
  });

  cartao.append(topo, codigo, itens, criarElemento("p", "", "Total do pedido: " + formatarPreco(pedido.total)));

  // O recado da loja (RN-13), quando houver
  if (pedido.mensagemLoja.trim() !== "") {
    const recado = criarElemento("p", "recado-loja");
    recado.append(criarElemento("strong", "", "Recado da loja: "), pedido.mensagemLoja);
    cartao.append(recado);
  }

  return cartao;
}

function criarCompra(pedidos, indice) {
  const compra = criarElemento("section", "compra");
  const idDoTitulo = "compra-" + indice;
  compra.setAttribute("aria-labelledby", idDoTitulo);

  const titulo = criarElemento("h2", "", "Compra de " + formatarData(pedidos[0].criadoEm));
  titulo.id = idDoTitulo;

  // Soma em centavos, para não aparecer 0,30000000000000004
  const centavos = pedidos.reduce((soma, pedido) => soma + Math.round(pedido.total * 100), 0);
  const resumo = criarElemento(
    "p",
    "compra-cabecalho",
    "Total da compra: " + formatarPreco(centavos / 100) + " (" + pedidos.length + (pedidos.length === 1 ? " pedido" : " pedidos, um por loja") + ")"
  );

  compra.append(titulo, resumo, ...pedidos.map(criarCartaoDoPedido));
  return compra;
}

function desenhar(pedidos) {
  listaDeCompras.replaceChildren(...agruparPorCompra(pedidos).map(criarCompra));
  mensagemSemPedidos.hidden = pedidos.length > 0;
}

async function iniciar() {
  montarCabecalho();
  const usuaria = await exigirPerfil("cliente");
  if (!usuaria) {
    return;
  }

  mostrarCarregando();

  let linhas;
  try {
    linhas = await listarMeusPedidos();
  } catch (erro) {
    mostrarErro(mensagemDoErro(erro));
    return;
  }

  // Um pedido sem itens ficou pela metade (falha ao gravar os itens, veja pedidoServico.criarPedidos): não há o que mostrar
  const pedidos = linhas.filter((linha) => (linha.itens_pedido ?? []).length > 0).map(Pedido.deLinha);

  // O destaque "Atualizado" vem dos dados que acabaram de chegar (status_visto antes de limpar)
  desenhar(pedidos);
  limparAvisos();

  // RN-13: agora que a lista está na tela, as novidades passam a "vistas" no banco. A tela atual continua
  // mostrando o destaque (foi desenhada antes), e na próxima vez que ela abrir não haverá mais "Atualizado".
  if (linhas.some((linha) => linha.status_visto === false)) {
    try {
      await marcarComoVistos();
    } catch (erro) {
      console.warn(erro.codigo, erro.cause ?? "");
    }
  }
  atualizarContadorDeNovidades(); // o contador do cabeçalho some
}

iniciar();