// Painel da lojista: Meus produtos (RF-16, RF-18). Só a lojista abre esta tela (RF-14).
// Lista os produtos da loja (inclusive os inativos), com Editar, Ativar/Desativar e Excluir.
import { montarCabecalho } from "../ui/cabecalho.js";
import { mostrarCarregando, mostrarErro, mostrarSucesso, limparAvisos, mensagemDoErro } from "../ui/avisos.js";
import { exigirPerfil } from "../ui/protecao.js";
import { formatarPreco } from "../ui/formatadores.js";
import { obterMinhaLoja } from "../servicos/lojaServico.js";
import { listarProdutosDaLoja, definirAtivo, excluirProduto } from "../servicos/produtoServico.js";

// O painel-produto-form.html volta para cá com ?salvo=criado ou ?salvo=editado.
// Um Map (e não um objeto) para o valor vindo do endereço nunca ser confundido com uma propriedade do objeto.
const MENSAGENS_DE_SALVO = new Map([
  ["criado", "Produto cadastrado com sucesso."],
  ["editado", "Produto atualizado com sucesso."],
]);

const avisoSemLoja = document.getElementById("aviso-sem-loja");
const blocoDeAcoes = document.getElementById("acoes-produtos");
const mensagemSemProdutos = document.getElementById("mensagem-sem-produtos");
const tabela = document.getElementById("tabela-produtos");
const corpoDaTabela = document.getElementById("lista-produtos-painel");

let loja = null;

// ---------- Tela ----------

function criarCelula(rotulo, conteudo) {
  const celula = document.createElement("td");
  celula.dataset.rotulo = rotulo; // o CSS usa este rótulo quando a tabela vira blocos no celular
  celula.setAttribute("role", "cell"); // o CSS tira a semântica de tabela no celular; o papel explícito a devolve
  celula.append(conteudo); // texto vira nó de texto (nunca HTML)
  return celula;
}

// Texto só para leitor de tela, para cada botão dizer de qual produto é: "Editar (Vestido midi floral)"
function criarTextoOculto(nomeDoProduto) {
  const oculto = document.createElement("span");
  oculto.className = "visualmente-oculto";
  oculto.textContent = " (" + nomeDoProduto + ")";
  return oculto;
}

function criarBotao(texto, classe, produto, aoClicar) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "botao botao-pequeno " + classe;
  botao.append(texto, criarTextoOculto(produto.nome));
  botao.addEventListener("click", () => aoClicar(produto, botao));
  return botao;
}

function criarAcoes(produto) {
  const acoes = document.createElement("div");
  acoes.className = "tabela-acoes";

  const editar = document.createElement("a");
  editar.className = "botao botao-secundario botao-pequeno";
  editar.href = "painel-produto-form.html?id=" + encodeURIComponent(produto.id);
  editar.append("Editar", criarTextoOculto(produto.nome));

  acoes.append(
    editar,
    criarBotao(produto.ativo ? "Desativar" : "Ativar", "botao-secundario", produto, alternarAtivo),
    criarBotao("Excluir", "botao-perigo", produto, excluir)
  );
  return acoes;
}

function criarLinha(produto) {
  const selo = document.createElement("span");
  selo.className = "selo " + (produto.ativo ? "selo-confirmado" : "selo-concluido");
  selo.textContent = produto.ativo ? "Ativo" : "Inativo";

  const linha = document.createElement("tr");
  linha.setAttribute("role", "row");
  linha.append(
    criarCelula("Produto", produto.nome),
    criarCelula("Categoria", produto.categorias?.nome ?? ""),
    criarCelula("Preço", formatarPreco(produto.preco)),
    criarCelula("Situação", selo),
    criarCelula("Ações", criarAcoes(produto))
  );
  return linha;
}

function desenharProdutos(produtos) {
  corpoDaTabela.replaceChildren(...produtos.map(criarLinha));

  // Estado vazio: sem produtos, aparece uma mensagem em vez de uma tabela vazia
  tabela.hidden = produtos.length === 0;
  mensagemSemProdutos.hidden = produtos.length > 0;
}

// ---------- Ações ----------

// Busca a lista no banco e redesenha (RF-21: Carregando… e mensagem de erro).
// Se houver "mensagemDeSucesso", ela aparece depois que a lista chegar.
async function carregarProdutos(mensagemDeSucesso) {
  mostrarCarregando();
  try {
    desenharProdutos(await listarProdutosDaLoja(loja.id));
    if (mensagemDeSucesso) {
      mostrarSucesso(mensagemDeSucesso);
    } else {
      limparAvisos();
    }
  } catch (erro) {
    mostrarErro(mensagemDoErro(erro));
  }
}

async function alternarAtivo(produto, botao) {
  botao.disabled = true;
  mostrarCarregando();
  try {
    await definirAtivo(produto.id, !produto.ativo);
    await carregarProdutos(produto.ativo ? "Produto desativado: ele não aparece mais no catálogo." : "Produto ativado: ele voltou ao catálogo.");
  } catch (erro) {
    botao.disabled = false;
    mostrarErro(mensagemDoErro(erro));
  }
}

async function excluir(produto, botao) {
  // Excluir não tem volta; por isso a confirmação antes
  if (!window.confirm('Excluir o produto "' + produto.nome + '"? Esta ação não pode ser desfeita.')) {
    return;
  }

  botao.disabled = true;
  mostrarCarregando("Excluindo…");
  try {
    await excluirProduto(produto.id);
    await carregarProdutos("Produto excluído.");
  } catch (erro) {
    // Produto já pedido: a mensagem sugere desativar em vez de excluir (RF-18)
    botao.disabled = false;
    mostrarErro(mensagemDoErro(erro));
  }
}

async function iniciar() {
  montarCabecalho();
  const usuaria = await exigirPerfil("lojista");
  if (!usuaria) {
    return;
  }

  mostrarCarregando();
  try {
    loja = await obterMinhaLoja();
    if (!loja) {
      limparAvisos();
      avisoSemLoja.hidden = false;
      return;
    }

    blocoDeAcoes.hidden = false;
    const salvo = new URLSearchParams(location.search).get("salvo");
    await carregarProdutos(MENSAGENS_DE_SALVO.get(salvo));
  } catch (erro) {
    mostrarErro(mensagemDoErro(erro));
  }
}

iniciar();