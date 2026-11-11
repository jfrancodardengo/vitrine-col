// Página de cadastro (RF-12). A página só valida, chama o serviço e mostra o resultado.
import { montarCabecalho } from "../ui/cabecalho.js";
import { mostrarCarregando, mostrarErro, mostrarSucesso, limparAvisos, mensagemDoErro, mostrarErroDoCampo, limparErrosDosCampos } from "../ui/avisos.js";
import { ErroApp } from "../modelos/ErroApp.js";
import { cadastrar, usuariaAtual, validarCadastro } from "../servicos/authServico.js";

const formulario = document.getElementById("formulario-cadastro");
const botao = formulario.querySelector('button[type="submit"]');

// Na ordem em que aparecem na tela; o foco vai para o primeiro que tiver erro
const campos = {
  nome: document.getElementById("nome"),
  email: document.getElementById("email"),
  senha: document.getElementById("senha"),
  telefone: document.getElementById("telefone"),
};

const textoOriginalDoBotao = botao.textContent;
let enviando = false;

function lerDados() {
  return {
    nome: campos.nome.value,
    email: campos.email.value,
    senha: campos.senha.value,
    telefone: campos.telefone.value,
    // O perfil escolhido aqui vira o perfil da usuária e não muda depois (RN-11)
    tipo: formulario.elements["perfil"].value,
  };
}

function mostrarErrosDosCampos(erros) {
  let primeiro = null;

  for (const nome of Object.keys(campos)) {
    if (erros[nome]) {
      mostrarErroDoCampo(campos[nome], erros[nome]);
      primeiro = primeiro ?? campos[nome];
    }
  }
  if (erros.tipo) {
    mostrarErro(erros.tipo);
  }
  primeiro?.focus();
}

// Alguns erros do servidor pertencem a um campo específico; os outros viram aviso no topo.
function mostrarErroDoServidor(erro) {
  if (erro instanceof ErroApp && erro.codigo === "email_ja_cadastrado") {
    mostrarErroDoCampo(campos.email, erro.mensagemParaUsuaria);
    campos.email.focus();
  } else if (erro instanceof ErroApp && erro.codigo === "senha_fraca") {
    mostrarErroDoCampo(campos.senha, erro.mensagemParaUsuaria);
    campos.senha.focus();
  } else {
    mostrarErro(mensagemDoErro(erro));
  }
}

formulario.addEventListener("submit", async (evento) => {
  // Sem isto o navegador recarregaria a página; e "enviando" evita dois envios com cliques seguidos
  evento.preventDefault();
  if (enviando) {
    return;
  }

  limparErrosDosCampos(formulario);
  limparAvisos();

  const dados = lerDados();
  const erros = validarCadastro(dados);
  if (Object.keys(erros).length > 0) {
    mostrarErrosDosCampos(erros);
    return;
  }

  enviando = true;
  botao.disabled = true;
  botao.textContent = "Cadastrando…";
  mostrarCarregando("Criando a sua conta…");

  try {
    const resultado = await cadastrar(dados);

    if (resultado.precisaConfirmarEmail) {
      // O projeto exige confirmar o e-mail: ainda não há sessão, então ficamos nesta página
      mostrarSucesso("Conta criada! Enviamos uma mensagem de confirmação para o seu e-mail. Confirme e depois entre na sua conta.");
      formulario.reset();
      enviando = false;
      botao.disabled = false;
      botao.textContent = textoOriginalDoBotao;
      return;
    }

    mostrarSucesso("Conta criada! Redirecionando…");
    // A usuária já está logada: segue para a página inicial do perfil escolhido
    location.assign(resultado.usuaria.rotaInicial());
  } catch (erro) {
    limparAvisos();
    mostrarErroDoServidor(erro);
    enviando = false;
    botao.disabled = false;
    botao.textContent = textoOriginalDoBotao;
  }
});

async function iniciar() {
  montarCabecalho();

  // Quem já está logada não precisa de cadastro
  try {
    const usuaria = await usuariaAtual();
    if (usuaria) {
      location.replace(usuaria.rotaInicial());
    }
  } catch (erro) {
    // Se não deu para verificar, o formulário continua disponível
  }
}

iniciar();