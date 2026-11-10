// Gera o cabeçalho comum das páginas.
// Cada página tem um <header id="cabecalho"> vazio, que este arquivo preenche.
import { Sacola } from "../modelos/Sacola.js";

// Links que todo mundo vê.
const LINKS_FIXOS = [
  { texto: "Início", arquivo: "index.html" },
  { texto: "Catálogo", arquivo: "catalogo.html" },
  { texto: "Sacola", arquivo: "sacola.html", comContador: true },
];

// Links da conta. Por enquanto toda pessoa é visitante, porque o login só chega no Dia 13.
function linksDaConta() {
  return [
    { texto: "Entrar", arquivo: "login.html" },
    { texto: "Cadastrar", arquivo: "cadastro.html" },
  ];
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

export function montarCabecalho() {
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
  const itens = [...LINKS_FIXOS, ...linksDaConta()].map((link) => criarLink(link, arquivoAtual));
  menu.replaceChildren(...itens);

  const navegacao = document.createElement("nav");
  navegacao.setAttribute("aria-label", "Principal");
  navegacao.append(menu);

  conteudo.append(logotipo, navegacao);
  cabecalho.replaceChildren(conteudo);

  atualizarContadorSacola();

  // Se a sacola mudar em outra aba, o contador acompanha
  window.addEventListener("storage", atualizarContadorSacola);
}