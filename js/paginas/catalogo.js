// Aula 17: funções, arrays e objetos. Os produtos são dados fictícios, só para treinar.
// Cada produto é um objeto com as mesmas propriedades que a classe Produto terá (Aula 22).
const produtosFicticios = [
  {
    id: 1,
    nome: "Vestido midi floral",
    descricao: "Tecido leve, ideal para o verão",
    preco: 129.9,
    categoria: "Vestidos",
    lojaId: "l1",
    lojaNome: "Loja Exemplo",
    tamanhos: [
      { tamanho: "P", estoque: 3},
      { tamanho: "M", estoque: 5},
      { tamanho: "G", estoque: 2},
    ],
    fotos: ["imagens/exemplo-1.svg"],
  },
  {
    id: "p2",
    nome: "Camiseta básica branca",
    descricao: "Algodão, corte reto",
    preco: 49.9,
    categoria: "Camisetas",
    lojaId: "l1",
    lojaNome: "Loja Exemplo",
    tamanhos: [
      { tamanho: "P", estoque: 10 },
      { tamanho: "M", estoque: 10 },
      { tamanho: "G", estoque: 6 },
    ],
    fotos: ["imagens/exemplo-2.svg"],
  },
  {
    id: "p3",
    nome: "Calça jeans reta",
    descricao: "Cintura alta, lavagem clara",
    preco: 159.9,
    categoria: "Calças",
    lojaId: "l2",
    lojaNome: "Loja do Bairro",
    tamanhos: [
      { tamanho: "38", estoque: 2 },
      { tamanho: "40", estoque: 4 },
      { tamanho: "42", estoque: 1 },
    ],
    fotos: ["imagens/exemplo-3.svg"],
  },
  {
    id: "p4",
    nome: "Blusa de alça",
    descricao: "Malha macia, ótima para o dia a dia",
    preco: 69.9,
    categoria: "Blusas",
    lojaId: "l2",
    lojaNome: "Loja do Bairro",
    tamanhos: [
      { tamanho: "P", estoque: 2 },
      { tamanho: "M", estoque: 0 },
      { tamanho: "G", estoque: 1 },
    ],
    fotos: ["imagens/exemplo-4.svg"],
  },
  {
    id: "p5",
    nome: "Saia plissada",
    descricao: "Comprimento midi, cintura com elástico",
    preco: 89.9,
    categoria: "Saias",
    lojaId: "l1",
    lojaNome: "Loja Exemplo",
    tamanhos: [
      { tamanho: "P", estoque: 4 },
      { tamanho: "M", estoque: 4 },
    ],
    fotos: ["imagens/exemplo-5.svg"],
  },
  {
    id: "p6",
    nome: "Jaqueta jeans",
    descricao: "Modelo curto, com bolsos frontais",
    preco: 219.9,
    categoria: "Jaquetas",
    lojaId: "l2",
    lojaNome: "Loja do Bairro",
    tamanhos: [
      { tamanho: "M", estoque: 1 },
      { tamanho: "G", estoque: 2 },
    ],
    fotos: ["imagens/exemplo-6.svg"],
  },
  {
    id: "p7",
    nome: "Jaqueta de couro",
    descricao: "Modelo curto, com bolsos frontais",
    preco: 219.9,
    categoria: "Jaquetas",
    lojaId: "l2",
    lojaNome: "Loja do Bairro",
    tamanhos: [
      { tamanho: "M", estoque: 1 },
      { tamanho: "G", estoque: 2 },
    ],
    fotos: ["imagens/exemplo-6.svg"],
  }
];

// Uma função pequena: recebe um produto e um tamanho e devolve true ou false
function temEstoque(produto, tamanho) {
  const item = produto.tamanhos.find((t) => t.tamanho === tamanho);
  return item !== undefined && item.estoque > 0;
}

// Soma o estoque de todos os tamanhos de um produto
function somarEstoque(produto) {
  let total = 0;
  for (const item of produto.tamanhos) {
    total += item.estoque;
  }
  return total;
}

//Subtotal de uma linha da sacola (preço vezes quantidade)
function calcularSubtotal(preco, quantidade) {
  return preco * quantidade;
}

// Percorre a lista com for...of e mostra um resumo de cada produto no Console
for (const produto of produtosFicticios) {
  console.log(produto.nome + " (" + produto.lojaNome + "): estoque total " + somarEstoque(produto));
}

function calcularDesconto(preco, percentual) {
  let precoComDesconto = 0;
  precoComDesconto = preco * (1 - (percentual/100));
  return precoComDesconto;
}

console.log("Vestido tem estoque no G?", temEstoque(produtosFicticios[0], "G"));
console.log("Duas camisetas custam", calcularSubtotal(produtosFicticios[1].preco, 2).toFixed(2));
console.log("Preço com desconto", calcularDesconto(129.9, 20).toFixed(2));
console.log(produtosFicticios[produtosFicticios.length - 1].nome)