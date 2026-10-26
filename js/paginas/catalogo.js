// Aula 16: primeiras regras em JavaScript. Abra o Console do navegador (F12) para ver as mensagens.s
const nomeDoProduto = "Vestido midi floral";
let preco = 129.9;
const estoque = 3;

console.log("Produto:", nomeDoProduto);
console.log("Preço:", preco);
console.log("Tipo do preço:", typeof preco);

// Condicional: o produto só pode ser vendido se houver estoque
if (estoque > 0) {
  console.log(nomeDoProduto + " está disponível.");
} else {
  console.log(nomeDoProduto + " está esgotado.");
}

// Regra do projeto (RN-02): o preço precisa ser maior que zero
if(preco <= 0) {
  console.log("Preço inválido: ele precisa ser maior que zero.");
} else {
  console.log("Preço válido.");
}

// Operadores: um desconto de 10%
const desconto = 0.1;
const precoComDesconto = preco * (1 - desconto);
console.log("Com 10% de desconto:", precoComDesconto.toFixed(2));