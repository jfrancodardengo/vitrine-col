// Página pública do produto (produto.html?id=...): galeria, preço, loja, tamanhos e quantidade (RF-08, RN-02, RN-08).
// O botão "Adicionar à sacola" ainda não grava nada: a sacola chega na Aula 35.
import { montarCabecalho } from "../ui/cabecalho.js";
import { mostrarCarregando, mostrarErro, mostrarInfo, limparAvisos, mensagemDoErro, mostrarErroDoCampo, limparErrosDosCampos } from "../ui/avisos.js";
import { ErroApp } from "../modelos/ErroApp.js";
import { Produto } from "../modelos/Produto.js";
import { obterProduto } from "../servicos/produtoServico.js";

const titulo = document.getElementById("titulo-produto");
const detalhe = document.getElementById("produto-detalhe");
const fotoPrincipal = document.getElementById("foto-principal");
const listaMiniaturas = document.getElementById("miniaturas");
const precoProduto = document.getElementById("preco-produto");
const linkLoja = document.getElementById("link-loja");
const descricao = document.getElementById("descricao-produto");
const formulario = document.getElementById("formulario-compra");
const blocoTamanhos = document.getElementById("tamanhos");
const campoQuantidade = document.getElementById("quantidade");
const botaoAdicionar = document.getElementById("botao-adicionar");
const atalhoSacola = document.getElementById("atalho-sacola");
const voltarAoCatalogo = document.getElementById("voltar-catalogo");

let produto = null;

// ---------- Galeria de fotos ----------

// Mostra a foto de posição "indice" (0 é a capa) como foto grande e marca a miniatura correspondente
function mostrarFoto(indice) {
  const fotos = produto.fotos;
  fotoPrincipal.src = fotos[indice];
  fotoPrincipal.alt = "Foto " + (indice + 1) + " de " + fotos.length + ": " + produto.nome;

  listaMiniaturas.querySelectorAll(".miniatura").forEach((botao, posicao) => {
    botao.setAttribute("aria-current", String(posicao === indice));
  });
}

function criarMiniatura(url, indice, total) {
  const item = document.createElement("li");

  // Cada miniatura é um <button>: o teclado (Tab, Enter e espaço) funciona sem nenhum código extra
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "miniatura";

  const imagem = document.createElement("img");
  imagem.src = url;
  imagem.alt = "Ver a foto " + (indice + 1) + " de " + total;
  imagem.width = 600;
  imagem.height = 750;

  botao.append(imagem);
  botao.addEventListener("click", () => mostrarFoto(indice));
  item.append(botao);
  return item;
}

function montarGaleria() {
  const fotos = produto.fotos;

  if (fotos.length === 0) {
    // Sem foto: imagem padrão e nenhuma miniatura (RN-12)
    fotoPrincipal.src = produto.fotoCapa();
    fotoPrincipal.alt = "Produto sem foto: " + produto.nome;
    return;
  }

  mostrarFoto(0);

  // Com uma foto só, não há o que escolher: sem miniaturas
  if (fotos.length > 1) {
    listaMiniaturas.replaceChildren(...fotos.map((url, indice) => criarMiniatura(url, indice, fotos.length)));
    listaMiniaturas.hidden = false;
    mostrarFoto(0); // marca a primeira miniatura
  }
}

// ---------- Tamanhos ----------

// Um botão de rádio por tamanho. Tamanho sem estoque fica desabilitado (RF-08).
function montarTamanhos() {
  const opcoes = produto.tamanhos.map((item, indice) => {
    const rotulo = document.createElement("label");
    rotulo.className = "tamanho-opcao";

    const entrada = document.createElement("input");
    entrada.type = "radio";
    entrada.name = "tamanho";
    entrada.id = "tamanho-" + indice;
    entrada.value = item.tamanho;

    const esgotado = !produto.temEstoque(item.tamanho);
    entrada.disabled = esgotado;
    // O texto do rótulo é só o tamanho; o aria-label completa a informação para o leitor de tela
    entrada.setAttribute("aria-label", item.tamanho + (esgotado ? ", sem estoque" : ""));

    const texto = document.createElement("span");
    texto.textContent = item.tamanho;

    rotulo.append(entrada, texto);
    return rotulo;
  });

  blocoTamanhos.replaceChildren(...opcoes);
}

// ---------- Tela ----------

function mostrarProduto() {
  titulo.textContent = produto.nome; // textContent: o nome vem do banco
  document.title = produto.nome + " – VitrineCol";
  precoProduto.textContent = produto.precoFormatado();

  linkLoja.textContent = produto.lojaNome;
  linkLoja.href = "loja.html?id=" + encodeURIComponent(produto.lojaId);

  if (produto.descricao) {
    descricao.textContent = produto.descricao;
    descricao.hidden = false;
  }

  montarGaleria();
  montarTamanhos();

  // Produto sem nenhum tamanho em estoque: nada para comprar
  const temAlgumTamanho = produto.tamanhos.some((item) => produto.temEstoque(item.tamanho));
  if (!temAlgumTamanho) {
    mostrarInfo("Este produto está sem estoque no momento.");
    botaoAdicionar.disabled = true;
    campoQuantidade.disabled = true;
  }

  detalhe.hidden = false;
}

// ---------- Adicionar à sacola ----------

formulario.addEventListener("submit", (evento) => {
  // Sem isto o navegador recarregaria a página
  evento.preventDefault();

  limparErrosDosCampos(formulario);
  limparAvisos();
  atalhoSacola.hidden = true;

  const escolhido = formulario.querySelector('input[name="tamanho"]:checked');
  if (!escolhido) {
    const primeiroDisponivel = formulario.querySelector('input[name="tamanho"]:not(:disabled)');
    mostrarErroDoCampo(primeiroDisponivel, "Escolha um tamanho.");
    primeiroDisponivel.focus();
    return;
  }

  const quantidade = Number(campoQuantidade.value);
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    mostrarErroDoCampo(campoQuantidade, "A quantidade mínima é 1.");
    campoQuantidade.focus();
    return;
  }

  // A sacola chega na próxima aula; por enquanto só confirmamos o que foi escolhido
  mostrarInfo("Você escolheu o tamanho " + escolhido.value + ", quantidade " + quantidade + ". A sacola chega na próxima aula.");
});

async function iniciar() {
  montarCabecalho();
  mostrarCarregando();

  try {
    const id = new URLSearchParams(location.search).get("id");
    if (!id) {
      throw new ErroApp("produto_nao_encontrado", "Produto não encontrado.");
    }

    produto = Produto.deLinha(await obterProduto(id));
    limparAvisos(); // tira o "Carregando…" ANTES de montar a página, que pode mostrar um aviso próprio (sem estoque)
    mostrarProduto();
  } catch (erro) {
    mostrarErro(mensagemDoErro(erro));
    voltarAoCatalogo.hidden = false;
  }
}

iniciar();