// Página de login (RF-13). A página só valida, chama o serviço e mostra o resultado.
import { montarCabecalho } from "../ui/cabecalho.js";
import { mostrarCarregando, mostrarErro, mostrarSucesso, limparAvisos, mensagemDoErro, mostrarErroDoCampo, limparErrosDosCampos } from "../ui/avisos.js";
import { enderecoDeRetornoSeguro } from "../ui/protecao.js";
import { entrar, usuariaAtual, validarEntrada } from "../servicos/authServico.js";

const formulario = document.getElementById("formulario-login");
const campoEmail = document.getElementById("email");
const campoSenha = document.getElementById("senha");
const botao = formulario.querySelector('button[type="submit"]');
const linkCadastro = document.getElementById("link-cadastro");

const textoOriginalDoBotao = botao.textContent;
let enviando = false;

// "voltar" guarda a página que a usuária queria abrir (veja protecao.js). Só endereços do próprio site valem.
const voltar = enderecoDeRetornoSeguro(new URLSearchParams(location.search).get("voltar"));

// Quem vai se cadastrar também volta para a mesma página depois
if (voltar) {
  linkCadastro.href = "cadastro.html?voltar=" + encodeURIComponent(voltar);
}

function mostrarErrosDosCampos(erros) {
  const campos = { email: campoEmail, senha: campoSenha };
  let primeiro = null;

  for (const nome of Object.keys(campos)) {
    if (erros[nome]) {
      mostrarErroDoCampo(campos[nome], erros[nome]);
      primeiro = primeiro ?? campos[nome];
    }
  }
  // O foco vai para o primeiro campo com erro, para a usuária corrigir logo
  primeiro?.focus();
}

formulario.addEventListener("submit", async (evento) => {
  // Sem isto o navegador recarregaria a página; e "enviando" evita dois envios com cliques seguidos
  evento.preventDefault();
  if (enviando) {
    return;
  }

  limparErrosDosCampos(formulario);
  limparAvisos();

  const dados = { email: campoEmail.value, senha: campoSenha.value };
  const erros = validarEntrada(dados);
  if (Object.keys(erros).length > 0) {
    mostrarErrosDosCampos(erros);
    return;
  }

  enviando = true;
  botao.disabled = true;
  botao.textContent = "Entrando…";
  mostrarCarregando("Entrando…");

  try {
    const usuaria = await entrar(dados.email, dados.senha);
    mostrarSucesso("Login feito! Redirecionando…");
    // Volta para onde ela estava indo; se não houver, vai para a página inicial do perfil dela (polimorfismo)
    location.assign(voltar ?? usuaria.rotaInicial());
  } catch (erro) {
    mostrarErro(mensagemDoErro(erro));
    enviando = false;
    botao.disabled = false;
    botao.textContent = textoOriginalDoBotao;
  }
});

async function iniciar() {
  montarCabecalho();

  // Quem já está logada não precisa ver o login: segue para o destino
  try {
    const usuaria = await usuariaAtual();
    if (usuaria) {
      location.replace(voltar ?? usuaria.rotaInicial());
    }
  } catch (erro) {
    // Se não deu para verificar, o formulário continua disponível
  }
}

iniciar();