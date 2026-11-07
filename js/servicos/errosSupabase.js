// Traduz os erros do Supabase (que vêm em inglês e em vários formatos) para ErroApp com mensagem em português.
// Este é o ÚNICO lugar onde as mensagens do Supabase são traduzidas; os serviços só chamam paraErroApp().
import { ErroApp } from "../modelos/ErroApp.js";

const MENSAGEM_DE_CONEXAO = "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
const MENSAGEM_DE_EMAIL_REPETIDO = "Este e-mail já está cadastrado. Entre na sua conta ou use outro e-mail.";

// O Supabase, com a confirmação de e-mail ligada, não avisa que o e-mail já existe (por segurança):
// ele devolve um usuário sem "identities". O authServico usa esta função para criar o mesmo erro nesse caso.
export function erroDeEmailJaCadastrado() {
  return new ErroApp("email_ja_cadastrado", MENSAGEM_DE_EMAIL_REPETIDO);
}

// Recebe qualquer erro e devolve um ErroApp.
// "mensagemPadrao" é usada quando o erro não é nenhum dos conhecidos abaixo.
export function paraErroApp(erro, mensagemPadrao) {
  // Um ErroApp já tem mensagem pronta: passa direto
  if (erro instanceof ErroApp) {
    return erro;
  }

  // Os erros do Supabase têm "code" (ou "error_code") e "message" (ou "msg"); o texto ajuda quando falta o código.
  const codigo = String(erro?.code ?? erro?.error_code ?? "").toLowerCase();
  const texto = String(erro?.message ?? erro?.msg ?? "").toLowerCase();
  const status = Number(erro?.status);

  const criar = (codigoDoErro, mensagem) => new ErroApp(codigoDoErro, mensagem, erro);

  if (codigo === "invalid_credentials" || texto.includes("invalid login credentials")) {
    return criar("credenciais_invalidas", "E-mail ou senha incorretos.");
  }

  if (
    codigo === "user_already_exists" ||
    codigo === "email_exists" ||
    texto.includes("already registered") ||
    texto.includes("already been registered")
  ) {
    return criar("email_ja_cadastrado", MENSAGEM_DE_EMAIL_REPETIDO);
  }

  if (codigo === "weak_password" || texto.includes("password should be") || texto.includes("password is too")) {
    return criar("senha_fraca", "A senha é muito curta ou fraca. Use pelo menos 6 caracteres.");
  }

  if (codigo === "email_not_confirmed" || texto.includes("email not confirmed")) {
    return criar("email_nao_confirmado", "Confirme seu e-mail antes de entrar. Procure a mensagem de confirmação na sua caixa de entrada.");
  }

  if (codigo === "email_address_invalid" || texto.includes("unable to validate email address")) {
    return criar("email_invalido", "Este e-mail não é válido. Confira se digitou corretamente.");
  }

  if (codigo === "signup_disabled") {
    return criar("cadastro_desativado", "Os cadastros estão desativados no momento.");
  }

  if (status === 429 || codigo.includes("rate_limit")) {
    return criar("muitas_tentativas", "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.");
  }

  // ----- Erros do banco (PostgREST) e do Storage -----
  // Gatilhos do banco (RAISE EXCEPTION) chegam com o código P0001 e a mensagem já em português
  if (codigo === "p0001" && typeof erro?.message === "string") {
    return criar("regra_do_banco", erro.message);
  }

  // 42501 = as regras RLS recusaram: a pessoa não pode mexer nesse dado
  if (codigo === "42501" || texto.includes("row-level security") || texto.includes("not authorized")) {
    return criar("permissao_negada", "Você não tem permissão para fazer esta alteração.");
  }

  if (codigo === "23505") {
    return criar("registro_duplicado", "Este registro já existe.");
  }

  if (codigo === "23503") {
    return criar("registro_em_uso", "Este item está ligado a outros dados e não pode ser alterado ou removido.");
  }

  if (codigo === "23514") {
    return criar("valor_invalido", "Algum valor não é permitido (por exemplo, preço menor ou igual a zero ou estoque negativo).");
  }

  if (texto.includes("bucket not found")) {
    return criar("armazenamento_indisponivel", "O local de armazenamento das fotos não foi encontrado. Fale com a equipe do projeto.");
  }

  // Falha de rede (sem internet, servidor fora do ar) ou erro do servidor (500 ou mais)
  const semConexao =
    erro?.name === "AuthRetryableFetchError" ||
    status === 0 ||
    status >= 500 ||
    texto.includes("failed to fetch") ||
    texto.includes("networkerror") ||
    texto.includes("load failed");
  if (semConexao) {
    return criar("sem_conexao", MENSAGEM_DE_CONEXAO);
  }

  return criar("erro_desconhecido", mensagemPadrao);
}