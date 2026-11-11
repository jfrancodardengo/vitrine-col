// Página da sacola: itens por loja, quantidades, total e "Finalizar" (RF-09, RF-10, RN-03, RN-04, RN-10).
// A sacola fica no navegador (localStorage); só ao finalizar ela vira pedidos no banco.
import { montarCabecalho, atualizarContadorSacola } from "../ui/cabecalho.js";
import { mostrarCarregando, mostrarErro, mostrarInfo, limparAvisos, mensagemDoErro } from "../ui/avisos.js";
import { irParaOLogin } from "../ui/protecao.js";
import { formatarPreco, criarLinkDoWhatsapp } from "../ui/formatadores.js";
import { ErroApp } from "../modelos/ErroApp.js";
import { Cliente } from "../modelos/Cliente.js";
import { Sacola } from "../modelos/Sacola.js";
import { usuariaAtual } from "../servicos/authServico.js";
import { criarPedidos } from "../servicos/pedidoServico.js";
import { listarContatosDasLojas } from "../servicos/lojaServico.js";
import { criarElemento } from "../ui/elementos.js";

const titulo = document.getElementById("titulo-sacola");
const anuncio = document.getElementById("anuncio-sacola");
const blocoDaSacola = document.getElementById("sacola-conteudo");
const explicacao = document.getElementById("explicacao-sacola");
const blocoDosGrupos = document.getElementById("grupos-sacola");
const mensagemVazia = document.getElementById("sacola-vazia");
const rodape = document.getElementById("rodape-sacola");
const textoDoTotal = document.getElementById("total-sacola");
const botaoFinalizar = document.getElementById("botao-finalizar");
const blocoDaConfirmacao = document.getElementById("confirmacao");
const blocoDosCartoes = document.getElementById("cartoes-pedidos");

let sacola = Sacola.carregar();
let enviando = false;
let contadorDeCampos = 0; // só para dar um id único a cada campo de quantidade

function anunciar(texto) {
  anuncio.textContent = texto;
}

// Texto só para leitor de tela: diz de qual peça é o botão ("Remover (Vestido midi, tamanho M)")
function criarTextoOculto(item) {
  return criarElemento("span", "visualmente-oculto", " (" + item.nome + ", tamanho " + item.tamanho + ")");
}

// ---------- Sacola na tela ----------

function textoDoBotaoFinalizar(totalDePedidos) {
  return "Finalizar sacola (" + totalDePedidos + (totalDePedidos === 1 ? " pedido" : " pedidos") + ")";
}

// Atualiza só os números (subtotais e total), sem redesenhar a lista: assim o foco do teclado não se perde
function atualizarTotais() {
  const grupos = sacola.itensPorLoja();

  grupos.forEach((grupo) => {
    const subtotal = document.getElementById("subtotal-" + grupo.lojaId);
    if (subtotal) {
      subtotal.textContent = "Subtotal da loja: " + formatarPreco(grupo.subtotal);
    }
  });

  textoDoTotal.textContent = "Total: " + formatarPreco(sacola.total());
  if (!enviando) {
    botaoFinalizar.textContent = textoDoBotaoFinalizar(grupos.length);
  }
}

function alterarQuantidade(item, entrada) {
  limparAvisos();
  try {
    sacola.alterarQuantidade(item.produtoId, item.tamanho, entrada.value);
    sacola.salvar();
    atualizarContadorSacola();
    atualizarTotais();
    anunciar("Quantidade atualizada. Total: " + formatarPreco(sacola.total()) + ".");
  } catch (erro) {
    mostrarErro(mensagemDoErro(erro));
    // Volta o campo para a quantidade que vale (a mínima é 1, RN-02)
    const atual = sacola.itens.find((outro) => outro.produtoId === item.produtoId && outro.tamanho === item.tamanho);
    entrada.value = atual ? atual.quantidade : 1;
  }
}

function remover(item) {
  limparAvisos();
  try {
    sacola.remover(item.produtoId, item.tamanho);
    sacola.salvar();
  } catch (erro) {
    mostrarErro(mensagemDoErro(erro));
    return;
  }

  atualizarContadorSacola();
  desenhar();
  anunciar("Item removido. Total: " + formatarPreco(sacola.total()) + ".");

  // O foco não pode se perder: vai para o próximo "Remover", ou para o link do catálogo se a sacola ficou vazia
  const proximo = blocoDosGrupos.querySelector("button");
  (proximo ?? mensagemVazia.querySelector("a")).focus();
}

