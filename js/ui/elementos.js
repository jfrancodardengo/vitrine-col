// Funções pequenas para montar elementos do DOM sem escrever HTML em texto (RNF-06).
// Ficam num arquivo só para as páginas não repetirem o mesmo código.

// Cria um elemento com classe e texto. O texto entra por textContent, então dados vindos do banco
// (nomes, recados) nunca são lidos como HTML.
export function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) {
    elemento.className = classe;
  }
  if (texto !== undefined) {
    elemento.textContent = texto;
  }
  return elemento;
}