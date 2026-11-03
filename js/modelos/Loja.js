// Loja de moda. Ela TEM uma lista de Produtos: isso é agregação (a Loja agrupa produtos,
// mas cada Produto continua sendo um objeto independente, com as suas próprias regras).
import { ErroApp } from "./ErroApp.js";
import { Produto } from "./Produto.js";
import { telefoneValido } from "../ui/formatadores.js";

// Texto obrigatório: usado para nome, endereço e cidade.
function exigirTexto(valor, codigo, mensagem) {
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new ErroApp(codigo, mensagem);
  }
  return valor.trim();
}

// O link do mapa é opcional, mas se existir precisa ser http ou https: um "javascript:..." num link seria perigoso.
function validarLinkDoMapa(valor) {
  const texto = String(valor ?? "").trim();
  if (texto === "") {
    return "";
  }
  try {
    const protocolo = new URL(texto).protocol;
    if (protocolo === "http:" || protocolo === "https:") {
      return texto;
    }
  } catch (erro) {
    // endereço que nem é um link: cai no erro abaixo
  }
  throw new ErroApp("link_mapa_invalido", "O link do mapa deve começar com http:// ou https://.");
}

export class Loja {
  #id;
  #nome;
  #descricao;
  #endereco;
  #cidade;
  #whatsapp;
  #linkMapa;
  #imagemUrl;
  #produtos = []; // a agregação: lista de objetos Produto

  constructor({ id, nome, descricao = "", endereco, cidade, whatsapp, linkMapa = "", imagemUrl = "" }) {
    this.#id = id;
    this.#nome = exigirTexto(nome, "nome_invalido", "Informe o nome da loja.");
    this.#descricao = descricao;
    this.#endereco = exigirTexto(endereco, "endereco_invalido", "Informe o endereço da loja.");
    this.#cidade = exigirTexto(cidade, "cidade_invalida", "Informe a cidade da loja.");
    this.whatsapp = whatsapp;
    this.#linkMapa = validarLinkDoMapa(linkMapa);
    this.#imagemUrl = imagemUrl;
  }

  get id() {
    return this.#id;
  }

  get nome() {
    return this.#nome;
  }

  get descricao() {
    return this.#descricao;
  }

  get endereco() {
    return this.#endereco;
  }

  get cidade() {
    return this.#cidade;
  }

  get whatsapp() {
    return this.#whatsapp;
  }

  get linkMapa() {
    return this.#linkMapa;
  }

  get imagemUrl() {
    return this.#imagemUrl;
  }

  // RN-10: só dígitos, com código do país e DDD. Ex.: 5527999999999 (13) ou 552733334444 (12).
  set whatsapp(valor) {
    const texto = String(valor ?? "");
    if (!telefoneValido(texto)) {
      throw new ErroApp(
        "whatsapp_invalido",
        "O WhatsApp deve ter só números, com código do país e DDD (12 ou 13 dígitos)."
      );
    }
    this.#whatsapp = texto;
  }

  // Devolve uma cópia da lista, para ninguém de fora mexer nela sem passar pelas regras da Loja.
  get produtos() {
    return [...this.#produtos];
  }

  adicionarProduto(produto) {
    if (!(produto instanceof Produto)) {
      throw new ErroApp("produto_invalido", "Só é possível adicionar produtos à loja.");
    }
    if (produto.lojaId !== this.#id) {
      throw new ErroApp("produto_de_outra_loja", "Este produto pertence a outra loja.");
    }
    this.#produtos.push(produto);
  }

  // RN-08: produtos inativos não aparecem na página da loja.
  produtosAtivos() {
    return this.#produtos.filter((produto) => produto.ativo);
  }
}