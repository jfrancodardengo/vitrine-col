// Página do catálogo: mostra os produtos e aplica os filtros. Por enquanto os produtos são fictícios (escritos neste arquivo).
import { montarCabecalho } from "../ui/cabecalho.js";
import { mostrarCarregando, limparAvisos } from "../ui/avisos.js";
import { criarElemento } from "../ui/elementos.js";
import { formatarPreco } from "../ui/formatadores.js";

const produtosFicticios = [
  {
    id: "p1",
    nome: "Vestido midi floral",
    descricao: "Tecido leve, ideal para o verão",
    preco: 129.9,
    categoria: "Vestidos",
    lojaId: "l1",
    lojaNome: "Loja Exemplo",
    tamanhos: [
      { tamanho: "P", estoque: 3 },
      { tamanho: "M", estoque: 5 },
      { tamanho: "G", estoque: 0 },
    ],
    fotos: ["imagens/exemplo-1.svg"],
  },
  {
    id: "p2",
    nome: "Camiseta básica branca",
    descricao: "Algodão, corte reto",
    preco: 49.9,
    categoria: "Camisetas",
    lojaId: "l1",
    lojaNome: "Loja Exemplo",
    tamanhos: [
      { tamanho: "P", estoque: 10 },
      { tamanho: "M", estoque: 10 },
      { tamanho: "G", estoque: 6 },
    ],
    fotos: ["imagens/exemplo-2.svg"],
  },
  {
    id: "p3",
    nome: "Calça jeans reta",
    descricao: "Cintura alta, lavagem clara",
    preco: 159.9,
    categoria: "Calças",
    lojaId: "l2",
    lojaNome: "Loja do Bairro",
    tamanhos: [
      { tamanho: "38", estoque: 2 },
      { tamanho: "40", estoque: 4 },
      { tamanho: "42", estoque: 1 },
    ],
    fotos: ["imagens/exemplo-3.svg"],
  },
  {
    id: "p4",
    nome: "Blusa de alça",
    descricao: "Malha macia, ótima para o dia a dia",
    preco: 69.9,
    categoria: "Blusas",
    lojaId: "l2",
    lojaNome: "Loja do Bairro",
    tamanhos: [
      { tamanho: "P", estoque: 2 },
      { tamanho: "M", estoque: 0 },
      { tamanho: "G", estoque: 1 },
    ],
    fotos: ["imagens/exemplo-4.svg"],
  },
  {
    id: "p5",
    nome: "Saia plissada",
    descricao: "Comprimento midi, cintura com elástico",
    preco: 89.9,
    categoria: "Saias",
    lojaId: "l1",
    lojaNome: "Loja Exemplo",
    tamanhos: [
      { tamanho: "P", estoque: 4 },
      { tamanho: "M", estoque: 4 },
    ],
    fotos: ["imagens/exemplo-5.svg"],
  },
  {
    id: "p6",
    nome: "Jaqueta jeans",
    descricao: "Modelo curto, com bolsos frontais",
    preco: 219.9,
    categoria: "Jaquetas",
    lojaId: "l2",
    lojaNome: "Loja do Bairro",
    tamanhos: [
      { tamanho: "M", estoque: 1 },
      { tamanho: "G", estoque: 2 },
    ],
    fotos: ["imagens/exemplo-6.svg"],
  },
];

const listaProdutos = document.getElementById("lista-produtos");
const mensagemVazio = document.getElementById("mensagem-vazio");
const campoBusca = document.getElementById("busca");
const selectLoja = document.getElementById("filtro-loja");
const selectTamanho = document.getElementById("filtro-tamanho");
const formularioFiltros = document.querySelector(".filtros");
const listaChips = document.getElementById("chips-categorias");

// Dados fictícios das lojas e dos tipos de roupa (na Aula 29 eles passam a vir do banco)
const lojasFicticias = [
  { id: "l1", nome: "Loja Exemplo" },
  { id: "l2", nome: "Loja do Bairro" },
];
const categoriasFicticias = ["Blusas", "Camisetas", "Vestidos", "Calças", "Saias", "Shorts", "Jaquetas", "Acessórios"];

// Valor atual de cada filtro. Texto vazio ("") significa "sem filtro".
const filtros = {
  busca: "",
  categoria: "",
  lojaId: "",
  tamanho: "",
};

// RF-04: o tamanho só serve se existir E tiver estoque maior que zero
function temEstoque(produto, tamanho) {
  const item = produto.tamanhos.find((t) => t.tamanho === tamanho);
  return item !== undefined && item.estoque > 0;
}

