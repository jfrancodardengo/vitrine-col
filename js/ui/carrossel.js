// Carrossel de slides feito só com HTML, CSS e JavaScript, acessível pelo teclado e por leitor de tela.
// Recebe uma lista de elementos (cada um é um slide) e devolve o carrossel pronto para colocar na página.
//
// Regras de acessibilidade que ele segue:
// - troca sozinho só se a pessoa NÃO pediu menos movimento (prefers-reduced-motion);
// - a troca automática para quando o mouse ou o foco do teclado estão em cima, e há um botão Pausar/Retomar;
// - setas ← e → trocam de slide quando o foco está dentro dele; no celular, arrastar o dedo também troca;
// - só o slide atual fica visível (atributo hidden), então o leitor de tela não lê os escondidos.
import { criarElemento } from "./elementos.js";

const INTERVALO_DA_TROCA_EM_MS = 6000;
const DISTANCIA_MINIMA_DO_TOQUE_EM_PX = 40;

function criarBotao(classe, rotulo, texto) {
  const botao = criarElemento("button", classe, texto);
  botao.type = "button";
  // aria-label dá o nome completo ao botão; o texto visível (uma seta) sozinho não diz nada ao leitor de tela
  botao.setAttribute("aria-label", rotulo);
  return botao;
}

// "slides" é uma lista de elementos; "rotulo" é o nome do carrossel para o leitor de tela.
export function criarCarrossel(slides, rotulo) {
  const total = slides.length;
  const raiz = criarElemento("div", "carrossel");
  raiz.setAttribute("role", "region");
  raiz.setAttribute("aria-roledescription", "carrossel");
  raiz.setAttribute("aria-label", rotulo);

  // Cada slide vira um "grupo" com o nome "2 de 5"
  const area = criarElemento("div", "carrossel-area");
  slides.forEach((slide, posicao) => {
    slide.classList.add("carrossel-slide");
    slide.setAttribute("role", "group");
    slide.setAttribute("aria-roledescription", "slide");
    slide.setAttribute("aria-label", posicao + 1 + " de " + total);
    area.append(slide);
  });
  raiz.append(area);

  let atual = 0;
  let temporizador = null;
  let pausadaPelaPessoa = false;
  let paradaPeloPonteiro = false; // mouse ou foco em cima do carrossel
  const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const pontos = [];
  const botaoPausa = criarBotao("carrossel-pausa", "Pausar a troca automática de slides", "⏸");

  function mostrar(indice) {
    atual = (indice + total) % total;
    slides.forEach((slide, posicao) => {
      slide.hidden = posicao !== atual;
    });
    pontos.forEach((ponto, posicao) => {
      if (posicao === atual) {
        ponto.setAttribute("aria-current", "true");
      } else {
        ponto.removeAttribute("aria-current");
      }
    });
  }

  function trocaAutomaticaAtiva() {
    return !reduzMovimento && !pausadaPelaPessoa && !paradaPeloPonteiro;
  }

  // A área só anuncia a troca ao leitor de tela quando NÃO é automática; senão ele leria um slide novo a cada 6 s
  function atualizarAnuncio() {
    area.setAttribute("aria-live", trocaAutomaticaAtiva() ? "off" : "polite");
  }

  function pararTemporizador() {
    clearInterval(temporizador);
    temporizador = null;
  }

  function sincronizarTemporizador() {
    pararTemporizador();
    if (total > 1 && trocaAutomaticaAtiva()) {
      temporizador = setInterval(() => mostrar(atual + 1), INTERVALO_DA_TROCA_EM_MS);
    }
    atualizarAnuncio();
  }

  // Com só um slide não há o que navegar: os controles nem aparecem
  if (total > 1) {
    const controles = criarElemento("div", "carrossel-controles");

    const anterior = criarBotao("carrossel-seta", "Slide anterior", "‹");
    const proximo = criarBotao("carrossel-seta", "Próximo slide", "›");
    anterior.addEventListener("click", () => {
      mostrar(atual - 1);
      sincronizarTemporizador(); // recomeça a contagem, para o slide não trocar logo depois do clique
    });
    proximo.addEventListener("click", () => {
      mostrar(atual + 1);
      sincronizarTemporizador();
    });

    const listaDePontos = criarElemento("ul", "carrossel-pontos");
    slides.forEach((slide, posicao) => {
      const item = criarElemento("li");
      const ponto = criarBotao("carrossel-ponto", "Ir para o slide " + (posicao + 1) + " de " + total);
      ponto.addEventListener("click", () => {
        mostrar(posicao);
        sincronizarTemporizador();
      });
      pontos.push(ponto);
      item.append(ponto);
      listaDePontos.append(item);
    });

    controles.append(anterior, listaDePontos, proximo);

    // Quem pediu menos movimento não tem troca automática, então também não precisa do botão de pausa
    if (!reduzMovimento) {
      botaoPausa.addEventListener("click", () => {
        pausadaPelaPessoa = !pausadaPelaPessoa;
        botaoPausa.textContent = pausadaPelaPessoa ? "▶" : "⏸";
        botaoPausa.setAttribute(
          "aria-label",
          pausadaPelaPessoa ? "Retomar a troca automática de slides" : "Pausar a troca automática de slides"
        );
        sincronizarTemporizador();
      });
      controles.append(botaoPausa);
    }
    raiz.append(controles);

    // Mouse ou foco em cima: para a troca, para a pessoa ter tempo de ler
    raiz.addEventListener("mouseenter", () => {
      paradaPeloPonteiro = true;
      sincronizarTemporizador();
    });
    raiz.addEventListener("mouseleave", () => {
      paradaPeloPonteiro = false;
      sincronizarTemporizador();
    });
    raiz.addEventListener("focusin", () => {
      paradaPeloPonteiro = true;
      sincronizarTemporizador();
    });
    raiz.addEventListener("focusout", (evento) => {
      // O foco só "saiu" de verdade se não foi para outro elemento do próprio carrossel
      if (!raiz.contains(evento.relatedTarget)) {
        paradaPeloPonteiro = false;
        sincronizarTemporizador();
      }
    });

    raiz.addEventListener("keydown", (evento) => {
      if (evento.key === "ArrowLeft") {
        mostrar(atual - 1);
      } else if (evento.key === "ArrowRight") {
        mostrar(atual + 1);
      }
    });

    // Arrastar o dedo para o lado troca de slide
    let inicioDoToque = null;
    area.addEventListener("touchstart", (evento) => {
      inicioDoToque = evento.changedTouches[0].clientX;
    }, { passive: true });
    area.addEventListener("touchend", (evento) => {
      if (inicioDoToque === null) {
        return;
      }
      const distancia = evento.changedTouches[0].clientX - inicioDoToque;
      inicioDoToque = null;
      if (Math.abs(distancia) >= DISTANCIA_MINIMA_DO_TOQUE_EM_PX) {
        mostrar(distancia < 0 ? atual + 1 : atual - 1);
        sincronizarTemporizador();
      }
    });
  }

  mostrar(0);
  sincronizarTemporizador();
  return raiz;
}