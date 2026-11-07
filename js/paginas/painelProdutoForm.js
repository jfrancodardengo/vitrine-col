// Painel da lojista: cadastrar produto, com tamanhos.
// A página só valida, chama os serviços e mostra o resultado.
import { montarCabecalho } from "../ui/cabecalho.js";
import { mostrarCarregando, mostrarErro, limparAvisos, mensagemDoErro, mostrarErroDoCampo, limparErroDoCampo, limparErrosDosCampos } from "../ui/avisos.js";
import { obterMinhaLoja } from "../servicos/lojaServico.js";
import { listarCategorias } from "../servicos/categoriaServico.js";
import { criarProduto, validarProduto } from "../servicos/produtoServico.js";

// O id do produto nasce AQUI, no navegador, antes de qualquer envio: assim o mesmo id vale para o produto e, depois, para as fotos.
const produtoId = crypto.randomUUID();

const avisoSemLoja = document.getElementById("aviso-sem-loja");
const formulario = document.getElementById("formulario-produto");
const botaoSalvar = formulario.querySelector('button[type="submit"]');
const textoOriginalDoBotao = botaoSalvar.textContent;

const campoNome = document.getElementById("nome-produto");
const campoDescricao = document.getElementById("descricao-produto");
const campoCategoria = document.getElementById("categoria-produto");
const campoPreco = document.getElementById("preco-produto");
const campoAtivo = document.getElementById("ativo-produto");
const blocoDeLinhas = document.getElementById("linhas-tamanhos");
const botaoAdicionarTamanho = document.getElementById("adicionar-tamanho");

let loja = null;
let enviando = false;
let contadorDeLinhas = 0; // só serve para dar um id único a cada campo criado

// ---------- Linhas de tamanho (a lojista adiciona e remove) ----------

function criarCampoDaLinha(idDoCampo, rotulo, tipo) {
  const campo = document.createElement("div");
  campo.className = "campo";

  const label = document.createElement("label");
  label.htmlFor = idDoCampo;
  label.textContent = rotulo;

  const entrada = document.createElement("input");
  entrada.id = idDoCampo;
  entrada.type = tipo;
  entrada.required = true;

  campo.append(label, entrada);
  return { campo, entrada };
}

// As linhas são numeradas pela posição atual ("linha 1", "linha 2"): isso muda quando uma linha é removida
function renumerarLinhas() {
  [...blocoDeLinhas.children].forEach((linha, indice) => {
    linha.setAttribute("aria-label", "Tamanho e estoque, linha " + (indice + 1));
  });
}

function adicionarLinhaDeTamanho(tamanho = "", estoque = "0") {
  contadorDeLinhas += 1;

  const linha = document.createElement("div");
  linha.className = "linha-tamanho";
  linha.setAttribute("role", "group");

  const { campo: campoTamanho, entrada: entradaTamanho } = criarCampoDaLinha("tamanho-" + contadorDeLinhas, "Tamanho", "text");
  entradaTamanho.setAttribute("list", "sugestoes-tamanhos");
  entradaTamanho.value = tamanho;

  const { campo: campoEstoque, entrada: entradaEstoque } = criarCampoDaLinha("estoque-" + contadorDeLinhas, "Estoque", "number");
  entradaEstoque.min = "0";
  entradaEstoque.step = "1";
  entradaEstoque.value = estoque;

  const botaoRemover = document.createElement("button");
  botaoRemover.type = "button";
  botaoRemover.className = "botao botao-perigo botao-pequeno";
  botaoRemover.append("Remover tamanho");
  const nomeOculto = document.createElement("span");
  nomeOculto.className = "visualmente-oculto";
  botaoRemover.append(nomeOculto);

  // O texto escondido diz qual tamanho será removido, e acompanha o que a lojista digita
  const atualizarNomeOculto = () => {
    nomeOculto.textContent = " (" + (entradaTamanho.value.trim() || "sem nome") + ")";
  };
  entradaTamanho.addEventListener("input", atualizarNomeOculto);
  atualizarNomeOculto();

  botaoRemover.addEventListener("click", () => removerLinhaDeTamanho(linha));

  linha.append(campoTamanho, campoEstoque, botaoRemover);
  blocoDeLinhas.append(linha);
  renumerarLinhas();
  return entradaTamanho;
}

