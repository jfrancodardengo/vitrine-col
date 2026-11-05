// Cria o cliente do Supabase, que é quem conversa com o banco, o login e o Storage.
// Os serviços (js/servicos/) usam este arquivo; as páginas nunca falam com o Supabase direto.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
import { ErroApp } from "./modelos/ErroApp.js";

const ENDERECO_DA_BIBLIOTECA = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// true enquanto o config.js ainda tiver os valores de exemplo (ou estiver vazio)
export const configuracaoDeExemplo = [SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY].some(
  (valor) =>
    typeof valor !== "string" ||
    valor.trim() === "" ||
    valor.includes("SEU-PROJETO") ||
    valor.includes("SUA-CHAVE")
);

// Fica null se a configuração for de exemplo ou se a biblioteca não puder ser carregada.
let cliente = null;

if (!configuracaoDeExemplo) {
  try {
    // import() dinâmico, e não "import ... from" no topo: se a CDN estiver fora do ar ou sem internet,
    // o erro cai neste try/catch e a página consegue mostrar uma mensagem, em vez de ficar em branco (RF-21).
    const { createClient } = await import(ENDERECO_DA_BIBLIOTECA);
    cliente = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  } catch (erro) {
    console.error("Não foi possível carregar a biblioteca do Supabase.", erro);
  }
}

export const supabase = cliente;

// Usada pelos serviços: devolve o cliente, ou lança um ErroApp que explica por que não existe.
export function exigirSupabase() {
  if (configuracaoDeExemplo) {
    throw new ErroApp(
      "configuracao_de_exemplo",
      "O sistema ainda não está conectado ao banco de dados. Preencha a URL e a chave do Supabase no arquivo js/config.js."
    );
  }
  if (!supabase) {
    throw new ErroApp(
      "supabase_indisponivel",
      "Não foi possível carregar o sistema de dados. Verifique sua conexão com a internet e recarregue a página."
    );
  }
  return supabase;
}