function criarItem(item) {
  contadorDeCampos += 1;
  const idDaQuantidade = "quantidade-" + contadorDeCampos;

  const linha = criarElemento("li", "sacola-item");

  const imagem = criarElemento("img");
  imagem.src = item.foto;
  imagem.alt = "Foto de " + item.nome;
  imagem.width = 600;
  imagem.height = 750;

  const corpo = criarElemento("div");
  corpo.append(
    criarElemento("p", "sacola-item-nome", item.nome + " – tamanho " + item.tamanho),
    criarElemento("p", "", formatarPreco(item.preco) + " cada")
  );

  const controles = criarElemento("div", "sacola-item-controles");
  const rotulo = criarElemento("label", "", "Quantidade");
  rotulo.htmlFor = idDaQuantidade;
  rotulo.append(criarTextoOculto(item));

  const entrada = criarElemento("input");
  entrada.id = idDaQuantidade;
  entrada.type = "number";
  entrada.min = "1";
  entrada.step = "1";
  entrada.value = item.quantidade;
  entrada.addEventListener("change", () => alterarQuantidade(item, entrada));

  const botaoRemover = criarElemento("button", "botao botao-perigo botao-pequeno", "Remover");
  botaoRemover.type = "button";
  botaoRemover.append(criarTextoOculto(item));
  botaoRemover.addEventListener("click", () => remover(item));

  controles.append(rotulo, entrada, botaoRemover);
  corpo.append(controles);
  linha.append(imagem, corpo);
  return linha;
}

// Um bloco por loja (RN-03): nome da loja (com link), itens e subtotal
function criarGrupo(grupo) {
  const secao = criarElemento("section", "sacola-loja");
  secao.setAttribute("aria-labelledby", "loja-" + grupo.lojaId);

  const cabecalho = criarElemento("h2");
  cabecalho.id = "loja-" + grupo.lojaId;
  const link = criarElemento("a", "", grupo.lojaNome);
  link.href = "loja.html?id=" + encodeURIComponent(grupo.lojaId);
  cabecalho.append(link);

  const lista = criarElemento("ul", "sacola-itens");
  lista.append(...grupo.itens.map(criarItem));

  const subtotal = criarElemento("p", "sacola-subtotal");
  subtotal.id = "subtotal-" + grupo.lojaId;

  secao.append(cabecalho, lista, subtotal);
  return secao;
}

function desenhar() {
  const grupos = sacola.itensPorLoja();
  blocoDosGrupos.replaceChildren(...grupos.map(criarGrupo));

  const vazia = grupos.length === 0;
  mensagemVazia.hidden = !vazia;
  rodape.hidden = vazia;
  explicacao.hidden = vazia;
  atualizarTotais();
}

// ---------- Finalizar ----------

// Um cartão por loja, com o código do pedido, os itens, o total e o botão do WhatsApp (RF-10, RN-10)
function criarCartaoDoPedido(pedido, whatsapp) {
  const cartao = criarElemento("article", "pedido-loja");
  cartao.setAttribute("aria-label", "Pedido para " + pedido.lojaNome);

  const topo = criarElemento("div", "pedido-loja-topo");
  topo.append(criarElemento("h2", "", pedido.lojaNome), criarElemento("span", "selo selo-novo", pedido.rotuloParaCliente()));

  const codigo = criarElemento("p", "", "Pedido ");
  codigo.append(criarElemento("strong", "", "#" + pedido.codigoCurto()));

  const itens = criarElemento("ul", "pedido-itens");
  pedido.itens.forEach((item) => {
    itens.append(
      criarElemento("li", "", item.quantidade + "x " + item.nome + " (tamanho " + item.tamanho + ") – " + formatarPreco(item.precoUnitario) + " cada")
    );
  });

  cartao.append(topo, codigo, itens, criarElemento("p", "", "Total do pedido: " + formatarPreco(pedido.total)));

  // É um <a> comum (clique da própria usuária), e não um window.open: assim o navegador não bloqueia como pop-up
  const href = criarLinkDoWhatsapp(whatsapp, pedido.mensagemParaWhatsapp());
  if (href) {
    const botao = criarElemento("a", "botao botao-whatsapp", "Enviar pedido para " + pedido.lojaNome + " no WhatsApp");
    botao.href = href;
    botao.target = "_blank";
    botao.rel = "noopener";
    botao.append(criarElemento("span", "visualmente-oculto", " (abre em nova aba)"));
    cartao.append(botao);
  } else {
    cartao.append(
      criarElemento("p", "aviso aviso-info", "Esta loja ainda não cadastrou o WhatsApp. O pedido ficou gravado e a loja o verá no painel.")
    );
  }

  return cartao;
}

