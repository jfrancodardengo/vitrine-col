// Pedido de UMA loja (RN-03). Uma sacola com peças de 2 lojas gera 2 pedidos,
// cada um com o seu status, todos com o mesmo grupoId.
import { ErroApp } from "./ErroApp.js";
import { Sacola } from "./Sacola.js";
import { formatarPreco } from "../ui/formatadores.js";

// RN-05: de cada status, para quais outros é permitido ir.
// O pedido avança na ordem e pode ser cancelado até ser concluído.
const FLUXO_DE_STATUS = {
  novo: ["confirmado", "cancelado"],
  confirmado: ["concluido", "cancelado"],
  concluido: [],
  cancelado: [],
};

// RN-05: textos que a cliente enxerga.
const ROTULOS_PARA_CLIENTE = {
  novo: "Enviado à loja",
  confirmado: "Reserva confirmada",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export class Pedido {
  #id; // fica vazio até o pedido ser gravado no banco
  #grupoId;
  #lojaId;
  #lojaNome;
  #status;
  #itens; // cada item: { produtoId, nome, tamanho, quantidade, precoUnitario }

  constructor({
    id = null,
    grupoId,
    lojaId,
    lojaNome = "",
    status = "novo",
    itens,
  }) {
    if (!grupoId) {
      throw new ErroApp("grupo_invalido", "O pedido precisa de um grupo.");
    }
    if (lojaId === undefined || lojaId === null) {
      throw new ErroApp("loja_invalida", "O pedido precisa de uma loja.");
    }
    if (!Array.isArray(itens) || itens.length === 0) {
      throw new ErroApp("pedido_vazio", "O pedido precisa ter pelo menos um item.");
    }
    if (!(status in FLUXO_DE_STATUS)) {
      throw new ErroApp("status_invalido", "Status de pedido inválido.");
    }

    this.#id = id;
    this.#grupoId = grupoId;
    this.#lojaId = lojaId;
    this.#lojaNome = lojaNome;
    this.#status = status;
    this.#itens = itens.map((item) => ({ ...item }));
  }

  get id() {
    return this.#id;
  }

  get grupoId() {
    return this.#grupoId;
  }

  get lojaId() {
    return this.#lojaId;
  }

  get lojaNome() {
    return this.#lojaNome;
  }

  get status() {
    return this.#status;
  }

  get itens() {
    return this.#itens.map((item) => ({ ...item }));
  }

  // O total é calculado a partir dos itens, então nunca fica diferente deles.
  // Soma em centavos para evitar erro de arredondamento.
  get total() {
    const centavos = this.#itens.reduce(
      (soma, item) => soma + Math.round(item.precoUnitario * 100) * item.quantidade,
      0
    );
    return centavos / 100;
  }

  // Método estático: pertence à classe, não a um pedido específico.
  // Recebe a sacola e devolve UM pedido por loja, todos com o mesmo grupoId e cada um com o seu id.
  static criarPorLoja(sacola) {
    if (!(sacola instanceof Sacola)) {
      throw new ErroApp("sacola_invalida", "Sacola inválida.");
    }
    if (sacola.estaVazia()) {
      throw new ErroApp("sacola_vazia", "A sacola está vazia.");
    }

    const grupoId = crypto.randomUUID();

    return sacola.itensPorLoja().map(
      (grupo) =>
        new Pedido({
          // O id nasce aqui, no navegador, para os itens poderem apontar para o pedido já no mesmo envio
          id: crypto.randomUUID(),
          grupoId,
          lojaId: grupo.lojaId,
          lojaNome: grupo.lojaNome,
          // RN-06: o preço da sacola é copiado para o pedido e não muda mais
          itens: grupo.itens.map((item) => ({
            produtoId: item.produtoId,
            nome: item.nome,
            tamanho: item.tamanho,
            quantidade: item.quantidade,
            precoUnitario: item.preco,
          })),
        })
    );
  }

  // Código curto para a cliente e a loja se referirem ao pedido: os 8 primeiros caracteres do id.
  codigoCurto() {
    return String(this.#id ?? "").slice(0, 8);
  }

  // Texto que a cliente envia à loja pelo WhatsApp (RF-10): saudação, código, SÓ os itens deste pedido e o total dele.
  mensagemParaWhatsapp() {
    // O Intl usa um espaço "não separável" no preço; no texto da mensagem um espaço comum fica melhor
    const preco = (valor) => formatarPreco(valor).replace(/\u00a0/g, " ");

    const itens = this.#itens.map(
      (item) => "- " + item.quantidade + "x " + item.nome + " (tamanho " + item.tamanho + ") - " + preco(item.precoUnitario) + " cada"
    );

    return [
      "Olá" + (this.#lojaNome ? ", " + this.#lojaNome : "") + "! Fiz um pedido pela VitrineCol.",
      "Pedido #" + this.codigoCurto(),
      "",
      ...itens,
      "",
      "Total: " + preco(this.total),
    ].join("\n");
  }

  rotuloParaCliente() {
    return ROTULOS_PARA_CLIENTE[this.#status];
  }

}