// Recuperar senha (RF-24). Tem duas etapas na mesma página:
//   1) a pessoa informa o e-mail e recebe um link;
//   2) ao voltar pelo link do e-mail, ela escolhe a senha nova.
// A página só valida, chama o serviço e mostra o resultado.
import { montarCabecalho } from "../ui/cabecalho.js";
import {
  mostrarCarregando, mostrarErro, mostrarSucesso, limparAvisos, mensagemDoErro,
  mostrarErroDoCampo, limparErrosDosCampos,
} from "../ui/avisos.js";
import {
  pedirRedefinicaoDeSenha, definirNovaSenha, aoReceberLinkDeRecuperacao, usuariaAtual,
  validarEmailDeRecuperacao, validarNovaSenha,
} from "../servicos/authServico.js";

const etapaPedido = document.getElementById("etapa-pedido");
const etapaNovaSenha = document.getElementById("etapa-nova-senha");
const formularioPedido = document.getElementById("formulario-pedido");
const formularioNovaSenha = document.getElementById("formulario-nova-senha");
const campoEmail = document.getElementById("email");
const campoSenha = document.getElementById("senha");
const campoUsuario = document.getElementById("usuario");
const campoConfirmacao = document.getElementById("confirmacao");

// Quanto tempo esperamos o Supabase confirmar o link do e-mail antes de dizer que ele não funcionou
const ESPERA_PELO_LINK_EM_MS = 8000;

let enviando = false;
let temporizadorDoLink = null;

async function mostrarEtapaDaNovaSenha() {
  clearTimeout(temporizadorDoLink);
  limparAvisos();
  etapaPedido.hidden = true;
  etapaNovaSenha.hidden = false;
  campoSenha.focus();

  // O e-mail da conta vai para o campo escondido, para o navegador oferecer salvar a senha nova na conta certa
  try {
    const usuaria = await usuariaAtual();
    campoUsuario.value = usuaria?.email ?? "";
  } catch (erro) {
    // sem o e-mail só se perde a ajuda do gerenciador de senhas; a troca de senha continua funcionando
  }
}

// Mostra os erros ao lado dos campos e leva o foco para o primeiro com erro.
function mostrarErrosDosCampos(erros, campos) {
  let primeiro = null;
  for (const nome of Object.keys(campos)) {
    if (erros[nome]) {
      mostrarErroDoCampo(campos[nome], erros[nome]);
      primeiro = primeiro ?? campos[nome];
    }
  }
  primeiro?.focus();
}

// Roda uma ação do formulário com a trava contra duplo clique e o botão desativado enquanto espera.
async function enviar(formulario, textoEnquantoEspera, acao) {
  if (enviando) {
    return;
  }
  const botao = formulario.querySelector('button[type="submit"]');
  const textoOriginal = botao.textContent;

  enviando = true;
  botao.disabled = true;
  botao.textContent = textoEnquantoEspera;
  mostrarCarregando(textoEnquantoEspera);

  try {
    await acao();
  } catch (erro) {
    mostrarErro(mensagemDoErro(erro));
  } finally {
    enviando = false;
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

formularioPedido.addEventListener("submit", (evento) => {
  evento.preventDefault();
  limparErrosDosCampos(formularioPedido);
  limparAvisos();

  const dados = { email: campoEmail.value };
  const erros = validarEmailDeRecuperacao(dados);
  if (Object.keys(erros).length > 0) {
    mostrarErrosDosCampos(erros, { email: campoEmail });
    return;
  }

  enviar(formularioPedido, "Enviando…", async () => {
    await pedirRedefinicaoDeSenha(dados.email);
    // O Supabase não diz se o e-mail tem conta (por segurança), então a mensagem é sempre esta
    mostrarSucesso("Se existir uma conta com este e-mail, enviamos o link para criar uma senha nova. Confira também a caixa de spam.");
  });
});

formularioNovaSenha.addEventListener("submit", (evento) => {
  evento.preventDefault();
  limparErrosDosCampos(formularioNovaSenha);
  limparAvisos();

  const dados = { senha: campoSenha.value, confirmacao: campoConfirmacao.value };
  const erros = validarNovaSenha(dados);
  if (Object.keys(erros).length > 0) {
    mostrarErrosDosCampos(erros, { senha: campoSenha, confirmacao: campoConfirmacao });
    return;
  }

  enviar(formularioNovaSenha, "Salvando…", async () => {
    await definirNovaSenha(dados);
    mostrarSucesso("Senha alterada! Você já está logada. Redirecionando…");
    // Um instante para ler a mensagem; depois segue para a página inicial do perfil
    const usuaria = await usuariaAtual();
    setTimeout(() => location.assign(usuaria ? usuaria.rotaInicial() : "login.html"), 1500);
  });
});

// Se o aviso do Supabase (PASSWORD_RECOVERY) não chegou a tempo, a sessão de recuperação pode existir mesmo assim:
// se há alguém logada pelo link, segue para a senha nova; se não, o link realmente não funcionou.
async function confirmarOuAvisarErroDoLink() {
  let usuaria = null;
  try {
    usuaria = await usuariaAtual();
  } catch (erro) {
    // sem conseguir verificar, tratamos como link que não funcionou
  }
  if (usuaria) {
    mostrarEtapaDaNovaSenha();
  } else {
    mostrarErro("Não foi possível confirmar o link. Peça um novo link abaixo.");
  }
}

function iniciar() {
  montarCabecalho();

  // O Supabase coloca os dados do link no endereço, depois do "#". Se o link falhou (expirou ou já foi usado), vem um erro.
  const parametros = new URLSearchParams(location.hash.slice(1));
  const veioDoLink = parametros.get("type") === "recovery";
  const linkComErro = Boolean(parametros.get("error") || parametros.get("error_code"));

  aoReceberLinkDeRecuperacao(mostrarEtapaDaNovaSenha);

  if (linkComErro) {
    mostrarErro("Este link não vale mais: ele expirou ou já foi usado. Peça um novo link abaixo.");
  } else if (veioDoLink) {
    mostrarCarregando("Confirmando o link…");
    temporizadorDoLink = setTimeout(confirmarOuAvisarErroDoLink, ESPERA_PELO_LINK_EM_MS);
  }
}

iniciar();