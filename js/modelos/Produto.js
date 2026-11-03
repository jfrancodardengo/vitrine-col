// Produto de uma loja. Guarda as regras do produto: preço, estoque e fotos.
// Esta classe não mexe na tela nem no banco; só cuida dos dados e das regras (RN-02 e RN-12).
import { ErroApp } from "./ErroApp.js";
import { formatarPreco } from "../ui/formatadores.js";

const IMAGEM_SEM_FOTO = "imagens/sem-foto.svg";
// RN-12: exportado para a tela e o serviço usarem o mesmo limite
export const MAXIMO_DE_FOTOS = 5;

export class Produto {
  #id;
  #nome;
  #descricao;
  #preco;
  #categoria;
  #lojaId;
  #lojaNome;
  #ativo;
  #tamanhos; // lista de { tamanho, estoque }
  #fotos; // lista de endereços; a primeira é a capa

  constructor({
    id,
    nome,
    descricao = "",
    preco,
    categoria,
    lojaId,
    lojaNome = "",
    ativo = true,
    tamanhos = [],
    fotos = [],
  }) {
    this.#id = id;
    this.#descricao = descricao;
    this.#categoria = categoria;
    this.#lojaId = lojaId;
    this.#lojaNome = lojaNome;
    this.#ativo = ativo;
    this.#tamanhos = [];
    this.#fotos = [];

    // Os setters e métodos abaixo validam; assim a regra vale no construtor e também depois dele.
    this.nome = nome;
    this.preco = preco;
    tamanhos.forEach((item) => this.definirEstoque(item.tamanho, item.estoque));
    fotos.forEach((endereco) => this.adicionarFoto(endereco));
  }

  // ---------- Leitura ----------

  get id() {
    return this.#id;
  }

  get nome() {
    return this.#nome;
  }

  get descricao() {
    return this.#descricao;
  }

  get preco() {
    return this.#preco;
  }

  get categoria() {
    return this.#categoria;
  }

  get lojaId() {
    return this.#lojaId;
  }

  get lojaNome() {
    return this.#lojaNome;
  }

  get ativo() {
    return this.#ativo;
  }

  // Devolvem CÓPIAS. Se devolvessem a lista original, alguém de fora poderia fazer
  // produto.fotos.push(...) e passar de 5 fotos sem a validação rodar (encapsulamento).
  get tamanhos() {
    return this.#tamanhos.map((item) => ({ ...item }));
  }

  get fotos() {
    return [...this.#fotos];
  }

  // ---------- Escrita com validação ----------

  set nome(valor) {
    if (typeof valor !== "string" || valor.trim() === "") {
      throw new ErroApp("nome_invalido", "Informe o nome do produto.");
    }
    this.#nome = valor.trim();
  }

  // RN-02: o preço deve ser maior que zero.
  set preco(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero <= 0) {
      throw new ErroApp("preco_invalido", "O preço deve ser maior que zero.");
    }
    this.#preco = numero;
  }

  // RN-02: o estoque não pode ser negativo (e precisa ser um número inteiro).
  definirEstoque(tamanho, estoque) {
    if (typeof tamanho !== "string" || tamanho.trim() === "") {
      throw new ErroApp("tamanho_invalido", "Informe o tamanho.");
    }

    const quantidade = Number(estoque);
    if (!Number.isInteger(quantidade) || quantidade < 0) {
      throw new ErroApp("estoque_invalido", "O estoque não pode ser negativo.");
    }

    const existente = this.#tamanhos.find((item) => item.tamanho === tamanho);
    if (existente) {
      existente.estoque = quantidade;
    } else {
      this.#tamanhos.push({ tamanho, estoque: quantidade });
    }
  }

  // RN-12: no máximo 5 fotos por produto.
  adicionarFoto(endereco) {
    if (typeof endereco !== "string" || endereco.trim() === "") {
      throw new ErroApp("foto_invalida", "O endereço da foto é inválido.");
    }
    if (this.#fotos.length >= MAXIMO_DE_FOTOS) {
      throw new ErroApp("fotos_demais", "Cada produto pode ter no máximo 5 fotos.");
    }
    this.#fotos.push(endereco);
  }

  // ---------- Comportamentos ----------

  // 189.9 -> "R$ 189,90"
  precoFormatado() {
    return formatarPreco(this.#preco);
  }

  // RF-04: o tamanho só serve se existir E tiver estoque maior que zero.
  temEstoque(tamanho) {
    const item = this.#tamanhos.find((t) => t.tamanho === tamanho);
    return item !== undefined && item.estoque > 0;
  }

  // RN-12: a primeira foto é a capa; sem foto, devolve a imagem padrão.
  fotoCapa() {
    return this.#fotos.length > 0 ? this.#fotos[0] : IMAGEM_SEM_FOTO;
  }
}