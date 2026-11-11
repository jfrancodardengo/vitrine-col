// Fala com o banco sobre produtos. Devolve as linhas do banco ou lança ErroApp.
// Transformar as linhas em objetos Produto é trabalho da página (veja catalogo.js).
import { exigirSupabase } from "../supabaseClient.js";
import { ErroApp } from "../modelos/ErroApp.js";
import { Produto, MAXIMO_DE_FOTOS } from "../modelos/Produto.js";
import { paraErroApp } from "./errosSupabase.js";
import { enviarFoto, tentarRemoverFotos } from "./storageServico.js";

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

// RF-23 (página inicial): os produtos mais recentes que dá para comprar agora, ou seja, ativos, com pelo menos
// uma foto e pelo menos um tamanho com estoque. "!inner" nas duas relações descarta quem não tem nenhuma das duas coisas.
export async function listarProdutosEmDestaque(limite = 8) {
  try {
    const { data, error } = await exigirSupabase()
      .from("produtos")
      .select(CAMPOS_DO_PRODUTO + ", tamanhos!inner ( tamanho, estoque ), produto_fotos!inner ( id, url, ordem )")
      .eq("ativo", true)
      .gt("tamanhos.estoque", 0)
      .order("criado_em", { ascending: false })
      .order("ordem", { referencedTable: "produto_fotos", ascending: true })
      .limit(limite);
    if (error) {
      throw error;
    }
    return data;
  } catch (erro) {
    throw erroAoListarProdutos(erro);
  }
}

