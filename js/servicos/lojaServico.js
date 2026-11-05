// Fala com o banco sobre lojas. Devolve dados ou lança ErroApp.
import { exigirSupabase } from "../supabaseClient.js";
import { ErroApp } from "../modelos/ErroApp.js";

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