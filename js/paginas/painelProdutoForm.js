// Painel da lojista: formulário de produto. Nesta etapa (Aula 21) ele só valida e mostra os erros ao lado de cada campo.
import { montarCabecalho } from "../ui/cabecalho.js";
import { mostrarSucesso, limparAvisos, mostrarErroDoCampo, limparErrosDosCampos } from "../ui/avisos.js";
import { validarProduto } from "../servicos/produtoServico.js";

const formulario = document.getElementById("formulario-produto");

const campoNome = document.getElementById("nome-produto");
const campoDescricao = document.getElementById("descricao-produto");
const campoCategoria = document.getElementById("categoria-produto");
const campoPreco = document.getElementById("preco-produto");
const campoAtivo = document.getElementById("ativo-produto");
const blocoDeLinhas = document.getElementById("linhas-tamanhos");
const botaoAdicionarTamanho = document.getElementById("adicionar-tamanho");

// Categorias fictícias (na Aula 29 elas passam a vir do banco)
const categoriasFicticias = [
  { id: 1, nome: "Blusas" },
  { id: 2, nome: "Camisetas" },
  { id: 3, nome: "Vestidos" },
  { id: 4, nome: "Calças" },
  { id: 5, nome: "Saias" },
  { id: 6, nome: "Shorts" },
  { id: 7, nome: "Jaquetas" },
  { id: 8, nome: "Acessórios" },
];

function lerTamanhos() {
  return [...blocoDeLinhas.children].map((linha) => {
    const [entradaTamanho, entradaEstoque] = linha.querySelectorAll("input");
    return { tamanho: entradaTamanho.value, estoque: entradaEstoque.value };
  });
}

function lerDados() {
  return {
    nome: campoNome.value,
    descricao: campoDescricao.value,
    categoriaId: campoCategoria.value,
    preco: campoPreco.value,
    ativo: campoAtivo.checked,
    tamanhos: lerTamanhos(),
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

formulario.addEventListener("submit", (evento) => {
  // Sem isto o navegador recarregaria a página
  evento.preventDefault();

  limparErrosDosCampos(formulario);
  limparAvisos();

  const dados = lerDados();
  const erros = validarProduto(dados);
  if (Object.keys(erros).length > 0) {
    mostrarErrosDoFormulario(erros);
    return;
  }

  mostrarSucesso("Tudo certo! Isto é só uma simulação: o produto ainda não é salvo (isso começa na Aula 31).");
});

function preencherCategorias(categorias) {
  categorias.forEach((categoria) => {
    const opcao = document.createElement("option");
    opcao.value = categoria.id;
    opcao.textContent = categoria.nome;
    campoCategoria.append(opcao);
  });
}

montarCabecalho();
preencherCategorias(categoriasFicticias);