// Minha conta (RF-25): mostra os dados da usuária e permite excluir a própria conta.
// Cliente e lojista abrem esta tela (RF-14: só quem está logada).
import { montarCabecalho } from "../ui/cabecalho.js";
import {
  mostrarCarregando, mostrarErro, mostrarSucesso, limparAvisos, mensagemDoErro,
  mostrarErroDoCampo, limparErrosDosCampos,
} from "../ui/avisos.js";
import { exigirLogin } from "../ui/protecao.js";
import { excluirMinhaConta } from "../servicos/authServico.js";
import { Lojista } from "../modelos/Lojista.js";
import { criarElemento } from "../ui/elementos.js";

const PALAVRA_DE_CONFIRMACAO = "EXCLUIR";

const formulario = document.getElementById("formulario-excluir");
const campoConfirmacao = document.getElementById("confirmacao");
const botao = formulario.querySelector('button[type="submit"]');
const listaDoQueSome = document.getElementById("lista-do-que-some");

let enviando = false;

function mostrarDadosDaConta(usuaria) {
  // textContent: o nome vem do banco, então nunca entra como HTML
  document.getElementById("conta-nome").textContent = usuaria.nome;
  document.getElementById("conta-email").textContent = usuaria.email ?? "";
  document.getElementById("conta-tipo").textContent = usuaria instanceof Lojista ? "Lojista" : "Cliente";

  // A lojista perde também a loja; o aviso só aparece para quem tem loja
  if (usuaria instanceof Lojista) {
    listaDoQueSome.append(
      criarElemento("li", "", "a sua loja, os seus produtos e as fotos deles saem do catálogo e são apagados;"),
      criarElemento("li", "", "os pedidos que a sua loja recebeu também são apagados.")
    );
  }
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (enviando) {
    return;
  }
  limparErrosDosCampos(formulario);
  limparAvisos();

  // Digitar a palavra evita excluir a conta por engano, com um clique sem querer
  if (campoConfirmacao.value.trim().toUpperCase() !== PALAVRA_DE_CONFIRMACAO) {
    mostrarErroDoCampo(campoConfirmacao, "Digite " + PALAVRA_DE_CONFIRMACAO + " para confirmar.");
    campoConfirmacao.focus();
    return;
  }

  enviando = true;
  botao.disabled = true;
  mostrarCarregando("Excluindo a conta…");

  try {
    await excluirMinhaConta();
    mostrarSucesso("Conta excluída. Obrigada por ter usado a VitrineCol. Redirecionando…");
    setTimeout(() => location.assign("index.html"), 2000);
  } catch (erro) {
    mostrarErro(mensagemDoErro(erro));
    enviando = false;
    botao.disabled = false;
  }
});

async function iniciar() {
  montarCabecalho();

  const usuaria = await exigirLogin();
  if (usuaria) {
    mostrarDadosDaConta(usuaria);
  }
}

iniciar();