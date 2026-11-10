// Sacola de compras. Aceita peças de VÁRIAS lojas (RN-03) e fica guardada no navegador (localStorage).
// Cada item guarda uma "foto" dos dados do produto no momento em que foi adicionado
// (nome, preço, loja), para a sacola poder ser mostrada sem consultar o banco.
import { ErroApp } from "./ErroApp.js";
import { Produto } from "./Produto.js";

// Nome da gaveta do localStorage onde a sacola fica guardada.
export const CHAVE_SACOLA = "sacola";

export class Sacola {
  // Cada item: { produtoId, nome, preco, tamanho, quantidade, lojaId, lojaNome, foto }
  #itens = [];

  constructor(itens = []) {
    // Itens com formato estranho (localStorage antigo ou mexido à mão) são descartados.
    itens.filter(Sacola.#itemValido).forEach((item) => this.#itens.push({ ...item }));
  }

  // ---------- Leitura ----------

  // Cópia dos itens; quem está de fora não altera a lista original.
  get itens() {
    return this.#itens.map((item) => ({ ...item }));
  }

  estaVazia() {
    return this.#itens.length === 0;
  }

  // Soma das quantidades (o número que aparece no cabeçalho).
  quantidadeTotal() {
    return this.#itens.reduce((soma, item) => soma + item.quantidade, 0);
  }

  total() {
    return Sacola.#somar(this.#itens);
  }

  // Agrupa os itens por loja, na ordem em que cada loja apareceu.
  // Cada grupo vira um pedido na hora de finalizar (RN-03).
  itensPorLoja() {
    // O Map guarda um grupo por lojaId
    const grupos = new Map();

    for (const item of this.#itens) {
      if (!grupos.has(item.lojaId)) {
        grupos.set(item.lojaId, { lojaId: item.lojaId, lojaNome: item.lojaNome, itens: [] });
      }
      grupos.get(item.lojaId).itens.push({ ...item });
    }

    return [...grupos.values()].map((grupo) => ({
      ...grupo,
      subtotal: Sacola.#somar(grupo.itens),
    }));
  }

  // ---------- Alterações ----------

  adicionar(produto, tamanho, quantidade = 1) {
    if (!(produto instanceof Produto)) {
      throw new ErroApp("produto_invalido", "Produto inválido.");
    }
    const quantidadeValida = Sacola.#validarQuantidade(quantidade);

    // RF-08: tamanho sem estoque não pode ser escolhido
    if (!produto.temEstoque(tamanho)) {
      throw new ErroApp("tamanho_indisponivel", "Este tamanho está sem estoque.");
    }

    // O mesmo produto no mesmo tamanho vira uma linha só, com a quantidade somada
    const existente = this.#buscar(produto.id, tamanho);
    if (existente) {
      existente.quantidade += quantidadeValida;
      return;
    }

    this.#itens.push({
      produtoId: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      tamanho,
      quantidade: quantidadeValida,
      lojaId: produto.lojaId,
      lojaNome: produto.lojaNome,
      foto: produto.fotoCapa(),
    });
  }

  // RN-02: a quantidade mínima de um item é 1 (para tirar da sacola existe o remover).
  alterarQuantidade(produtoId, tamanho, quantidade) {
    const quantidadeValida = Sacola.#validarQuantidade(quantidade);
    this.#buscarOuFalhar(produtoId, tamanho).quantidade = quantidadeValida;
  }

  remover(produtoId, tamanho) {
    const item = this.#buscarOuFalhar(produtoId, tamanho);
    this.#itens = this.#itens.filter((outro) => outro !== item);
  }

  // Troca o preço dos itens pelo preço atual do produto (precosPorProduto é um Map: id do produto -> preço).
  // Usada ao finalizar, quando o lojista mudou um preço depois que a peça entrou na sacola.
  // Devolve a lista do que mudou: [{ nome, de, para }].
  atualizarPrecos(precosPorProduto) {
    const alterados = [];

    for (const item of this.#itens) {
      const novoPreco = precosPorProduto.get(item.produtoId);
      if (Number.isFinite(novoPreco) && novoPreco > 0 && novoPreco !== item.preco) {
        alterados.push({ nome: item.nome, de: item.preco, para: novoPreco });
        item.preco = novoPreco;
      }
    }
    return alterados;
  }

  // Esvazia a sacola (usado depois de finalizar o pedido).
  limpar() {
    this.#itens = [];
  }

  // ---------- localStorage ----------

  salvar() {
    try {
      localStorage.setItem(CHAVE_SACOLA, JSON.stringify(this.#itens));
    } catch (erro) {
      throw new ErroApp("sacola_nao_salva", "Não foi possível guardar a sacola neste navegador.", erro);
    }
  }

  // Método estático: não precisa de uma sacola pronta, ele devolve uma.
  // Se não houver nada guardado, ou o conteúdo estiver estragado, devolve uma sacola vazia.
  static carregar() {
    try {
      const itens = JSON.parse(localStorage.getItem(CHAVE_SACOLA));
      return new Sacola(Array.isArray(itens) ? itens : []);
    } catch (erro) {
      return new Sacola();
    }
  }

  // ---------- Apoio interno (privado) ----------

  #buscar(produtoId, tamanho) {
    return this.#itens.find((item) => item.produtoId === produtoId && item.tamanho === tamanho);
  }

  #buscarOuFalhar(produtoId, tamanho) {
    const item = this.#buscar(produtoId, tamanho);
    if (!item) {
      throw new ErroApp("item_nao_encontrado", "Este item não está na sacola.");
    }
    return item;
  }

  static #validarQuantidade(valor) {
    const quantidade = Number(valor);
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      throw new ErroApp("quantidade_invalida", "A quantidade mínima é 1.");
    }
    return quantidade;
  }

  static #itemValido(item) {
    return (
      item !== null &&
      typeof item === "object" &&
      item.produtoId !== undefined &&
      item.lojaId !== undefined &&
      typeof item.nome === "string" &&
      typeof item.tamanho === "string" &&
      Number.isFinite(item.preco) &&
      item.preco > 0 &&
      Number.isInteger(item.quantidade) &&
      item.quantidade >= 1
    );
  }

  // Soma em centavos (números inteiros): somar decimais direto dá erros como 0.1 + 0.2 = 0.30000000000000004
  static #somar(itens) {
    const centavos = itens.reduce(
      (soma, item) => soma + Math.round(item.preco * 100) * item.quantidade,
      0
    );
    return centavos / 100;
  }
}