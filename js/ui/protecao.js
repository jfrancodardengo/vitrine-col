// Proteção de telas por perfil (RF-14). Cada tela protegida chama exigirLogin() ou exigirPerfil().
// As páginas protegidas começam com o <main> escondido (atributo hidden); ele só aparece quando
// a verificação passa. Assim o conteúdo nunca "pisca" na tela de quem não tem acesso.
import { usuariaAtual } from "../servicos/authServico.js";
import { Cliente } from "../modelos/Cliente.js";
import { Lojista } from "../modelos/Lojista.js";
import { mostrarErro, mensagemDoErro } from "./avisos.js";

const PERFIS = { cliente: Cliente, lojista: Lojista };

// Só aceitamos o nome de uma página do próprio site, como "sacola.html" ou "produto.html?id=3".
// Isso impede o "redirecionamento aberto": alguém mandar a usuária, depois do login, para um site de fora
// (por exemplo login.html?voltar=https://site-falso.com).
const FORMATO_DE_ENDERECO_DO_SITE = /^[A-Za-z0-9_-]+\.html(\?[^#\s]*)?(#\S*)?$/;

// Voltar para o login ou o cadastro depois de entrar faria a usuária ficar andando em círculos
const PAGINAS_DE_ENTRADA = ["login.html", "cadastro.html"];

// Devolve o endereço se for seguro, ou null se não for (ou se faltar).
export function enderecoDeRetornoSeguro(valor) {
  if (typeof valor !== "string") {
    return null;
  }

  const endereco = valor.trim();
  if (!FORMATO_DE_ENDERECO_DO_SITE.test(endereco)) {
    return null;
  }

  const pagina = endereco.split(/[?#]/)[0].toLowerCase();
  if (PAGINAS_DE_ENTRADA.includes(pagina)) {
    return null;
  }

  // Segunda checagem, com o interpretador de endereços do navegador: tem que continuar no mesmo site
  try {
    if (new URL(endereco, location.href).origin !== location.origin) {
      return null;
    }
  } catch (erro) {
    return null;
  }

  return endereco;
}

// A página em que a usuária está agora, no formato "pagina.html?consulta#parte".
function enderecoAtual() {
  const pagina = location.pathname.split("/").pop() || "index.html";
  return pagina + location.search + location.hash;
}

function liberarConteudo() {
  const principal = document.getElementById("conteudo");
  if (principal) {
    principal.hidden = false;
  }
}

// Se não deu para saber quem está logada (ex.: sem internet), mostra o erro no lugar do conteúdo.
function mostrarFalhaNaProtecao(erro) {
  const principal = document.getElementById("conteudo");
  const titulo = document.createElement("h1");
  titulo.textContent = "Não foi possível abrir a página";
  principal.replaceChildren(titulo);
  principal.hidden = false;
  mostrarErro(mensagemDoErro(erro));
}

// Leva para o login e volta para a página atual depois (RF-10: "Finalizar sacola" sem estar logada).
// Usada por botões, onde a pessoa pode querer voltar com o botão "Voltar" do navegador, por isso usa assign.
export function irParaOLogin() {
  location.assign("login.html?voltar=" + encodeURIComponent(enderecoAtual()));
}

// Devolve a usuária logada; se não houver, manda para o login. Não mostra o conteúdo ainda.
async function obterUsuariaOuIrParaLogin() {
  let usuaria;
  try {
    usuaria = await usuariaAtual();
  } catch (erro) {
    mostrarFalhaNaProtecao(erro);
    return null;
  }

  if (!usuaria) {
    // replace (e não assign) para o botão "Voltar" do navegador não cair de novo nesta página protegida
    location.replace("login.html?voltar=" + encodeURIComponent(enderecoAtual()));
    return null;
  }
  return usuaria;
}

// Para telas que qualquer usuária logada pode abrir. Devolve a usuária ou null (e já redirecionou).
export async function exigirLogin() {
  const usuaria = await obterUsuariaOuIrParaLogin();
  if (usuaria) {
    liberarConteudo();
  }
  return usuaria;
}

// Para telas de um perfil só: exigirPerfil("lojista") ou exigirPerfil("cliente").
// Quem tem o outro perfil vai para a própria página inicial (polimorfismo: rotaInicial()).
export async function exigirPerfil(perfil) {
  const ClasseDoPerfil = PERFIS[perfil];
  if (!ClasseDoPerfil) {
    throw new Error('Perfil desconhecido: use "cliente" ou "lojista".');
  }

  const usuaria = await obterUsuariaOuIrParaLogin();
  if (!usuaria) {
    return null;
  }

  if (!(usuaria instanceof ClasseDoPerfil)) {
    location.replace(usuaria.rotaInicial());
    return null;
  }

  liberarConteudo();
  return usuaria;
}