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

// Textos que a lojista enxerga no painel.
const ROTULOS_PARA_LOJISTA = {
  novo: "Novo",
  confirmado: "Confirmado",
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
  #mensagemLoja; // recado da lojista para a cliente (RN-13)
  #statusVisto; // false = a cliente ainda não viu a novidade (RN-13)
  #criadoEm;
  #clienteNome; // só vem preenchido para a lojista (ela lê o perfil das clientes dos seus pedidos)
  #clienteTelefone;

  constructor({
    id = null,
    grupoId,
    lojaId,
    lojaNome = "",
    status = "novo",
    itens,
    mensagemLoja = "",
    statusVisto = true,
    criadoEm = null,
    clienteNome = "",
    clienteTelefone = "",
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
    this.#mensagemLoja = String(mensagemLoja ?? "");
    this.#statusVisto = statusVisto !== false;
    this.#criadoEm = criadoEm;
    this.#clienteNome = clienteNome ?? "";
    this.#clienteTelefone = clienteTelefone ?? "";
  }

  get id() {
    return this.#id;
  }
  
  get mensagemLoja() {
    return this.#mensagemLoja;
  }

  get statusVisto() {
    return this.#statusVisto;
  }

  get criadoEm() {
    return this.#criadoEm;
  }

  get clienteNome() {
    return this.#clienteNome;
  }

  get clienteTelefone() {
    return this.#clienteTelefone;
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

  // Monta um Pedido a partir de uma linha do banco (colunas em snake_case, com as tabelas relacionadas dentro):
  // lojas, itens_pedido (cada item com o seu produto) e, para a lojista, o perfil da cliente.
  static deLinha(linha) {
    return new Pedido({
      id: linha.id,
      grupoId: linha.grupo_id,
      lojaId: linha.loja_id,
      lojaNome: linha.lojas?.nome ?? "",
      status: linha.status,
      itens: (linha.itens_pedido ?? []).map((item) => ({
        produtoId: item.produto_id,
        // Se o produto saiu do catálogo (foi desativado), a leitura pública não o devolve: usamos um nome neutro
        nome: item.produtos?.nome ?? "Produto indisponível",
        tamanho: item.tamanho,
        quantidade: item.quantidade,
        precoUnitario: Number(item.preco_unitario),
      })),
      mensagemLoja: linha.mensagem_loja ?? "",
      statusVisto: linha.status_visto,
      criadoEm: linha.criado_em,
      clienteNome: linha.perfis?.nome ?? "",
      clienteTelefone: linha.perfis?.telefone ?? "",
    });
  }

  // RN-05: para quais status um pedido que está em "statusAtual" pode ir. Estático para o serviço
  // conferir a transição sem precisar montar um Pedido inteiro.
  static statusPermitidos(statusAtual) {
    return [...(FLUXO_DE_STATUS[statusAtual] ?? [])];
  }

  // Lista os status para os quais este pedido pode ir agora (RN-05).
  proximosStatus() {
    return Pedido.statusPermitidos(this.#status);
  }

  // Muda o status, mas só se o fluxo permitir; senão lança ErroApp.
  alterarStatus(novoStatus) {
    if (!this.proximosStatus().includes(novoStatus)) {
      throw new ErroApp(
        "status_nao_permitido",
        'Não é possível mudar o pedido de "' +
          ROTULOS_PARA_CLIENTE[this.#status] +
          '" para "' +
          (ROTULOS_PARA_CLIENTE[novoStatus] ?? novoStatus) +
          '".'
      );
    }
    this.#status = novoStatus;
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

  rotuloParaLojista() {
    return ROTULOS_PARA_LOJISTA[this.#status];
  }

  // Aviso que a lojista pode mandar à cliente pelo WhatsApp (RF-22, desejável):
  // "Olá, <nome>! Seu pedido #<código> na <loja> agora está: <rótulo>. <recado, se houver>"
  mensagemDeStatusParaCliente() {
    const recado = this.#mensagemLoja.trim();
    return (
      "Olá, " + this.#clienteNome + "! Seu pedido #" + this.codigoCurto() + " na " + this.#lojaNome +
      " agora está: " + this.rotuloParaCliente() + "." + (recado ? " " + recado : "")
    );
  }
  
}