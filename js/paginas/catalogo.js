// Página do catálogo: mostra os produtos e aplica os filtros. Por enquanto os produtos são fictícios (escritos neste arquivo).
import { montarCabecalho } from "../ui/cabecalho.js";
import { mostrarCarregando, mostrarErro, limparAvisos, mensagemDoErro, registrarErro } from "../ui/avisos.js";
import { criarCardProduto } from "../ui/cards.js";
import { Produto } from "../modelos/Produto.js";
import { listarProdutosAtivos } from "../servicos/produtoServico.js";
import { listarLojas } from "../servicos/lojaServico.js";
import { listarCategorias } from "../servicos/categoriaServico.js";

const listaProdutos = document.getElementById("lista-produtos");
const mensagemVazio = document.getElementById("mensagem-vazio");
const campoBusca = document.getElementById("busca");
const selectLoja = document.getElementById("filtro-loja");
const selectTamanho = document.getElementById("filtro-tamanho");
const formularioFiltros = document.querySelector(".filtros");
const listaChips = document.getElementById("chips-categorias");

// Os produtos que vieram do banco, já como objetos Produto
let produtos = [];

// Valor atual de cada filtro. Texto vazio ("") significa "sem filtro".
const filtros = {
  busca: "",
  categoria: "",
  lojaId: "",
  tamanho: "",
};

// Devolve só os produtos que passam em TODOS os filtros que estão ligados (RF-02, RF-03, RF-04 e a busca pelo nome)
function filtrarProdutos(produtos, filtros) {
  return produtos.filter((produto) => {
    if (filtros.categoria && produto.categoria !== filtros.categoria) {
      return false;
    }
    if (filtros.lojaId && produto.lojaId !== filtros.lojaId) {
      return false;
    }
    if (filtros.tamanho && !produto.temEstoque(filtros.tamanho)) {
      return false;
    }
    // includes: o nome contém o texto digitado; toLowerCase ignora maiúsculas e minúsculas
    if (filtros.busca && !produto.nome.toLowerCase().includes(filtros.busca.trim().toLowerCase())) {
      return false;
    }
    return true;
  });
}

// Apaga os cards antigos e desenha os novos.
// Estado vazio: sem produto, aparece o aviso em vez de uma tela em branco.
function mostrarProdutos(produtos) {
  listaProdutos.replaceChildren(...produtos.map(criarCardProduto));
  mensagemVazio.hidden = produtos.length > 0;
}

// Aplica os filtros atuais e redesenha a lista (a consulta ao banco já traz só os produtos ativos, RN-08)
function atualizarCatalogo() {
  mostrarProdutos(filtrarProdutos(produtos, filtros));
}

// Cria um chip para cada tipo de roupa, depois do chip "Todas" (que já está no HTML)
function preencherCategorias(categorias) {
  categorias.forEach((categoria) => {
    const item = document.createElement("li");
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.setAttribute("aria-pressed", "false");
    chip.textContent = categoria.nome;
    chip.addEventListener("click", () => escolherCategoria(chip, categoria.nome));

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

async function iniciar() {
  montarCabecalho();
  mostrarCarregando();

  try {
    // As três consultas não dependem uma da outra, então rodam ao mesmo tempo
    const [categorias, lojas, linhas] = await Promise.all([listarCategorias(), listarLojas(), listarProdutosAtivos()]);

    produtos = linhas.map(Produto.deLinha);
    preencherCategorias(categorias);
    preencherLojas(lojas);
    configurarFiltros();
    atualizarCatalogo();
    limparAvisos();
  } catch (erro) {
    // Falha de conexão, configuração de exemplo ou erro inesperado: mensagem em português em vez de tela em branco (RF-21)
    registrarErro(erro);
    mostrarErro(mensagemDoErro(erro));
  }
}

iniciar();