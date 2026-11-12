// Painel da lojista: Pedidos recebidos (RF-20, RF-22, RN-05, RN-13). Só a lojista abre esta tela (RF-14).
// A lojista muda o status do pedido e/ou deixa um recado; a cliente é avisada em Meus pedidos.
import { montarCabecalho } from "../ui/cabecalho.js";
import { mostrarCarregando, mostrarErro, mostrarSucesso, limparAvisos, mensagemDoErro } from "../ui/avisos.js";
import { exigirPerfil } from "../ui/protecao.js";
import { formatarPreco, formatarData, criarLinkDoWhatsapp } from "../ui/formatadores.js";
import { Pedido } from "../modelos/Pedido.js";
import { obterMinhaLoja } from "../servicos/lojaServico.js";
import { listarPedidosDaMinhaLoja, atualizarPedido } from "../servicos/pedidoServico.js";
import { criarElemento } from "../ui/elementos.js";

const anuncio = document.getElementById("anuncio-pedidos");
const avisoSemLoja = document.getElementById("aviso-sem-loja");
const mensagemSemPedidos = document.getElementById("mensagem-sem-pedidos");
const listaDePedidos = document.getElementById("lista-pedidos");

// Texto do botão de cada status de destino. Só aparecem os que Pedido.proximosStatus() permite (RN-05).
const TEXTO_DOS_BOTOES = {
  confirmado: "Confirmar reserva",
  concluido: "Marcar como concluído",
  cancelado: "Cancelar pedido",
};

const TEXTO_DE_SUCESSO = {
  confirmado: "reserva confirmada",
  concluido: "marcado como concluído",
  cancelado: "cancelado",
};

// Texto só para leitor de tela: diz de qual pedido é o botão
function criarTextoOculto(pedido) {
  return criarElemento("span", "visualmente-oculto", " (pedido #" + pedido.codigoCurto() + ")");
}

function criarBotao(texto, classe, pedido, aoClicar) {
  const botao = criarElemento("button", "botao botao-pequeno " + classe);
  botao.type = "button";
  botao.append(texto, criarTextoOculto(pedido));
  botao.addEventListener("click", () => aoClicar(botao));
  return botao;
}

// ---------- Cartão de um pedido ----------

function criarCartao(pedido) {
  const cartao = criarElemento("article", "compra");
  cartao.id = "cartao-" + pedido.id;
  const idDoTitulo = "titulo-" + pedido.id;
  cartao.setAttribute("aria-labelledby", idDoTitulo);

  const topo = criarElemento("div", "pedido-loja-topo");
  const titulo = criarElemento("h2", "", "Pedido #" + pedido.codigoCurto() + " – " + formatarData(pedido.criadoEm));
  titulo.id = idDoTitulo;
  topo.append(titulo, criarElemento("span", "selo selo-" + pedido.status, pedido.rotuloParaLojista()));

  const itens = criarElemento("ul", "pedido-itens");
  pedido.itens.forEach((item) => {
    itens.append(
      criarElemento("li", "", item.quantidade + "x " + item.nome + " (tamanho " + item.tamanho + ") – " + formatarPreco(item.precoUnitario) + " cada")
    );
  });

  cartao.append(
    topo,
    criarElemento("p", "", "Cliente: " + (pedido.clienteNome || "não informado")),
    itens,
    criarElemento("p", "", "Total do pedido: " + formatarPreco(pedido.total))
  );

  if (pedido.mensagemLoja.trim() !== "") {
    const recado = criarElemento("p", "recado-loja");
    recado.append(criarElemento("strong", "", "Recado atual para a cliente: "), pedido.mensagemLoja);
    cartao.append(recado);
  }

  cartao.append(criarFormularioDeAtualizacao(pedido));

  // RF-22 (desejável): se a cliente tem telefone, a lojista pode avisá-la pelo WhatsApp (RN-10)
  const linkDoWhatsapp = criarLinkDoWhatsapp(pedido.clienteTelefone, pedido.mensagemDeStatusParaCliente());
  if (linkDoWhatsapp) {
    const botao = criarElemento("a", "botao botao-whatsapp botao-pequeno", "Avisar a cliente pelo WhatsApp");
    botao.href = linkDoWhatsapp;
    botao.target = "_blank";
    botao.rel = "noopener";
    botao.append(criarElemento("span", "visualmente-oculto", " (abre em nova aba)"));
    cartao.append(botao);
  }

  return cartao;
}

