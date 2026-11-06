// Fala com o banco sobre produtos. Devolve as linhas do banco ou lança ErroApp.
// Transformar as linhas em objetos Produto é trabalho da página (veja catalogo.js).
import { exigirSupabase } from "../supabaseClient.js";
import { ErroApp } from "../modelos/ErroApp.js";

// Colunas do produto e das tabelas relacionadas. Em "categorias ( id, nome )" o Supabase junta,
// em uma só consulta, a categoria do produto (é só uma, então vem como objeto).
const CAMPOS_DO_PRODUTO = "id, nome, descricao, preco, ativo, loja_id, categoria_id, categorias ( id, nome ), lojas ( id, nome )";
const CAMPOS_DAS_FOTOS = "produto_fotos ( id, url, ordem )";

// Um "%" ou "_" digitado na busca valeria como curinga do LIKE; a barra invertida faz valer como letra comum.
function escaparCuringas(texto) {
  return texto.replace(/[\\%_]/g, "\\$&");
}

// Monta a consulta dos produtos ATIVOS (RN-08) com os filtros opcionais { categoriaId, lojaId, tamanho, busca }.
// Cada linha traz: categorias, lojas, tamanhos e produto_fotos (as fotos já ordenadas, a primeira é a capa).
// Atenção: com o filtro de tamanho, "tamanhos" traz só o tamanho filtrado. Para ver todos use obterProduto.
function montarConsultaDosProdutosAtivos(supabase, { categoriaId, lojaId, tamanho, busca }) {
  const filtrandoPorTamanho = Boolean(tamanho);

  // "!inner" faz um JOIN de verdade: só entram os produtos que TÊM um tamanho que passe nos filtros abaixo.
  // Sem ele, o produto entraria na lista mesmo sem o tamanho, só com a lista de tamanhos vazia.
  const relacaoDosTamanhos = filtrandoPorTamanho
    ? "tamanhos!inner ( tamanho, estoque )"
    : "tamanhos ( tamanho, estoque )";

  let consulta = supabase
    .from("produtos")
    .select(CAMPOS_DO_PRODUTO + ", " + relacaoDosTamanhos + ", " + CAMPOS_DAS_FOTOS)
    // RN-08: produto inativo não aparece. Este filtro é necessário mesmo com a RLS, porque
    // a dona da loja enxerga os próprios produtos inativos.
    .eq("ativo", true)
    // O "id" desempata nomes iguais: sem ele, a ordem poderia mudar entre uma página e outra
    .order("nome")
    .order("id")
    // RN-12: as fotos de cada produto vêm pela ordem; a de menor ordem é a capa
    .order("ordem", { referencedTable: "produto_fotos", ascending: true });

  if (categoriaId) {
    consulta = consulta.eq("categoria_id", categoriaId);
  }
  if (lojaId) {
    consulta = consulta.eq("loja_id", lojaId);
  }
  if (filtrandoPorTamanho) {
    // RF-04: o tamanho escolhido E com estoque maior que zero
    consulta = consulta.eq("tamanhos.tamanho", tamanho).gt("tamanhos.estoque", 0);
  }

  const textoDaBusca = (busca ?? "").trim();
  if (textoDaBusca) {
    // ilike não diferencia maiúsculas de minúsculas (RF-05); "%" nas pontas = "contém"
    consulta = consulta.ilike("nome", "%" + escaparCuringas(textoDaBusca) + "%");
  }

  return consulta;
}

function erroAoListarProdutos(erro) {
  return erro instanceof ErroApp
    ? erro
    : new ErroApp(
        "erro_ao_listar_produtos",
        "Não foi possível carregar os produtos. Verifique sua conexão e tente novamente.",
        erro
      );
}

// RF-01 a RF-05: lista TODOS os produtos ativos que passam nos filtros (usado na página da loja).
export async function listarProdutosAtivos(filtros = {}) {
  try {
    const { data, error } = await montarConsultaDosProdutosAtivos(exigirSupabase(), filtros);
    if (error) {
      throw error;
    }
    return data;
  } catch (erro) {
    throw erroAoListarProdutos(erro);
  }
}

// RF-01: o catálogo mostra os produtos por páginas, para não baixar a vitrine inteira de uma vez.
// "pagina" começa em 0. Devolve { linhas, temMais }: pedimos UMA linha a mais do que cabe na página;
// se ela veio, existe próxima página (e ela é descartada daqui).
export async function listarPaginaDeProdutos({ pagina = 0, porPagina = 12, ...filtros } = {}) {
  try {
    const inicio = pagina * porPagina;
    const { data, error } = await montarConsultaDosProdutosAtivos(exigirSupabase(), filtros).range(inicio, inicio + porPagina);
    if (error) {
      throw error;
    }
    return { linhas: data.slice(0, porPagina), temMais: data.length > porPagina };
  } catch (erro) {
    throw erroAoListarProdutos(erro);
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