// Página do produto (RF-08): um produto ativo, com TODOS os tamanhos e TODAS as fotos, em ordem.
// Se não existir, ou estiver inativo, lança ErroApp "produto_nao_encontrado".
export async function obterProduto(id) {
  try {
    const supabase = exigirSupabase();

    const { data, error } = await supabase
      .from("produtos")
      .select(CAMPOS_DO_PRODUTO + ", tamanhos ( tamanho, estoque ), " + CAMPOS_DAS_FOTOS)
      .eq("id", id)
      .eq("ativo", true)
      .order("ordem", { referencedTable: "produto_fotos", ascending: true })
      // maybeSingle: devolve um objeto, ou null se não achar (em vez de dar erro)
      .maybeSingle();

    // 22P02 = "isso não é um uuid": um endereço como produto.html?id=abc também é "não encontrado"
    if (error && error.code !== "22P02") {
      throw error;
    }
    if (error || !data) {
      throw new ErroApp("produto_nao_encontrado", "Produto não encontrado.");
    }
    return data;
  } catch (erro) {
    throw erro instanceof ErroApp
      ? erro
      : new ErroApp(
          "erro_ao_obter_produto",
          "Não foi possível carregar o produto. Verifique sua conexão e tente novamente.",
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
const MENSAGEM_PRODUTO_JA_PEDIDO = "Este produto já foi pedido; desative-o em vez de excluir.";
function normalizarTamanho(tamanho) {
  return String(tamanho ?? "").trim().toUpperCase();
}

// Aceita "129.9" e "129,90"
function converterPreco(preco) {
  return Number(String(preco ?? "").replace(",", "."));
}

// Valida o formulário do produto. Devolve { campo: "mensagem" } (vazio quando está tudo certo).
// Chaves: nome, categoriaId, preco, tamanhos, fotos e, para cada linha de tamanho, "tamanho-0", "estoque-0", "tamanho-1"...
// A tela mostra cada mensagem ao lado do campo; criarProduto e atualizarProduto validam de novo antes de gravar.
export function validarProduto({ nome, categoriaId, preco, tamanhos = [], fotos = [] }) {
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

  // RN-12: no máximo 5 fotos por produto
  if (fotos.length > MAXIMO_DE_FOTOS) {
    erros.fotos = "Cada produto pode ter no máximo " + MAXIMO_DE_FOTOS + " fotos.";
  }

  return erros;
}

// Lista TODOS os produtos da loja, inclusive os inativos (a dona vê os dois pelas regras RLS).
export async function listarProdutosDaLoja(lojaId) {
  try {
    const supabase = exigirSupabase();
    const { data, error } = await supabase
      .from("produtos")
      .select("id, nome, preco, ativo, categorias ( nome )")
      .eq("loja_id", lojaId)
      .order("nome");

    if (error) {
      throw error;
    }
    return data;
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível carregar os seus produtos. Verifique sua conexão e tente novamente.");
  }
}

// Traz um produto da loja (ativo ou não) com todos os tamanhos e as fotos em ordem, para o formulário de edição.
// O filtro por loja_id impede abrir, por engano, o produto de outra loja.
export async function obterProdutoParaEdicao(id, lojaId) {
  try {
    const supabase = exigirSupabase();
    const { data, error } = await supabase
      .from("produtos")
      .select(CAMPOS_DO_PRODUTO + ", tamanhos ( tamanho, estoque ), produto_fotos ( id, url, caminho, ordem )")
      .eq("id", id)
      .eq("loja_id", lojaId)
      .order("ordem", { referencedTable: "produto_fotos", ascending: true })
      .maybeSingle();

    // 22P02 = "isso não é um uuid": um endereço como ?id=abc também é "não encontrado"
    if (error && error.code !== "22P02") {
      throw error;
    }
    if (error || !data) {
      throw new ErroApp("produto_nao_encontrado", "Produto não encontrado.");
    }
    return data;
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível carregar o produto. Verifique sua conexão e tente novamente.");
  }
}

// Monta a linha da tabela produtos e as linhas de tamanhos a partir dos dados do formulário.
function montarLinhas(dados) {
  return {
    linhaDoProduto: {
      loja_id: dados.lojaId,
      categoria_id: Number(dados.categoriaId), // o <select> entrega texto; a coluna é número
      nome: dados.nome.trim(),
      descricao: String(dados.descricao ?? "").trim() === "" ? null : dados.descricao.trim(),
      preco: converterPreco(dados.preco),
      ativo: dados.ativo !== false,
    },
    linhasDeTamanhos: dados.tamanhos.map((linha) => ({
      tamanho: normalizarTamanho(linha.tamanho),
      estoque: Number(linha.estoque),
    })),
  };
}

// Última defesa: o modelo Produto confere RN-02 e RN-12 de novo e lança ErroApp se algo escapou da tela.
function conferirComOModelo(dados) {
  new Produto({
    id: dados.id,
    nome: dados.nome,
    preco: converterPreco(dados.preco),
    categoria: String(dados.categoriaId),
    lojaId: dados.lojaId,
    tamanhos: dados.tamanhos.map((linha) => ({ tamanho: normalizarTamanho(linha.tamanho), estoque: linha.estoque })),
    fotos: dados.fotos.map((foto) => foto.url ?? "foto-nova"),
  });
}

// Envia os arquivos novos ao Storage e devolve a lista final de fotos, na mesma ordem.
// Cada item de "fotos" é de um destes tipos:
//   { id, url, caminho }  foto que já estava salva
//   { url }               endereço de imagem informado à mão (caminho fica vazio)
//   { arquivo }           arquivo novo, que ainda precisa ser enviado
// "enviados" recebe os caminhos dos arquivos enviados agora, para desfazer se algo falhar depois.
async function enviarFotosNovas(fotos, lojaId, produtoId, enviados) {
  const resultado = [];

  for (const foto of fotos) {
    if (foto.arquivo) {
      const salva = await enviarFoto(foto.arquivo, lojaId, produtoId);
      enviados.push(salva.caminho);
      resultado.push({ url: salva.url, caminho: salva.caminho });
    } else {
      resultado.push({ id: foto.id, url: foto.url, caminho: foto.caminho ?? null });
    }
  }
  return resultado;
}

// Cria o produto, os tamanhos e as fotos (RF-16, RF-19).
// "dados.id" é gerado no navegador (crypto.randomUUID()) ANTES do envio, para o caminho das fotos no Storage já usar o id do produto.
// Passos: 1) envia os arquivos; 2) grava o produto; 3) grava tamanhos e fotos. Se algo falhar, desfaz o que foi feito.
export async function criarProduto(dados) {
  const enviados = [];
  let produtoGravado = false;

  try {
    ErroApp.lancarSeHouverErros(validarProduto(dados));
    conferirComOModelo(dados);
    const supabase = exigirSupabase();
    const { linhaDoProduto, linhasDeTamanhos } = montarLinhas(dados);

    const fotos = await enviarFotosNovas(dados.fotos, dados.lojaId, dados.id, enviados);

    const { error: erroDoProduto } = await supabase.from("produtos").insert({ id: dados.id, ...linhaDoProduto });
    if (erroDoProduto) {
      throw erroDoProduto;
    }
    produtoGravado = true;

    const { error: erroDosTamanhos } = await supabase
      .from("tamanhos")
      .insert(linhasDeTamanhos.map((linha) => ({ produto_id: dados.id, ...linha })));
    if (erroDosTamanhos) {
      throw erroDosTamanhos;
    }

    if (fotos.length > 0) {
      const { error: erroDasFotos } = await supabase
        .from("produto_fotos")
        .insert(fotos.map((foto, indice) => ({ produto_id: dados.id, url: foto.url, caminho: foto.caminho, ordem: indice + 1 })));
      if (erroDasFotos) {
        throw erroDasFotos;
      }
    }

    return dados.id;
  } catch (erro) {
    // Desfaz: sem o produto completo, é melhor não deixar produto pela metade nem arquivos soltos.
    // (Apagar o produto também apaga, em cascata, os tamanhos e as fotos dele.)
    if (produtoGravado) {
      await exigirSupabase().from("produtos").delete().eq("id", dados.id);
    }
    await tentarRemoverFotos(enviados);
    throw paraErroApp(erro, "Não foi possível salvar o produto. Verifique sua conexão e tente novamente.");
  }
}

// Atualiza o produto, os tamanhos e as fotos (RF-17, RF-19). Os dados têm o mesmo formato do criarProduto.
// As fotos podem ter sido removidas, reordenadas ou acrescentadas: a ordem da lista vira a coluna "ordem" (1 a 5).
export async function atualizarProduto(id, dados) {
  const enviados = [];
  let fotosNovasGravadas = false;

  try {
    ErroApp.lancarSeHouverErros(validarProduto(dados));
    conferirComOModelo({ ...dados, id });
    const supabase = exigirSupabase();
    const { linhaDoProduto, linhasDeTamanhos } = montarLinhas(dados);

    // Como está hoje no banco: serve para saber o que foi removido
    const { data: atual, error: erroAoLer } = await supabase
      .from("produtos")
      .select("id, tamanhos ( tamanho ), produto_fotos ( id, caminho )")
      .eq("id", id)
      .eq("loja_id", dados.lojaId)
      .maybeSingle();
    if (erroAoLer) {
      throw erroAoLer;
    }
    if (!atual) {
      throw new ErroApp("produto_nao_encontrado", "Produto não encontrado.");
    }

    const fotos = await enviarFotosNovas(dados.fotos, dados.lojaId, id, enviados);

    // 1) Dados do produto. Se a loja não for desta lojista, as regras RLS não alteram nada e não volta linha
    const { data: alterados, error: erroDoProduto } = await supabase.from("produtos").update(linhaDoProduto).eq("id", id).select("id");
    if (erroDoProduto) {
      throw erroDoProduto;
    }
    if (alterados.length === 0) {
      throw new ErroApp("permissao_negada", "Você não tem permissão para alterar este produto.");
    }

    // 2) Tamanhos: grava os atuais (cria ou atualiza) e apaga os que a lojista tirou
    const { error: erroDosTamanhos } = await supabase
      .from("tamanhos")
      .upsert(linhasDeTamanhos.map((linha) => ({ produto_id: id, ...linha })), { onConflict: "produto_id,tamanho" });
    if (erroDosTamanhos) {
      throw erroDosTamanhos;
    }
    const tamanhosNovos = new Set(linhasDeTamanhos.map((linha) => linha.tamanho));
    const tamanhosRemovidos = atual.tamanhos.map((t) => t.tamanho).filter((t) => !tamanhosNovos.has(t));
    if (tamanhosRemovidos.length > 0) {
      const { error } = await supabase.from("tamanhos").delete().eq("produto_id", id).in("tamanho", tamanhosRemovidos);
      if (error) {
        throw error;
      }
    }

    // 3) Fotos. Primeiro apaga as removidas (assim o limite de 5 do banco não atrapalha as novas)
    const idsMantidos = new Set(fotos.filter((foto) => foto.id).map((foto) => foto.id));
    const fotosRemovidas = atual.produto_fotos.filter((foto) => !idsMantidos.has(foto.id));
    if (fotosRemovidas.length > 0) {
      const { error } = await supabase.from("produto_fotos").delete().in("id", fotosRemovidas.map((foto) => foto.id));
      if (error) {
        throw error;
      }
    }

    // Depois grava as novas, já com a ordem final
    const fotosParaCriar = fotos
      .map((foto, indice) => ({ foto, ordem: indice + 1 }))
      .filter((item) => !item.foto.id)
      .map((item) => ({ produto_id: id, url: item.foto.url, caminho: item.foto.caminho, ordem: item.ordem }));
    if (fotosParaCriar.length > 0) {
      const { error } = await supabase.from("produto_fotos").insert(fotosParaCriar);
      if (error) {
        throw error;
      }
    }
    fotosNovasGravadas = true;

    // Por fim, a ordem das fotos que já existiam (é isto que muda a capa quando a lojista reordena)
    for (const [indice, foto] of fotos.entries()) {
      if (foto.id) {
        const { error } = await supabase.from("produto_fotos").update({ ordem: indice + 1 }).eq("id", foto.id);
        if (error) {
          throw error;
        }
      }
    }

    // Só agora apaga do Storage os arquivos das fotos removidas (melhor esforço: não trava se falhar)
    await tentarRemoverFotos(fotosRemovidas.map((foto) => foto.caminho).filter(Boolean));
    return id;
  } catch (erro) {
    // Se falhou antes de gravar as fotos novas, os arquivos enviados agora ficariam soltos: apaga
    if (!fotosNovasGravadas) {
      await tentarRemoverFotos(enviados);
    }
    throw paraErroApp(erro, "Não foi possível salvar o produto. Verifique sua conexão e tente novamente.");
  }
}

// Ativa ou desativa o produto (RF-18). Produto inativo some do catálogo e da página da loja (RN-08).
export async function definirAtivo(id, ativo) {
  try {
    const supabase = exigirSupabase();
    const { data, error } = await supabase.from("produtos").update({ ativo }).eq("id", id).select("id");

    if (error) {
      throw error;
    }
    if (data.length === 0) {
      throw new ErroApp("permissao_negada", "Você não tem permissão para alterar este produto.");
    }
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível alterar o produto. Verifique sua conexão e tente novamente.");
  }
}

// Exclui o produto (RF-18). Produto que já foi pedido NÃO pode ser excluído: o banco impede, e a mensagem sugere desativar.
// Ordem dos passos: 1) confere se já foi pedido; 2) guarda os caminhos das fotos; 3) apaga o produto (o banco apaga
// em cascata os tamanhos e as linhas de produto_fotos); 4) apaga os arquivos do Storage, em "melhor esforço".
// Deixamos os arquivos por último de propósito: se o banco recusar a exclusão, nenhuma foto foi perdida.
export async function excluirProduto(id) {
  try {
    const supabase = exigirSupabase();

    // As regras RLS deixam a lojista ver os itens dos pedidos da própria loja, e é neles que o produto aparece
    const { count, error: erroDosPedidos } = await supabase
      .from("itens_pedido")
      .select("id", { count: "exact", head: true })
      .eq("produto_id", id);
    if (erroDosPedidos) {
      throw erroDosPedidos;
    }
    if (count > 0) {
      throw new ErroApp("produto_ja_pedido", MENSAGEM_PRODUTO_JA_PEDIDO);
    }

    const { data: fotos, error: erroDasFotos } = await supabase.from("produto_fotos").select("caminho").eq("produto_id", id);
    if (erroDasFotos) {
      throw erroDasFotos;
    }

    const { data: apagados, error: erroAoApagar } = await supabase.from("produtos").delete().eq("id", id).select("id");
    if (erroAoApagar) {
      // 23503: alguém fez um pedido deste produto entre a conferência e agora
      if (erroAoApagar.code === "23503") {
        throw new ErroApp("produto_ja_pedido", MENSAGEM_PRODUTO_JA_PEDIDO, erroAoApagar);
      }
      throw erroAoApagar;
    }
    if (apagados.length === 0) {
      throw new ErroApp("permissao_negada", "Você não tem permissão para excluir este produto.");
    }

    await tentarRemoverFotos(fotos.map((foto) => foto.caminho).filter(Boolean));
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível excluir o produto. Verifique sua conexão e tente novamente.");
  }
}