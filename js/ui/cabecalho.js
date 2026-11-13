// Gera o cabeçalho comum das páginas e mantém o contador de itens da sacola.
// Cada página tem um <header id="cabecalho"> vazio, que este arquivo preenche.
// O menu muda conforme quem está logada: visitante, cliente ou lojista.
import { Sacola } from "../modelos/Sacola.js";
import { Lojista } from "../modelos/Lojista.js";
import { Cliente } from "../modelos/Cliente.js";
import { usuariaAtual, sair, observarSessao } from "../servicos/authServico.js";
import { contarNovidades } from "../servicos/pedidoServico.js";
import { mostrarErro, mensagemDoErro } from "./avisos.js";

// De quanto em quanto tempo o contador de novidades dos pedidos é consultado de novo (RF-22)
export const INTERVALO_DAS_NOVIDADES_EM_MS = 60000;
let temporizadorDasNovidades = null;

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
    : [{ texto: "Meus pedidos", arquivo: "meus-pedidos.html", comNovidades: true }];
}

// Atualiza o contador de pedidos com novidades (RF-22) no link "Meus pedidos".
// Se a consulta falhar, o contador fica como estava: um aviso secundário nunca pode derrubar a página.
export async function atualizarContadorDeNovidades() {
  const numero = document.getElementById("contador-novidades");
  const texto = document.getElementById("contador-novidades-texto");
  if (!numero || !texto) {
    return;
  }

  let total;
  try {
    total = await contarNovidades();
  } catch (erro) {
    console.warn(erro.codigo, erro.cause ?? "");
    return;
  }

  numero.textContent = String(total);
  // O número visível some para o leitor de tela (aria-hidden no HTML criado abaixo); o texto escondido diz a frase completa
  texto.textContent = " " + total + (total === 1 ? " pedido com novidades" : " pedidos com novidades");
  numero.hidden = total === 0;
  texto.hidden = total === 0;
}

function pararDeVerNovidades() {
  clearInterval(temporizadorDasNovidades);
  temporizadorDasNovidades = null;
}

// Só a cliente tem novidades nos pedidos: consulta agora e depois de tempos em tempos
function comecarAVerNovidades() {
  pararDeVerNovidades();
  atualizarContadorDeNovidades();
  temporizadorDasNovidades = setInterval(atualizarContadorDeNovidades, INTERVALO_DAS_NOVIDADES_EM_MS);
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

  if (link.comNovidades) {
    // Número visível (escondido do leitor de tela) + frase completa só para o leitor de tela: "2 pedidos com novidades"
    const numero = document.createElement("span");
    numero.id = "contador-novidades";
    numero.className = "contador-sacola";
    numero.setAttribute("aria-hidden", "true");
    numero.hidden = true;

    const texto = document.createElement("span");
    texto.id = "contador-novidades-texto";
    texto.className = "visualmente-oculto";
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

    // Só a cliente tem o contador de novidades dos pedidos; para as outras, para de consultar
    if (usuaria instanceof Cliente) {
      comecarAVerNovidades();
    } else {
      pararDeVerNovidades();
    }
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