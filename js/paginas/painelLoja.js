// Painel da lojista: Minha loja (RF-15, RN-01). Só a lojista abre esta tela (RF-14).
// A página só valida, chama o serviço e mostra o resultado e os avisos.
import { montarCabecalho } from "../ui/cabecalho.js";
import { mostrarCarregando, mostrarErro, mostrarSucesso, mostrarInfo, limparAvisos, mensagemDoErro, mostrarErroDoCampo, limparErrosDosCampos } from "../ui/avisos.js";
import { obterMinhaLoja, salvarLoja, validarLoja } from "../servicos/lojaServico.js";

const formulario = document.getElementById("formulario-loja");
const botao = formulario.querySelector('button[type="submit"]');
const textoOriginalDoBotao = botao.textContent;

// Na ordem em que aparecem na tela; o foco vai para o primeiro que tiver erro
const campos = {
  nome: document.getElementById("nome-loja"),
  descricao: document.getElementById("descricao-loja"),
  endereco: document.getElementById("endereco-loja"),
  cidade: document.getElementById("cidade-loja"),
  whatsapp: document.getElementById("whatsapp-loja"),
  linkMapa: document.getElementById("mapa-loja"),
};

// A loja que já existe no banco (ou null se a lojista ainda não criou a dela)
let lojaAtual = null;
let enviando = false;

function preencherFormulario(loja) {
  campos.nome.value = loja.nome;
  campos.descricao.value = loja.descricao ?? "";
  campos.endereco.value = loja.endereco;
  campos.cidade.value = loja.cidade;
  campos.whatsapp.value = loja.whatsapp ?? "";
  campos.linkMapa.value = loja.link_mapa ?? "";
}

function lerDados() {
  return {
    id: lojaAtual?.id,
    nome: campos.nome.value,
    descricao: campos.descricao.value,
    endereco: campos.endereco.value,
    cidade: campos.cidade.value,
    whatsapp: campos.whatsapp.value,
    linkMapa: campos.linkMapa.value,
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

  const dados = lerDados();
  const erros = validarLoja(dados);
  if (Object.keys(erros).length > 0) {
    mostrarErrosDosCampos(erros);
    return;
  }

  enviando = true;
  botao.disabled = true;
  botao.textContent = "Salvando…";
  mostrarCarregando("Salvando a loja…");

  try {
    const eraNova = lojaAtual === null;
    lojaAtual = await salvarLoja(dados);
    preencherFormulario(lojaAtual); // mostra o WhatsApp já no formato guardado (só dígitos, com 55)
    mostrarSucesso(eraNova ? "Loja criada! Agora você já pode cadastrar produtos." : "Loja salva com sucesso.");
  } catch (erro) {
    mostrarErro(mensagemDoErro(erro));
  } finally {
    enviando = false;
    botao.disabled = false;
    botao.textContent = textoOriginalDoBotao;
  }
});

async function iniciar() {
  montarCabecalho();
  mostrarCarregando();
  try {
    lojaAtual = await obterMinhaLoja();
    if (lojaAtual) {
      preencherFormulario(lojaAtual);
      limparAvisos();
    } else {
      mostrarInfo("Você ainda não cadastrou a sua loja. Preencha os dados abaixo.");
    }
    formulario.hidden = false;
  } catch (erro) {
    mostrarErro(mensagemDoErro(erro));
  }
}

iniciar();