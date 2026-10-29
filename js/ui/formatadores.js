// Funções que transformam valores em texto no padrão brasileiro (RNF-12).
// Criamos o formatador uma vez só; criar um novo a cada chamada seria desperdício.
const formatadorDeMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// 189.9 -> "R$ 189,90"
export function formatarPreco(valor) {
  return formatadorDeMoeda.format(Number(valor));
}