// Gera o cabeçalho comum das páginas.
// Cada página tem um <header id="cabecalho"> vazio, que este arquivo preenche.

// Links que todo mundo vê.
const LINKS_FIXOS = [
  { texto: "Início", arquivo: "index.html" },
  { texto: "Catálogo", arquivo: "catalogo.html" },
  { texto: "Sacola", arquivo: "sacola.html" },
];

// Links da conta. Por enquanto toda pessoa é visitante, porque o login só chega no Dia 13.
function linksDaConta() {
  return [
    { texto: "Entrar", arquivo: "login.html" },
    { texto: "Cadastrar", arquivo: "cadastro.html" },
  ];
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
}