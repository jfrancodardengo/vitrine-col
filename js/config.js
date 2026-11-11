// Configuração de conexão com o Supabase.
// Troque os dois valores abaixo pelos do SEU projeto (Project Settings > API no painel do Supabase).
//
// A chave "anon" é PÚBLICA: ela aparece no código do site e qualquer pessoa pode vê-la.
// Por isso ela não é um segredo. Quem protege os dados são as regras RLS do banco (database/02_rls.sql).
// NUNCA coloque aqui a chave "service_role" (ou "secret"): ela dá acesso total ao banco.
//
// Enquanto estes valores forem os de exemplo, o site mostra um aviso em vez de tentar conectar.
export const SUPABASE_URL = "https://mbvjfzlwagbcpqqoqzuq.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_0b8pPsSVr3qQT3d4EBDjiA_-JATWVOc";

// E-mail de contato da equipe, mostrado na página de privacidade (privacidade.html).
// Troque pelo e-mail real da equipe antes de publicar o site.
export const EMAIL_DE_CONTATO = "vitrinecol@gmail.com";