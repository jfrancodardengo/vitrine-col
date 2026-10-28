// Avisos de carregamento, erro e sucesso (RF-21).

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