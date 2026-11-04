// Avisos de carregamento, erro e sucesso (RF-21).
import { ErroApp } from "../modelos/ErroApp.js";

// Há uma única área de avisos por página, logo abaixo do título (h1), e só um aviso aparece por vez:
// o aviso novo substitui o anterior, assim "Carregando…" some quando o resultado chega.

function obterArea() {
  let area = document.querySelector(".area-avisos");

  if (!area) {
    area = document.createElement("div");
    area.className = "area-avisos";

    const titulo = document.querySelector("main h1");
    if (titulo) {
      titulo.insertAdjacentElement("afterend", area);
    } else {
      document.querySelector("main").prepend(area);
    }
  }

  return area;
}

// "papel" diz ao leitor de tela como anunciar: "status" é educado, "alert" interrompe (erros).
function mostrarAviso(classe, mensagem, papel) {
  const aviso = document.createElement("div");
  aviso.className = "aviso " + classe;
  aviso.setAttribute("role", papel);
  // textContent trata a mensagem como texto puro, nunca como HTML, pois ela pode vir de fora (RNF-06)
  aviso.textContent = mensagem;

  obterArea().replaceChildren(aviso);
}

export function mostrarCarregando(mensagem = "Carregando…") {
  mostrarAviso("aviso-carregando", mensagem, "status");
}

export function mostrarErro(mensagem) {
  mostrarAviso("aviso-erro", mensagem, "alert");
}

export function mostrarSucesso(mensagem) {
  mostrarAviso("aviso-sucesso", mensagem, "status");
}

export function mostrarInfo(mensagem) {
  mostrarAviso("aviso-info", mensagem, "status");
}

export function limparAvisos() {
  const area = document.querySelector(".area-avisos");
  if (area) {
    area.replaceChildren();
  }
}

// O ErroApp já vira mensagem na tela, então só o detalhe técnico (a causa) vai para o console, para quem depura.
// Um erro inesperado (que não é ErroApp) sempre vai para o console como erro.
export function registrarErro(erro) {
  if (!(erro instanceof ErroApp)) {
    console.error(erro);
  } else if (erro.cause) {
    console.warn(erro.codigo, erro.cause);
  }
}

// Mostra a mensagem pronta do ErroApp; qualquer outro erro inesperado recebe uma mensagem geral.
export function mensagemDoErro(erro) {
  return erro instanceof ErroApp
    ? erro.mensagemParaUsuaria
    : "Algo deu errado. Recarregue a página e tente novamente.";
}

// ---------- Erros ao lado de cada campo de formulário ----------

// Mostra a mensagem logo abaixo do campo e liga a mensagem ao campo (aria-describedby),
// para o leitor de tela ler o erro junto com o nome do campo.
export function mostrarErroDoCampo(campo, mensagem) {
  const idDoErro = "erro-" + campo.id;
  let erro = document.getElementById(idDoErro);

  if (!erro) {
    erro = document.createElement("p");
    erro.id = idDoErro;
    erro.className = "campo-erro";
    campo.closest(".campo").append(erro);
  }
  erro.textContent = mensagem;

  campo.setAttribute("aria-invalid", "true");
  const descricoes = (campo.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
  if (!descricoes.includes(idDoErro)) {
    descricoes.push(idDoErro);
    campo.setAttribute("aria-describedby", descricoes.join(" "));
  }
}

// Apaga todas as mensagens de erro de campo do formulário (chamar antes de validar de novo).
export function limparErrosDosCampos(formulario) {
  formulario.querySelectorAll(".campo-erro").forEach((erro) => erro.remove());

  formulario.querySelectorAll("[aria-invalid]").forEach((campo) => {
    campo.removeAttribute("aria-invalid");

    // Tira só o que era do erro; as dicas fixas (ex.: "Use pelo menos 6 caracteres") continuam
    const restantes = (campo.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter((id) => id && !id.startsWith("erro-"));
    if (restantes.length > 0) {
      campo.setAttribute("aria-describedby", restantes.join(" "));
    } else {
      campo.removeAttribute("aria-describedby");
    }
  });
}

// Apaga a mensagem de erro de um campo só (os outros erros continuam na tela).
export function limparErroDoCampo(campo) {
  const idDoErro = "erro-" + campo.id;
  document.getElementById(idDoErro)?.remove();
  campo.removeAttribute("aria-invalid");

  const restantes = (campo.getAttribute("aria-describedby") ?? "").split(" ").filter((id) => id && id !== idDoErro);
  if (restantes.length > 0) {
    campo.setAttribute("aria-describedby", restantes.join(" "));
  } else {
    campo.removeAttribute("aria-describedby");
  }
}