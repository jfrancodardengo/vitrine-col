// Fala com o banco sobre produtos. Devolve as linhas do banco ou lança ErroApp.
// Transformar as linhas em objetos Produto é trabalho da página (veja catalogo.js).
import { exigirSupabase } from "../supabaseClient.js";
import { ErroApp } from "../modelos/ErroApp.js";

// Colunas do produto e das tabelas relacionadas. Em "categorias ( id, nome )" o Supabase junta,
// em uma só consulta, a categoria do produto (é só uma, então vem como objeto).
const CAMPOS_DO_PRODUTO = "id, nome, descricao, preco, ativo, loja_id, categoria_id, categorias ( id, nome ), lojas ( id, nome )";
const CAMPOS_DAS_FOTOS = "produto_fotos ( id, url, ordem )";

// Lista TODOS os produtos ativos (RN-08), cada um com a categoria, a loja, os tamanhos e as fotos já em ordem (a primeira é a capa, RN-12).
// Na Aula 30 esta função ganha filtros e páginas.
export async function listarProdutosAtivos() {
  try {
    const supabase = exigirSupabase();
    const { data, error } = await supabase
      .from("produtos")
      .select(CAMPOS_DO_PRODUTO + ", tamanhos ( tamanho, estoque ), " + CAMPOS_DAS_FOTOS)
      // RN-08: produto inativo não aparece
      .eq("ativo", true)
      .order("nome")
      .order("ordem", { referencedTable: "produto_fotos", ascending: true });

    if (error) {
      throw error;
    }
    return data;
  } catch (erro) {
    // Um ErroApp já tem mensagem pronta; qualquer outro erro vira um ErroApp em português
    throw erro instanceof ErroApp
      ? erro
      : new ErroApp(
          "erro_ao_listar_produtos",
          "Não foi possível carregar os produtos. Verifique sua conexão e tente novamente.",
          erro
        );
  }
}

// =====================================================================
// Painel da lojista (RF-16 a RF-19): cadastrar, editar, ativar/desativar e excluir produtos.
// A lojista só consegue mexer nos produtos da própria loja: quem garante isso são as regras RLS (RN-09);
// quando o banco recusa, o erro volta como "permissao_negada" ou "produto_nao_encontrado".
// =====================================================================

// "p", " p " e "P" são o mesmo tamanho
function normalizarTamanho(tamanho) {
  return String(tamanho ?? "").trim().toUpperCase();
}

// Aceita "129.9" e "129,90"
function converterPreco(preco) {
  return Number(String(preco ?? "").replace(",", "."));
}

// Valida o formulário do produto. Devolve { campo: "mensagem" } (vazio quando está tudo certo).
// Chaves: nome, categoriaId, preco, tamanhos e, para cada linha de tamanho, "tamanho-0", "estoque-0", "tamanho-1"...
// A tela mostra cada mensagem ao lado do campo; criarProduto e atualizarProduto validam de novo antes de gravar.
export function validarProduto({ nome, categoriaId, preco, tamanhos = [] }) {
  const erros = {};

  if (String(nome ?? "").trim() === "") {
    erros.nome = "Informe o nome do produto.";
  }
  if (!categoriaId) {
    erros.categoriaId = "Escolha a categoria.";
  }

  // RN-02: o preço deve ser maior que zero
  const precoNumerico = converterPreco(preco);
  if (!Number.isFinite(precoNumerico) || precoNumerico <= 0) {
    erros.preco = "O preço deve ser maior que zero.";
  }

  if (tamanhos.length === 0) {
    erros.tamanhos = "Adicione pelo menos um tamanho.";
  }

  const jaVistos = new Set();
  tamanhos.forEach((linha, indice) => {
    const nomeDoTamanho = normalizarTamanho(linha.tamanho);

    if (nomeDoTamanho === "") {
      erros["tamanho-" + indice] = "Informe o tamanho.";
    } else if (jaVistos.has(nomeDoTamanho)) {
      erros["tamanho-" + indice] = "Este tamanho já foi adicionado.";
    }
    jaVistos.add(nomeDoTamanho);

    // RN-02: o estoque não pode ser negativo (e precisa ser um número inteiro)
    const textoDoEstoque = String(linha.estoque ?? "").trim();
    const estoque = Number(textoDoEstoque);
    if (textoDoEstoque === "") {
      erros["estoque-" + indice] = "Informe o estoque (use 0 se acabou).";
    } else if (!Number.isInteger(estoque) || estoque < 0) {
      erros["estoque-" + indice] = "O estoque deve ser um número inteiro, zero ou maior.";
    }
  });

  return erros;
}