// Devolve só os produtos que passam em TODOS os filtros que estão ligados (RF-02, RF-03, RF-04 e a busca pelo nome)
function filtrarProdutos(produtos, filtros) {
  return produtos.filter((produto) => {
    if (filtros.categoria && produto.categoria !== filtros.categoria) {
      return false;
    }
    if (filtros.lojaId && produto.lojaId !== filtros.lojaId) {
      return false;
    }
    if (filtros.tamanho && !temEstoque(produto, filtros.tamanho)) {
      return false;
    }
    // includes: o nome contém o texto digitado; toLowerCase ignora maiúsculas e minúsculas
    if (filtros.busca && !produto.nome.toLowerCase().includes(filtros.busca.trim().toLowerCase())) {
      return false;
    }
    return true;
  });
}

// Monta o card de UM produto só com o DOM (createElement + textContent), nunca com innerHTML (RNF-06).
// Devolve um <li> pronto para entrar na lista do catálogo.
function criarCardProduto(produto) {
  const item = document.createElement("li");
  const card = criarElemento("article", "card-produto");

  // Sem foto, usa a imagem padrão
  const imagem = criarElemento("img", "card-produto-imagem");
  imagem.src = produto.fotos[0] ?? "imagens/sem-foto.svg";
  imagem.alt = "Foto de " + produto.nome;
  imagem.width = 600;
  imagem.height = 750;
  imagem.loading = "lazy";

  const corpo = criarElemento("div", "card-produto-corpo");
  
  const titulo = criarElemento("h3", "card-produto-titulo");
  const link = criarElemento("a", "", produto.nome);
  link.href = "produto.html?id=" + encodeURIComponent(produto.id);
  titulo.append(link);
  
  const preco = criarElemento("p", "preco", formatarPreco(produto.preco));
  const loja = criarElemento("p", "card-produto-loja", produto.lojaNome);

  corpo.append(titulo, preco, loja);
  card.append(imagem, corpo);
  item.append(card);

  return item;
}

// Apaga os cards antigos e desenha os novos.
// Estado vazio: sem produto, aparece o aviso em vez de uma tela em branco.
function mostrarProdutos(produtos) {
  listaProdutos.replaceChildren(...produtos.map(criarCardProduto));
  mensagemVazio.hidden = produtos.length > 0;
}

// Aplica os filtros atuais e redesenha a lista
function atualizarCatalogo() {
  mostrarProdutos(filtrarProdutos(produtosFicticios, filtros));
}

// Cria um chip para cada tipo de roupa, depois do chip "Todas" (que já está no HTML)
function preencherCategorias(categorias) {
  categorias.forEach((categoria) => {
    const item = document.createElement("li");
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.setAttribute("aria-pressed", "false");
    chip.textContent = categoria;
    chip.addEventListener("click", () => escolherCategoria(chip, categoria));

    item.append(chip);
    listaChips.append(item);
  });
}

// Cria uma opção para cada loja
function preencherLojas(lojas) {
  lojas.forEach((loja) => {
    const opcao = document.createElement("option");
    opcao.value = loja.id;
    opcao.textContent = loja.nome;
    selectLoja.append(opcao);
  });
}

function escolherCategoria(chipEscolhido, categoria) {
  // Só o chip escolhido fica "pressionado"; "Todas" limpa o filtro (RF-02)
  listaChips.querySelectorAll(".chip").forEach((chip) => {
    chip.setAttribute("aria-pressed", String(chip === chipEscolhido));
  });

  filtros.categoria = categoria;
  atualizarCatalogo();
}

function configurarFiltros() {
  // O chip "Todas" já está no HTML; os outros foram criados por preencherCategorias()
  const chipTodas = listaChips.querySelector(".chip");
  chipTodas.addEventListener("click", () => escolherCategoria(chipTodas, ""));

  campoBusca.addEventListener("input", () => {
    filtros.busca = campoBusca.value;
    atualizarCatalogo();
  });

  selectLoja.addEventListener("change", () => {
    filtros.lojaId = selectLoja.value;
    atualizarCatalogo();
  });

  selectTamanho.addEventListener("change", () => {
    filtros.tamanho = selectTamanho.value;
    atualizarCatalogo();
  });

  // Apertar Enter na busca enviaria o formulário e recarregaria a página; aqui isso não é preciso
  formularioFiltros.addEventListener("submit", (evento) => evento.preventDefault());
}

function iniciar() {
  montarCabecalho();
  mostrarCarregando();

  // O setTimeout finge a espera pelos dados; na Aula 28 ela vira uma espera de verdade
  setTimeout(() => {
    preencherCategorias(categoriasFicticias);
    preencherLojas(lojasFicticias);
    configurarFiltros();
    atualizarCatalogo();
    limparAvisos();
  }, 600);
}

iniciar();