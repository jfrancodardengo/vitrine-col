// Página da sacola: itens por loja, quantidades e total (RF-09, RN-02, RN-03).
// A sacola fica no navegador (localStorage). A finalização do pedido entra na Aula 36.
import { montarCabecalho, atualizarContadorSacola } from "../ui/cabecalho.js";
import { mostrarErro, mostrarInfo, limparAvisos, mensagemDoErro } from "../ui/avisos.js";
import { formatarPreco } from "../ui/formatadores.js";
import { Sacola } from "../modelos/Sacola.js";
import { criarElemento } from "../ui/elementos.js";

const anuncio = document.getElementById("anuncio-sacola");
const explicacao = document.getElementById("explicacao-sacola");
const blocoDosGrupos = document.getElementById("grupos-sacola");
const mensagemVazia = document.getElementById("sacola-vazia");
const rodape = document.getElementById("rodape-sacola");
const textoDoTotal = document.getElementById("total-sacola");
const botaoFinalizar = document.getElementById("botao-finalizar");

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

// A finalização do pedido entra na Aula 36
botaoFinalizar.addEventListener("click", () => mostrarInfo("Finalizar a sacola chega na próxima aula."));

montarCabecalho();
desenhar();