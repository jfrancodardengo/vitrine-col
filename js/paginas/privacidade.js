// Página de privacidade: monta o cabeçalho e coloca o e-mail de contato (definido num lugar só, o js/config.js).
import { montarCabecalho } from "../ui/cabecalho.js";
import { EMAIL_DE_CONTATO } from "../config.js";

montarCabecalho();

const lugarDoEmail = document.getElementById("email-de-contato");
if (lugarDoEmail) {
  // O e-mail entra por textContent e pelo href montado aqui; nada é interpretado como HTML
  const link = document.createElement("a");
  link.href = "mailto:" + EMAIL_DE_CONTATO;
  link.textContent = EMAIL_DE_CONTATO;
  lugarDoEmail.replaceChildren(link);
}