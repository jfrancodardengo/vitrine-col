// Fala com o banco sobre categorias (tipos de roupa). Devolve dados ou lança ErroApp.
import { exigirSupabase } from "../supabaseClient.js";
import { ErroApp } from "../modelos/ErroApp.js";

// Devolve [{ id, nome }]. Ordenado pelo id, que é a ordem em que o 03_seed.sql criou as categorias.
export async function listarCategorias() {
  try {
    const supabase = exigirSupabase();
    const { data, error } = await supabase.from("categorias").select("id, nome").order("id");

    if (error) {
      throw error;
    }
    return data;
  } catch (erro) {
    // Um ErroApp já tem mensagem pronta; qualquer outro erro vira um ErroApp em português
    throw erro instanceof ErroApp
      ? erro
      : new ErroApp(
          "erro_ao_listar_categorias",
          "Não foi possível carregar as categorias. Verifique sua conexão e tente novamente.",
          erro
        );
  }
}