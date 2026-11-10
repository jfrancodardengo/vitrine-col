// Página pública da loja (loja.html?id=...): dados da loja, WhatsApp, mapa e produtos ativos (RF-06, RF-07, RN-08).
// A página só chama os serviços e mostra o resultado e os avisos.
import { montarCabecalho } from "../ui/cabecalho.js";
import { mostrarCarregando, mostrarErro, limparAvisos, mensagemDoErro } from "../ui/avisos.js";
import { criarCardProduto } from "../ui/cards.js";
import { criarLinkDoWhatsapp } from "../ui/formatadores.js";
import { ErroApp } from "../modelos/ErroApp.js";
import { Produto } from "../modelos/Produto.js";
import { obterLoja } from "../servicos/lojaServico.js";
import { listarProdutosAtivos } from "../servicos/produtoServico.js";

const titulo = document.getElementById("titulo-loja");
const resumo = document.getElementById("resumo-loja");
const descricao = document.getElementById("descricao-loja");
const endereco = document.getElementById("endereco-loja");
const botaoWhatsapp = document.getElementById("botao-whatsapp");
const botaoMapa = document.getElementById("botao-mapa");
const blocoDeProdutos = document.getElementById("produtos-loja");
const listaProdutos = document.getElementById("lista-produtos");
const mensagemSemProdutos = document.getElementById("mensagem-sem-produtos");
const voltarAoCatalogo = document.getElementById("voltar-catalogo");

// O link do mapa só vira botão se for http ou https (a loja já valida isso ao salvar; aqui é uma segunda defesa)
function linkDoMapaSeguro(texto) {
  try {
    const protocolo = new URL(texto).protocol;
    return protocolo === "http:" || protocolo === "https:" ? texto : null;
  } catch (erro) {
    return null;
  }
}

function mostrarDadosDaLoja(loja) {
  titulo.textContent = loja.nome; // textContent: o nome vem do banco
  document.title = loja.nome + " – VitrineCol";

  if (loja.descricao) {
    descricao.textContent = loja.descricao;
    descricao.hidden = false;
  }
  endereco.textContent = loja.endereco + ", " + loja.cidade;

  // WhatsApp (RN-10): só aparece se a loja tem um número válido
  const linkDoWhatsapp = criarLinkDoWhatsapp(loja.whatsapp, "Olá, " + loja.nome + "! Vi a sua loja na VitrineCol.");
  if (linkDoWhatsapp) {
    botaoWhatsapp.href = linkDoWhatsapp;
    botaoWhatsapp.hidden = false;
  }

  // RF-07: o botão do mapa só existe se a loja cadastrou o link; abre em nova aba (target + rel="noopener" no HTML)
  const linkDoMapa = loja.link_mapa ? linkDoMapaSeguro(loja.link_mapa) : null;
  if (linkDoMapa) {
    botaoMapa.href = linkDoMapa;
    botaoMapa.hidden = false;
  }

  resumo.hidden = false;
}

function mostrarProdutos(produtos) {
  listaProdutos.replaceChildren(...produtos.map(criarCardProduto));
  mensagemSemProdutos.hidden = produtos.length > 0;
  blocoDeProdutos.hidden = false;
}

async function iniciar() {
  montarCabecalho();
  mostrarCarregando();

  try {
    const id = new URLSearchParams(location.search).get("id");
    if (!id) {
      throw new ErroApp("loja_nao_encontrada", "Loja não encontrada.");
    }

    const loja = await obterLoja(id);
    // Só os produtos ativos aparecem na página da loja (RN-08)
    const linhas = await listarProdutosAtivos({ lojaId: loja.id });

    mostrarDadosDaLoja(loja);
    mostrarProdutos(linhas.map(Produto.deLinha));
    limparAvisos();
  } catch (erro) {
    mostrarErro(mensagemDoErro(erro));
    voltarAoCatalogo.hidden = false;
  }
}

iniciar();