// Recado + botões de status. Os botões de status salvam o status E o recado juntos, numa só atualização.
function criarFormularioDeAtualizacao(pedido) {
  const bloco = criarElemento("div", "pedido-atualizar");

  const campo = criarElemento("div", "campo");
  const rotulo = criarElemento("label", "", "Recado para a cliente (opcional)");
  rotulo.htmlFor = "recado-" + pedido.id;
  const recado = criarElemento("textarea");
  recado.id = "recado-" + pedido.id;
  recado.maxLength = 500;
  recado.value = pedido.mensagemLoja;
  campo.append(rotulo, recado);

  const acoes = criarElemento("div", "acoes-formulario");

  // Só as transições permitidas (RN-05), inclusive cancelar enquanto não estiver concluído
  pedido.proximosStatus().forEach((status) => {
    const classe = status === "cancelado" ? "botao-perigo" : "";
    acoes.append(criarBotao(TEXTO_DOS_BOTOES[status], classe, pedido, (botao) => salvar(pedido, { status }, recado, botao)));
  });
  acoes.append(criarBotao("Salvar só o recado", "botao-secundario", pedido, (botao) => salvar(pedido, {}, recado, botao)));

  bloco.append(campo, acoes);
  return bloco;
}

// ---------- Salvar ----------

async function salvar(pedido, mudanca, campoDoRecado, botao) {
  // Cancelar não tem volta: confirma antes
  if (mudanca.status === "cancelado" && !window.confirm("Cancelar este pedido? A cliente será avisada em Meus pedidos.")) {
    return;
  }

  const cartao = document.getElementById("cartao-" + pedido.id);
  const botoes = cartao.querySelectorAll("button");
  botoes.forEach((b) => (b.disabled = true));
  limparAvisos();
  mostrarCarregando("Salvando…");

  try {
    // Uma única atualização: status (se houver) e recado juntos
    const linha = await atualizarPedido(pedido.id, { ...mudanca, mensagemLoja: campoDoRecado.value });
    const atualizado = Pedido.deLinha(linha);

    // Troca só este cartão, sem mexer nos recados que a lojista esteja escrevendo nos outros
    const novoCartao = criarCartao(atualizado);
    cartao.replaceWith(novoCartao);

    const mensagem = mudanca.status
      ? "Pedido #" + atualizado.codigoCurto() + ": " + TEXTO_DE_SUCESSO[mudanca.status] + ". A cliente será avisada em Meus pedidos."
      : "Recado salvo. A cliente será avisada em Meus pedidos.";
    mostrarSucesso(mensagem);
    anuncio.textContent = mensagem;
    novoCartao.querySelector("textarea").focus();
  } catch (erro) {
    // Ex.: o banco recusou a mudança (gatilho da RN-13) ou o fluxo de status não permite
    limparAvisos();
    mostrarErro(mensagemDoErro(erro));
    botoes.forEach((b) => (b.disabled = false));
  }
}

// ---------- Abrir a tela ----------

function desenhar(pedidos) {
  listaDePedidos.replaceChildren(...pedidos.map(criarCartao));
  mensagemSemPedidos.hidden = pedidos.length > 0;
}

async function iniciar() {
  montarCabecalho();
  const usuaria = await exigirPerfil("lojista");
  if (!usuaria) {
    return;
  }

  mostrarCarregando();
  try {
    const loja = await obterMinhaLoja();
    if (!loja) {
      limparAvisos();
      avisoSemLoja.hidden = false;
      return;
    }

    const linhas = await listarPedidosDaMinhaLoja(loja.id);
    // Pedido sem itens ficou pela metade (falha ao gravar os itens): não há o que mostrar
    desenhar(linhas.filter((linha) => (linha.itens_pedido ?? []).length > 0).map(Pedido.deLinha));
    limparAvisos();
  } catch (erro) {
    mostrarErro(mensagemDoErro(erro));
  }
}

iniciar();