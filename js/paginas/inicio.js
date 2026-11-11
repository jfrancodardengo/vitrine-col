// Página inicial (index.html, RF-23): hero, carrossel com as peças mais recentes, tipos de roupa,
// produtos em destaque e lojas parceiras. A página só chama os serviços e mostra o resultado e os avisos.
// Cada bloco é independente: se um deles falhar, os outros continuam aparecendo.
import { montarCabecalho } from "../ui/cabecalho.js";
import { mostrarCarregando, mostrarErro, limparAvisos, mensagemDoErro, registrarErro } from "../ui/avisos.js";
import { criarCardProduto } from "../ui/cards.js";
import { criarCarrossel } from "../ui/carrossel.js";
import { criarElemento } from "../ui/elementos.js";
import { Produto } from "../modelos/Produto.js";
import { listarProdutosEmDestaque } from "../servicos/produtoServico.js";
import { listarCategorias } from "../servicos/categoriaServico.js";
import { listarLojasParaVitrine } from "../servicos/lojaServico.js";

const QUANTIDADE_DE_DESTAQUES = 8;
const QUANTIDADE_DE_SLIDES = 5; // o carrossel usa as primeiras peças dos destaques

const secaoCarrossel = document.getElementById("secao-carrossel");
const areaDoCarrossel = document.getElementById("carrossel");
const listaCategorias = document.getElementById("lista-categorias");
const listaDestaques = document.getElementById("lista-destaques");
const mensagemSemDestaques = document.getElementById("mensagem-sem-destaques");
const listaLojas = document.getElementById("lista-lojas");
const mensagemSemLojas = document.getElementById("mensagem-sem-lojas");

// ---------- Carrossel ----------

// Um slide: a foto da peça de um lado e, do outro, o nome, o preço, a loja e o link para a página do produto.
function criarSlideDeProduto(produto) {
  const slide = criarElemento("div");
  const endereco = "produto.html?id=" + encodeURIComponent(produto.id);

  const imagem = criarElemento("img", "slide-imagem");
  imagem.src = produto.fotoCapa();
  imagem.alt = "Foto de " + produto.nome;
  imagem.width = 800;
  imagem.height = 600;

  const texto = criarElemento("div", "slide-texto");
  texto.append(criarElemento("p", "slide-etiqueta", "Novidade em " + (produto.categoria || "moda")));

  const titulo = criarElemento("h3", "slide-titulo");
  const link = criarElemento("a", "", produto.nome);
  link.href = endereco;
  titulo.append(link);

  const botao = criarElemento("a", "botao", "Ver esta peça");
  botao.href = endereco;
  // O botão leva ao mesmo lugar que o título; o nome completo no aria-label deixa claro para o leitor de tela qual peça é
  botao.setAttribute("aria-label", "Ver a peça " + produto.nome);

  texto.append(
    titulo,
    criarElemento("p", "preco", produto.precoFormatado()),
    criarElemento("p", "slide-loja", "Vendido por " + produto.lojaNome),
    botao
  );

  slide.append(imagem, texto);
  return slide;
}

function mostrarCarrossel(produtos) {
  if (produtos.length === 0) {
    secaoCarrossel.hidden = true;
    return;
  }
  const slides = produtos.slice(0, QUANTIDADE_DE_SLIDES).map(criarSlideDeProduto);
  areaDoCarrossel.replaceChildren(criarCarrossel(slides, "Novidades nas lojas"));
  secaoCarrossel.hidden = false;
}

// ---------- Destaques ----------

function mostrarDestaques(produtos) {
  listaDestaques.replaceChildren(...produtos.map(criarCardProduto));
  mensagemSemDestaques.hidden = produtos.length > 0;
}

// ---------- Categorias ----------

// Cada tipo de roupa leva ao catálogo já filtrado (catalogo.html?categoria=ID)
function mostrarCategorias(categorias) {
  const itens = categorias.map((categoria) => {
    const item = criarElemento("li");
    const link = criarElemento("a", "categoria-link", categoria.nome);
    link.href = "catalogo.html?categoria=" + encodeURIComponent(categoria.id);
    item.append(link);
    return item;
  });

  const itemDeTodas = criarElemento("li");
  const linkDeTodas = criarElemento("a", "categoria-link categoria-link-todas", "Ver tudo");
  linkDeTodas.href = "catalogo.html";
  itemDeTodas.append(linkDeTodas);

  listaCategorias.replaceChildren(...itens, itemDeTodas);
}

// ---------- Lojas ----------

function mostrarLojas(lojas) {
  const cartoes = lojas.map((loja) => {
    const item = criarElemento("li");
    const cartao = criarElemento("article", "cartao-loja");

    const titulo = criarElemento("h3", "cartao-loja-titulo");
    const link = criarElemento("a", "", loja.nome);
    link.href = "loja.html?id=" + encodeURIComponent(loja.id);
    titulo.append(link);

    cartao.append(titulo, criarElemento("p", "cartao-loja-cidade", loja.cidade));
    if (loja.descricao) {
      cartao.append(criarElemento("p", "cartao-loja-descricao", loja.descricao));
    }

    item.append(cartao);
    return item;
  });

  listaLojas.replaceChildren(...cartoes);
  mensagemSemLojas.hidden = lojas.length > 0;
}

// ---------- Início ----------

async function iniciar() {
  montarCabecalho();
  mostrarCarregando();

  // As três consultas não dependem uma da outra: rodam juntas, e allSettled espera todas, mesmo que alguma falhe
  const [destaques, categorias, lojas] = await Promise.allSettled([
    listarProdutosEmDestaque(QUANTIDADE_DE_DESTAQUES),
    listarCategorias(),
    listarLojasParaVitrine(),
  ]);

  let primeiroErro = null;

  if (destaques.status === "fulfilled") {
    const produtos = destaques.value.map(Produto.deLinha);
    mostrarCarrossel(produtos);
    mostrarDestaques(produtos);
  } else {
    primeiroErro = destaques.reason;
  }

  if (categorias.status === "fulfilled") {
    mostrarCategorias(categorias.value);
  } else {
    primeiroErro = primeiroErro ?? categorias.reason;
  }

  if (lojas.status === "fulfilled") {
    mostrarLojas(lojas.value);
  } else {
    primeiroErro = primeiroErro ?? lojas.reason;
  }

  if (primeiroErro) {
    [destaques, categorias, lojas].forEach((resultado) => {
      if (resultado.status === "rejected") {
        registrarErro(resultado.reason);
      }
    });
    mostrarErro(mensagemDoErro(primeiroErro));
  } else {
    limparAvisos();
  }
}

iniciar();