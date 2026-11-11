// Fala com o banco sobre lojas. Devolve dados ou lança ErroApp.
import { exigirSupabase } from "../supabaseClient.js";
import { ErroApp } from "../modelos/ErroApp.js";
import { Loja } from "../modelos/Loja.js";
import { Lojista } from "../modelos/Lojista.js";
import { paraErroApp } from "./errosSupabase.js";
import { usuariaAtual } from "./authServico.js";
import { normalizarTelefone, telefoneValido } from "../ui/formatadores.js";

const CAMPOS_DA_LOJA = "id, nome, descricao, endereco, cidade, whatsapp, link_mapa";

// Devolve [{ id, nome }], em ordem alfabética. Usada no filtro de lojas do catálogo.
export async function listarLojas() {
  try {
    const supabase = exigirSupabase();
    const { data, error } = await supabase.from("lojas").select("id, nome").order("nome");

    if (error) {
      throw error;
    }
    return data;
  } catch (erro) {
    throw erro instanceof ErroApp
      ? erro
      : new ErroApp(
          "erro_ao_listar_lojas",
          "Não foi possível carregar as lojas. Verifique sua conexão e tente novamente.",
          erro
        );
  }
}

// ---------- Páginas públicas ----------

// Traz uma loja pelo id, para a página da loja (RF-06). Id que não existe (ou que nem é um uuid) vira "Loja não encontrada".
export async function obterLoja(id) {
  try {
    const supabase = exigirSupabase();
    const { data, error } = await supabase.from("lojas").select(CAMPOS_DA_LOJA).eq("id", id).maybeSingle();

    // 22P02 = "isso não é um uuid": um endereço como loja.html?id=abc também é "não encontrada"
    if (error && error.code !== "22P02") {
      throw error;
    }
    if (error || !data) {
      throw new ErroApp("loja_nao_encontrada", "Loja não encontrada.");
    }
    return data;
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível carregar a loja. Verifique sua conexão e tente novamente.");
  }
}

// Nome e WhatsApp das lojas indicadas, para montar os links do WhatsApp na confirmação do pedido (RF-10).
export async function listarContatosDasLojas(ids) {
  try {
    const supabase = exigirSupabase();
    const { data, error } = await supabase.from("lojas").select("id, nome, whatsapp").in("id", ids);

    if (error) {
      throw error;
    }
    return data;
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível carregar o contato das lojas. Verifique sua conexão e tente novamente.");
  }
}

// ---------- Painel da lojista ----------

// Valida os dados do formulário da loja. Devolve { campo: "mensagem" } (vazio quando está tudo certo).
// A tela mostra cada mensagem ao lado do campo; salvarLoja valida de novo antes de gravar.
export function validarLoja({ nome, endereco, cidade, whatsapp, linkMapa }) {
  const erros = {};

  if (String(nome ?? "").trim() === "") {
    erros.nome = "Informe o nome da loja.";
  }
  if (String(endereco ?? "").trim() === "") {
    erros.endereco = "Informe o endereço da loja.";
  }
  if (String(cidade ?? "").trim() === "") {
    erros.cidade = "Informe a cidade da loja.";
  }

  // RN-10: o WhatsApp é guardado só com dígitos e código do país. A lojista pode digitar com DDD e máscara.
  if (!telefoneValido(normalizarTelefone(whatsapp))) {
    erros.whatsapp = "WhatsApp inválido. Informe o DDD e o número, por exemplo 27 99999-9999.";
  }

  // O link do mapa é opcional; se existir, precisa ser http ou https
  const textoDoLink = String(linkMapa ?? "").trim();
  if (textoDoLink !== "") {
    try {
      const protocolo = new URL(textoDoLink).protocol;
      if (protocolo !== "http:" && protocolo !== "https:") {
        throw new Error("protocolo");
      }
    } catch (erro) {
      erros.linkMapa = "O link do mapa deve começar com http:// ou https://.";
    }
  }

  return erros;
}

// Texto vazio vira null no banco (colunas opcionais)
function vazioParaNulo(texto) {
  const limpo = String(texto ?? "").trim();
  return limpo === "" ? null : limpo;
}

// Devolve a loja da lojista logada, ou null se ela ainda não cadastrou (RN-01: no máximo uma loja).
export async function obterMinhaLoja() {
  try {
    const usuaria = await usuariaAtual();
    if (!(usuaria instanceof Lojista)) {
      throw new ErroApp("sem_permissao", "Só lojistas têm loja.");
    }

    const supabase = exigirSupabase();
    const { data, error } = await supabase.from("lojas").select(CAMPOS_DA_LOJA).eq("dono_id", usuaria.id).maybeSingle();
    if (error) {
      throw error;
    }
    return data;
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível carregar a sua loja. Verifique sua conexão e tente novamente.");
  }
}

// Cria a loja (sem "id") ou edita a loja existente (com "id"). Devolve a loja gravada.
export async function salvarLoja({ id, nome, descricao, endereco, cidade, whatsapp, linkMapa }) {
  try {
    ErroApp.lancarSeHouverErros(validarLoja({ nome, endereco, cidade, whatsapp, linkMapa }));

    const usuaria = await usuariaAtual();
    if (!(usuaria instanceof Lojista)) {
      throw new ErroApp("sem_permissao", "Só lojistas podem cadastrar uma loja.");
    }

    const linha = {
      nome: nome.trim(),
      descricao: vazioParaNulo(descricao),
      endereco: endereco.trim(),
      cidade: cidade.trim(),
      whatsapp: normalizarTelefone(whatsapp),
      link_mapa: vazioParaNulo(linkMapa),
    };

    // Última defesa: o modelo Loja confere as regras de novo (RN-10) e lança ErroApp se algo escapou
    new Loja({ id, nome: linha.nome, endereco: linha.endereco, cidade: linha.cidade, whatsapp: linha.whatsapp, linkMapa: linha.link_mapa ?? "" });

    const supabase = exigirSupabase();

    if (id) {
      const { data, error } = await supabase.from("lojas").update(linha).eq("id", id).select(CAMPOS_DA_LOJA).maybeSingle();
      if (error) {
        throw error;
      }
      // As regras RLS só deixam a dona alterar; se não voltou nenhuma linha, a loja não é desta lojista
      if (!data) {
        throw new ErroApp("loja_nao_encontrada", "Não foi possível salvar: a loja não foi encontrada ou não é sua.");
      }
      return data;
    }

    const { data, error } = await supabase.from("lojas").insert({ dono_id: usuaria.id, ...linha }).select(CAMPOS_DA_LOJA).single();
    if (error) {
      throw error;
    }
    return data;
  } catch (erro) {
    // 23505 = violação de unicidade: o banco só aceita uma loja por lojista (RN-01)
    if (erro?.code === "23505") {
      throw new ErroApp("loja_ja_existe", "Você já tem uma loja cadastrada. Recarregue a página para editá-la.", erro);
    }
    throw paraErroApp(erro, "Não foi possível salvar a loja. Verifique sua conexão e tente novamente.");
  }
}