// Troca a sacola pela confirmação. Os pedidos JÁ estão gravados; se faltar o WhatsApp de alguma loja, só avisamos.
async function mostrarConfirmacao(pedidos) {
  const contatos = new Map();
  let faltouContato = false;

  try {
    const idsDasLojas = [...new Set(pedidos.map((pedido) => pedido.lojaId))];
    (await listarContatosDasLojas(idsDasLojas)).forEach((loja) => contatos.set(loja.id, loja.whatsapp));
  } catch (erro) {
    console.warn(erro.codigo, erro.cause ?? "");
    faltouContato = true;
  }

  blocoDosCartoes.replaceChildren(...pedidos.map((pedido) => criarCartaoDoPedido(pedido, contatos.get(pedido.lojaId))));

  titulo.textContent = "Pedidos enviados";
  document.title = "Pedidos enviados – VitrineCol";
  blocoDaSacola.hidden = true;
  blocoDaConfirmacao.hidden = false;
  limparAvisos();
  if (faltouContato) {
    mostrarInfo("Os pedidos foram gravados, mas não foi possível carregar o WhatsApp das lojas. Acompanhe tudo em Meus pedidos.");
  }
  titulo.focus(); // leva o foco (e o leitor de tela) para o título da confirmação
}

// Libera o botão de novo (quando a finalização não aconteceu ou falhou)
function liberarBotao() {
  enviando = false;
  botaoFinalizar.disabled = false;
  atualizarTotais();
}

async function finalizar() {
  // A trava liga JÁ no primeiro clique, antes de qualquer espera. Se ela só ligasse depois de consultar o login,
  // cliques seguidos passariam todos pela checagem e gravariam o pedido várias vezes.
  if (enviando) {
    return;
  }
  enviando = true;
  botaoFinalizar.disabled = true;
  limparAvisos();

  let usuaria;
  try {
    usuaria = await usuariaAtual();
  } catch (erro) {
    mostrarErro(mensagemDoErro(erro));
    liberarBotao();
    return;
  }

  // RN-04: sem login não há pedido. Ela vai entrar e volta para esta página, com a sacola intacta
  if (!usuaria) {
    liberarBotao(); // se ela voltar com o botão "Voltar" do navegador, o botão não pode ficar travado
    irParaOLogin();
    return;
  }
  if (!(usuaria instanceof Cliente)) {
    mostrarErro("Só contas de cliente fazem pedidos. Entre com uma conta de cliente.");
    liberarBotao();
    return;
  }

  botaoFinalizar.textContent = "Enviando pedidos…";
  mostrarCarregando("Gravando os pedidos…");

  let pedidos;
  try {
    pedidos = await criarPedidos(sacola);
  } catch (erro) {
    // Falhou: a sacola NÃO é limpa, para a cliente poder tentar de novo sem perder nada
    limparAvisos();
    mostrarErro(mensagemDoErro(erro));
    if (erro instanceof ErroApp && erro.codigo === "preco_mudou") {
      desenhar(); // o serviço atualizou os preços da sacola
    }
    liberarBotao();
    return;
  }

  // Gravou: agora sim esvazia a sacola
  sacola.limpar();
  try {
    sacola.salvar();
  } catch (erro) {
    console.warn(erro.codigo, erro.cause ?? "");
  }
  atualizarContadorSacola();
  await mostrarConfirmacao(pedidos);
}

botaoFinalizar.addEventListener("click", finalizar);

montarCabecalho();
desenhar();