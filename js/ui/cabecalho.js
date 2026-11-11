// Gera o cabeçalho comum das páginas e mantém o contador de itens da sacola.
// Cada página tem um <header id="cabecalho"> vazio, que este arquivo preenche.
// O menu muda conforme quem está logada: visitante, cliente ou lojista.
import { Sacola } from "../modelos/Sacola.js";
import { Lojista } from "../modelos/Lojista.js";
import { usuariaAtual, sair, observarSessao } from "../servicos/authServico.js";
import { mostrarErro, mensagemDoErro } from "./avisos.js";

// Links que todo mundo vê.
const LINKS_FIXOS = [
  { texto: "Início", arquivo: "index.html" },
  { texto: "Catálogo", arquivo: "catalogo.html" },
  { texto: "Sacola", arquivo: "sacola.html", comContador: true },
];

// Links que dependem de quem está logada.
// usuaria === undefined: ainda estamos descobrindo; null: visitante; objeto: Cliente ou Lojista.
function linksDaConta(usuaria) {
  if (usuaria === undefined) {
    return [];
  }
  if (usuaria === null) {
    return [
      { texto: "Entrar", arquivo: "login.html" },
      { texto: "Cadastrar", arquivo: "cadastro.html" },
    ];
  }
  // A lojista tem o painel; a cliente tem Meus pedidos
  return usuaria instanceof Lojista
    ? [{ texto: "Painel", arquivo: "painel-loja.html" }]
    : [{ texto: "Meus pedidos", arquivo: "meus-pedidos.html" }];
}

// Atualiza o número no cabeçalho; as outras partes do site chamam isto depois de mudar a sacola.
export function atualizarContadorSacola() {
  // Sacola.carregar() devolve uma sacola vazia se o localStorage estiver bloqueado ou estragado
  const total = Sacola.carregar().quantidadeTotal();
  const numero = document.getElementById("contador-sacola");
  const aviso = document.getElementById("contador-sacola-texto");

  if (!numero || !aviso) {
    return;
  }

  numero.textContent = String(total);
  numero.hidden = total === 0;
  aviso.hidden = total === 0;
}

function criarLink(link, arquivoAtual) {
  const item = document.createElement("li");
  const a = document.createElement("a");
  a.href = link.arquivo;
  a.append(link.texto);

  // Marca a página atual para o estilo e para leitores de tela
  if (link.arquivo === arquivoAtual) {
    a.setAttribute("aria-current", "page");
  }

  if (link.comContador) {
    const numero = document.createElement("span");
    numero.id = "contador-sacola";
    numero.className = "contador-sacola";
    numero.hidden = true;

    // Texto só para leitor de tela, para o número não ficar solto
    const texto = document.createElement("span");
    texto.id = "contador-sacola-texto";
    texto.className = "visualmente-oculto";
    texto.textContent = " itens na sacola";
    texto.hidden = true;

    a.append(numero, texto);
  }

  item.append(a);
  return item;
}

// Nome da usuária (link para Minha conta) e botão Sair: só aparecem para quem está logada.
function criarItensDaUsuaria(usuaria, arquivoAtual) {
  const itemNome = document.createElement("li");
  const nome = document.createElement("a");
  nome.className = "menu-nome";
  nome.href = "minha-conta.html";
  // textContent: o nome vem do banco, então nunca entra como HTML
  nome.textContent = "Olá, " + usuaria.nome;
  nome.title = "Minha conta";
  if (arquivoAtual === "minha-conta.html") {
    nome.setAttribute("aria-current", "page");
  }
  itemNome.append(nome);

  const itemSair = document.createElement("li");
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "menu-botao";
  botao.textContent = "Sair";
  botao.addEventListener("click", () => sairDaConta(botao));
  itemSair.append(botao);

  return [itemNome, itemSair];
}

async function sairDaConta(botao) {
  botao.disabled = true;
  try {
    await sair();
    location.assign("index.html");
  } catch (erro) {
    botao.disabled = false;
    mostrarErro(mensagemDoErro(erro));
  }
}

export async function montarCabecalho() {
  const cabecalho = document.getElementById("cabecalho");
  if (!cabecalho) {
    return;
  }

  // Descobre em qual arquivo estamos; o endereço "/" é o index.html
  const arquivoAtual = location.pathname.split("/").pop() || "index.html";

  const conteudo = document.createElement("div");
  conteudo.className = "container cabecalho-conteudo";

  const logotipo = document.createElement("a");
  logotipo.className = "logotipo";
  logotipo.href = "index.html";
  logotipo.textContent = "VitrineCol";

  const menu = document.createElement("ul");
  menu.className = "menu";

  const navegacao = document.createElement("nav");
  navegacao.setAttribute("aria-label", "Principal");
  navegacao.append(menu);

  conteudo.append(logotipo, navegacao);
  cabecalho.replaceChildren(conteudo);

  // Redesenha o menu para a usuária informada (undefined = ainda descobrindo, null = visitante)
  function desenharMenu(usuaria) {
    const itens = [...LINKS_FIXOS, ...linksDaConta(usuaria)].map((link) => criarLink(link, arquivoAtual));
    if (usuaria) {
      itens.push(...criarItensDaUsuaria(usuaria, arquivoAtual));
    }
    menu.replaceChildren(...itens);
    atualizarContadorSacola();

  }

  // Primeiro só os links fixos: assim a visitante não vê "Entrar" piscar quando já está logada
  desenharMenu(undefined);

  let usuaria = null;
  try {
    usuaria = await usuariaAtual();
  } catch (erro) {
    // Sem conseguir saber quem está logada, mostramos o menu de visitante; o detalhe vai para o console
    console.warn(erro.codigo, erro.cause ?? "");
  }
  desenharMenu(usuaria);

  // Se ela entrar ou sair (inclusive em outra aba), o menu acompanha
  observarSessao(desenharMenu);

  // Se a sacola mudar em outra aba, o contador acompanha
  window.addEventListener("storage", atualizarContadorSacola);
}