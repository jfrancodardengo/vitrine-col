// Página do catálogo: mostra os produtos e aplica os filtros. Por enquanto os produtos são fictícios (escritos neste arquivo).
import { montarCabecalho } from "../ui/cabecalho.js";
import { mostrarCarregando, mostrarErro, limparAvisos, mensagemDoErro, registrarErro } from "../ui/avisos.js";
import { criarCardProduto } from "../ui/cards.js";
import { ErroApp } from "../modelos/ErroApp.js";
import { Produto } from "../modelos/Produto.js";
import { Loja } from "../modelos/Loja.js";

const listaProdutos = document.getElementById("lista-produtos");
const mensagemVazio = document.getElementById("mensagem-vazio");
const campoBusca = document.getElementById("busca");
const selectLoja = document.getElementById("filtro-loja");
const selectTamanho = document.getElementById("filtro-tamanho");
const formularioFiltros = document.querySelector(".filtros");
const listaChips = document.getElementById("chips-categorias");

// As lojas (cada uma com os seus produtos) são criadas dentro de iniciar(), para um erro nos dados poder ser tratado
let lojas = [];

const categoriasFicticias = ["Blusas", "Camisetas", "Vestidos", "Calças", "Saias", "Shorts", "Jaquetas", "Acessórios"];

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

// Aplica os filtros atuais e redesenha a lista. Só os produtos ATIVOS de cada loja entram (RN-08)
function atualizarCatalogo() {
  const produtosAtivos = lojas.flatMap((loja) => loja.produtosAtivos());
  mostrarProdutos(filtrarProdutos(produtosAtivos, filtros));
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

// Lê os dois arquivos JSON ao mesmo tempo (Promise.all) e monta as lojas já com os seus produtos.
// fetch devolve uma promessa: o navegador não fica parado esperando, e o await só pausa ESTA função até a resposta chegar.
async function carregarLojasDoArquivo() {
  const [respostaLojas, respostaProdutos] = await Promise.all([
    fetch("dados-de-exemplo/lojas.json"),
    fetch("dados-de-exemplo/produtos.json"),
  ]);

  // fetch NÃO dá erro quando o arquivo não existe (404): é preciso conferir o .ok
  if (!respostaLojas.ok || !respostaProdutos.ok) {
    throw new ErroApp("arquivo_nao_encontrado", "Não foi possível carregar os dados de exemplo.");
  }

  const dadosDasLojas = await respostaLojas.json();
  const dadosDosProdutos = await respostaProdutos.json();

  const lojasCriadas = dadosDasLojas.map((dados) => new Loja(dados));
  dadosDosProdutos.forEach((dados) => {
    const loja = lojasCriadas.find((outra) => outra.id === dados.lojaId);
    loja.adicionarProduto(new Produto(dados));
  });

  return lojasCriadas;
}

async function iniciar() {
  montarCabecalho();
  mostrarCarregando();

  try {
    lojas = await carregarLojasDoArquivo();
    preencherCategorias(categoriasFicticias);
    preencherLojas(lojas);
    configurarFiltros();
    atualizarCatalogo();
    limparAvisos();
  } catch (erro) {
    // Um dado inválido (ErroApp), uma falha de conexão ou um erro inesperado: mensagem em português em vez de tela em branco (RF-21)
    registrarErro(erro);
    mostrarErro(mensagemDoErro(erro));
  }
}

iniciar();