function removerLinhaDeTamanho(linha) {
  const proxima = linha.nextElementSibling ?? linha.previousElementSibling;
  linha.remove();
  renumerarLinhas();
  // O foco não pode se perder: vai para a linha vizinha, ou para "Adicionar tamanho" se não sobrou nenhuma
  (proxima?.querySelector("button") ?? botaoAdicionarTamanho).focus();
}

function lerTamanhos() {
  return [...blocoDeLinhas.children].map((linha) => {
    const [entradaTamanho, entradaEstoque] = linha.querySelectorAll("input");
    return { tamanho: entradaTamanho.value, estoque: entradaEstoque.value };
  });
}

// ---------- Ler e validar o formulário ----------

function lerDados() {
  return {
    id: produtoId,
    lojaId: loja.id,
    nome: campoNome.value,
    descricao: campoDescricao.value,
    categoriaId: campoCategoria.value,
    preco: campoPreco.value,
    ativo: campoAtivo.checked,
    tamanhos: lerTamanhos(),
    fotos: [],
  };
}

// Descobre qual campo da tela corresponde a cada chave de erro do validarProduto
function acharCampoDoErro(chave) {
  const campos = {
    nome: campoNome,
    categoriaId: campoCategoria,
    preco: campoPreco,
    tamanhos: botaoAdicionarTamanho,
  };
  if (campos[chave]) {
    return campos[chave];
  }

  // "tamanho-2" e "estoque-2" são os campos da linha de posição 2 (a contagem começa em 0)
  const partes = chave.match(/^(tamanho|estoque)-(\d+)$/);
  if (partes) {
    const linha = blocoDeLinhas.children[Number(partes[2])];
    return linha?.querySelector('input[id^="' + partes[1] + '-"]');
  }
  return null;
}

function mostrarErrosDoFormulario(erros) {
  const comErro = [];

  for (const [chave, mensagem] of Object.entries(erros)) {
    const campo = acharCampoDoErro(chave);
    if (campo) {
      mostrarErroDoCampo(campo, mensagem);
      comErro.push(campo);
    }
  }

  // O foco vai para o primeiro campo com erro na ordem da tela, não na ordem em que o erro foi encontrado
  comErro.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  comErro[0]?.focus();
}

botaoAdicionarTamanho.addEventListener("click", () => {
  limparErroDoCampo(botaoAdicionarTamanho);
  adicionarLinhaDeTamanho().focus();
});

// ---------- Salvar ----------

formulario.addEventListener("submit", async (evento) => {
  // Sem isto o navegador recarregaria a página; e "enviando" evita dois envios com cliques seguidos
  evento.preventDefault();
  if (enviando) {
    return;
  }

  limparErrosDosCampos(formulario);
  limparAvisos();

  const dados = lerDados();
  const erros = validarProduto(dados);
  if (Object.keys(erros).length > 0) {
    mostrarErrosDoFormulario(erros);
    return;
  }

  enviando = true;
  botaoSalvar.disabled = true;
  botaoSalvar.textContent = "Salvando…";
  mostrarCarregando("Salvando o produto…");

  try {
    await criarProduto(dados);
    // A lista de produtos mostra a mensagem de sucesso
    location.assign("painel-produtos.html?salvo=criado");
  } catch (erro) {
    limparAvisos();
    mostrarErro(mensagemDoErro(erro));

    enviando = false;
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = textoOriginalDoBotao;
  }
});

// ---------- Abrir a tela ----------

function preencherCategorias(categorias) {
  categorias.forEach((categoria) => {
    const opcao = document.createElement("option");
    opcao.value = categoria.id;
    opcao.textContent = categoria.nome;
    campoCategoria.append(opcao);
  });
}

async function iniciar() {
  montarCabecalho();
  mostrarCarregando();
  try {
    loja = await obterMinhaLoja();
    if (!loja) {
      limparAvisos();
      avisoSemLoja.hidden = false;
      return;
    }

    preencherCategorias(await listarCategorias());

    adicionarLinhaDeTamanho();

    formulario.hidden = false;
    limparAvisos();
  } catch (erro) {
    mostrarErro(mensagemDoErro(erro));
  }
}

iniciar();