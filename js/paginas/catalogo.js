// Página do catálogo (catalogo.html): mostra os produtos do banco, por páginas, e aplica os filtros (RF-01 a RF-05).
// A página inicial e a página da loja podem abrir o catálogo já filtrado: catalogo.html?categoria=3&loja=...&busca=...
// A página só chama os serviços e mostra o resultado e os avisos; quem fala com o Supabase são os serviços.
import { montarCabecalho } from "../ui/cabecalho.js";
import { mostrarCarregando, mostrarErro, limparAvisos, mensagemDoErro, registrarErro } from "../ui/avisos.js";
import { criarCardProduto } from "../ui/cards.js";
import { Produto } from "../modelos/Produto.js";
import { listarPaginaDeProdutos } from "../servicos/produtoServico.js";
import { listarLojas } from "../servicos/lojaServico.js";
import { listarCategorias } from "../servicos/categoriaServico.js";

// Valor atual de cada filtro. Texto vazio ("") significa "sem filtro".
const filtros = {
  busca: "",
  categoriaId: "",
  lojaId: "",
  tamanho: "",
};

// O catálogo mostra os produtos por páginas; "Carregar mais" busca a próxima (começa em 0).
const PRODUTOS_POR_PAGINA = 12;
let paginaAtual = 0;
let carregandoMais = false;

// Cada atualização do catálogo recebe um número. Se o filtro mudar de novo antes da resposta chegar,
// a resposta velha é ignorada; senão ela poderia aparecer por cima da mais nova.
let numeroDaAtualizacao = 0;

// Espera a pessoa parar de digitar antes de buscar, para não fazer uma consulta por letra.
let temporizadorDaBusca = null;
const ESPERA_DA_BUSCA_EM_MS = 300;

const listaProdutos = document.getElementById("lista-produtos");
const mensagemVazio = document.getElementById("mensagem-vazio");
const botaoCarregarMais = document.getElementById("carregar-mais");
const campoBusca = document.getElementById("busca");
const selectLoja = document.getElementById("filtro-loja");
const selectTamanho = document.getElementById("filtro-tamanho");
const formularioFiltros = document.querySelector(".filtros");
const listaChips = document.getElementById("chips-categorias");

// ---------- Conversão e tela ----------

// Apaga os cards antigos e desenha os novos.
function mostrarProdutos(produtos) {
  listaProdutos.replaceChildren(...produtos.map(criarCardProduto));

  // Estado vazio: sem resultado, aparece o aviso em vez de uma tela em branco
  mensagemVazio.hidden = produtos.length > 0;
}

// "Carregar mais" acrescenta os cards da próxima página no fim da lista, sem apagar os que já estão lá.
function acrescentarProdutos(produtos) {
  listaProdutos.append(...produtos.map(criarCardProduto));
}

// Busca no banco com os filtros atuais e redesenha a lista (RF-21: Carregando… e mensagem de erro).
async function atualizarCatalogo() {
  numeroDaAtualizacao += 1;
  const meuNumero = numeroDaAtualizacao;
  paginaAtual = 0;
  botaoCarregarMais.hidden = true;

  mostrarCarregando();

  try {
    const { linhas, temMais } = await listarPaginaDeProdutos({ ...filtros, pagina: 0, porPagina: PRODUTOS_POR_PAGINA });
    const produtos = linhas.map(Produto.deLinha);

    if (meuNumero !== numeroDaAtualizacao) {
      return; // chegou uma resposta de uma busca antiga: descarta
    }
    mostrarProdutos(produtos);
    botaoCarregarMais.hidden = !temMais;
    limparAvisos();
  } catch (erro) {
    if (meuNumero !== numeroDaAtualizacao) {
      return;
    }
    registrarErro(erro);
    // Na falha, a lista antiga sai da tela para não parecer que ela ainda vale para o filtro atual
    listaProdutos.replaceChildren();
    mensagemVazio.hidden = true;
    mostrarErro(mensagemDoErro(erro));
  }
}

// Busca a próxima página com os mesmos filtros e acrescenta os produtos (RF-01).
async function carregarMais() {
  // O botão escondido quer dizer "não há próxima página": nenhuma consulta a mais
  if (carregandoMais || botaoCarregarMais.hidden) {
    return;
  }
  carregandoMais = true;
  botaoCarregarMais.disabled = true;
  const meuNumero = numeroDaAtualizacao;

  mostrarCarregando();

  try {
    const { linhas, temMais } = await listarPaginaDeProdutos({
      ...filtros,
      pagina: paginaAtual + 1,
      porPagina: PRODUTOS_POR_PAGINA,
    });

    if (meuNumero !== numeroDaAtualizacao) {
      return; // os filtros mudaram enquanto a página vinha: ela não vale mais
    }
    paginaAtual += 1;
    acrescentarProdutos(linhas.map(Produto.deLinha));
    botaoCarregarMais.hidden = !temMais;
    limparAvisos();
  } catch (erro) {
    if (meuNumero === numeroDaAtualizacao) {
      registrarErro(erro);
      // A lista que já estava na tela continua valendo; a pessoa pode tentar de novo
      mostrarErro(mensagemDoErro(erro));
    }
  } finally {
    carregandoMais = false;
    botaoCarregarMais.disabled = false;
  }
}

