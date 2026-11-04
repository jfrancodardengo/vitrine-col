// Monta o card de um produto usando só o DOM (createElement + textContent), sem montar HTML em texto (RNF-06).
// Recebe um objeto Produto (js/modelos/Produto.js): ele já sabe formatar o preço e escolher a capa.
import { criarElemento } from "./elementos.js";

// Devolve um <li> pronto para ser colocado dentro da lista do catálogo.
export function criarCardProduto(produto) {
  const item = document.createElement("li");
  const card = criarElemento("article", "card-produto");

  // fotoCapa() devolve a primeira foto, ou a imagem padrão quando o produto não tem foto
  const imagem = criarElemento("img", "card-produto-imagem");
  imagem.src = produto.fotoCapa();
  imagem.alt = "Foto de " + produto.nome;
  imagem.width = 600;
  imagem.height = 750;
  imagem.loading = "lazy";

  const corpo = criarElemento("div", "card-produto-corpo");

  const titulo = criarElemento("h3", "card-produto-titulo");
  const link = criarElemento("a", "", produto.nome);
  link.href = "produto.html?id=" + encodeURIComponent(produto.id);
  titulo.append(link);

  const preco = criarElemento("p", "preco", produto.precoFormatado());
  const loja = criarElemento("p", "card-produto-loja", produto.lojaNome);

  corpo.append(titulo, preco, loja);
  card.append(imagem, corpo);
  item.append(card);

  return item;
}