// ---------- Filtros ----------

// Cria um chip de categoria para cada categoria do banco, depois do chip "Todas".
function preencherCategorias(categorias) {
  categorias.forEach((categoria) => {
    const item = document.createElement("li");
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.setAttribute("aria-pressed", "false");
    chip.textContent = categoria.nome;
    chip.dataset.categoriaId = String(categoria.id);
    chip.addEventListener("click", () => escolherCategoria(chip, categoria.id));

    item.append(chip);
    listaChips.append(item);
  });
}

// Cria uma opção para cada loja do banco.
function preencherLojas(lojas) {
  lojas.forEach((loja) => {
    const opcao = document.createElement("option");
    opcao.value = loja.id;
    opcao.textContent = loja.nome;
    selectLoja.append(opcao);
  });
}

function escolherCategoria(chipEscolhido, categoriaId) {
  // Só o chip escolhido fica "pressionado"; "Todas" limpa o filtro (RF-02)
  listaChips.querySelectorAll(".chip").forEach((chip) => {
    chip.setAttribute("aria-pressed", String(chip === chipEscolhido));
  });

  filtros.categoriaId = categoriaId;
  atualizarCatalogo();
}

function configurarFiltros() {
  // O chip "Todas" já está no HTML; os outros chips são criados por preencherCategorias()
  const chipTodas = listaChips.querySelector(".chip");
  chipTodas.addEventListener("click", () => escolherCategoria(chipTodas, ""));

  campoBusca.addEventListener("input", () => {
    clearTimeout(temporizadorDaBusca);
    temporizadorDaBusca = setTimeout(() => {
      filtros.busca = campoBusca.value;
      atualizarCatalogo();
    }, ESPERA_DA_BUSCA_EM_MS);
  });

  selectLoja.addEventListener("change", () => {
    filtros.lojaId = selectLoja.value;
    atualizarCatalogo();
  });

  selectTamanho.addEventListener("change", () => {
    filtros.tamanho = selectTamanho.value;
    atualizarCatalogo();
  });

  botaoCarregarMais.addEventListener("click", carregarMais);

  // Apertar Enter na busca enviaria o formulário e recarregaria a página; aqui isso não é preciso
  formularioFiltros.addEventListener("submit", (evento) => evento.preventDefault());
}

// Lê os filtros que vieram no endereço (por exemplo, de um clique na página inicial) e marca os campos.
// Valores que não existem no banco (um id inventado na mão) são ignorados.
function aplicarFiltrosDoEndereco() {
  const parametros = new URLSearchParams(location.search);

  const busca = (parametros.get("busca") ?? "").trim();
  if (busca) {
    filtros.busca = busca;
    campoBusca.value = busca;
  }

  const lojaId = parametros.get("loja") ?? "";
  if ([...selectLoja.options].some((opcao) => opcao.value === lojaId && lojaId !== "")) {
    filtros.lojaId = lojaId;
    selectLoja.value = lojaId;
  }

  const tamanho = parametros.get("tamanho") ?? "";
  if ([...selectTamanho.options].some((opcao) => opcao.value === tamanho && tamanho !== "")) {
    filtros.tamanho = tamanho;
    selectTamanho.value = tamanho;
  }

  const chipDaCategoria = [...listaChips.querySelectorAll(".chip")].find(
    (chip) => chip.dataset.categoriaId !== undefined && chip.dataset.categoriaId === parametros.get("categoria")
  );
  if (chipDaCategoria) {
    filtros.categoriaId = chipDaCategoria.dataset.categoriaId;
    listaChips.querySelectorAll(".chip").forEach((chip) => {
      chip.setAttribute("aria-pressed", String(chip === chipDaCategoria));
    });
  }
}

async function iniciar() {
  montarCabecalho();
  mostrarCarregando();

  try {
    // As duas consultas não dependem uma da outra, então rodam ao mesmo tempo
    const [categorias, lojas] = await Promise.all([listarCategorias(), listarLojas()]);

    preencherCategorias(categorias);
    preencherLojas(lojas);
    configurarFiltros();
    aplicarFiltrosDoEndereco();
  } catch (erro) {
    registrarErro(erro);
    mostrarErro(mensagemDoErro(erro));
    return;
  }

  await atualizarCatalogo();
}

iniciar();