// Funções que transformam valores em texto no padrão brasileiro (RNF-12).
// Criamos o formatador uma vez só; criar um novo a cada chamada seria desperdício.
const formatadorDeMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// 189.9 -> "R$ 189,90"
export function formatarPreco(valor) {
  return formatadorDeMoeda.format(Number(valor));
}

// Deixa só os dígitos de um telefone e, se faltar o código do país, acrescenta o 55 (RN-10).
// "(27) 99999-9999" -> "5527999999999"; "27 3333-4444" -> "552733334444"; "5527999999999" continua igual.
// Com 10 ou 11 dígitos (DDD + número) falta o código do país; com 12 ou 13 já está completo.
// Texto vazio devolve "". A validação (12 ou 13 dígitos) fica por conta de quem chama.
export function normalizarTelefone(texto) {
  const digitos = String(texto ?? "").replace(/\D/g, "");
  return digitos.length === 10 || digitos.length === 11 ? "55" + digitos : digitos;
}

// RN-10: um telefone válido tem só dígitos, com código do país e DDD (12 ou 13 dígitos). Única regra do projeto para isso.
export function telefoneValido(digitos) {
  return /^\d{12,13}$/.test(String(digitos ?? ""));
}

// Monta o link do WhatsApp (RN-10): https://wa.me/<número>?text=<mensagem codificada>.
// O número deve ter só dígitos, com código do país e DDD (12 ou 13 dígitos); senão devolve null (loja sem WhatsApp válido).
// encodeURIComponent transforma espaços, acentos e quebras de linha em %XX, para a mensagem caber no endereço.
export function criarLinkDoWhatsapp(numero, mensagem) {
  const digitos = String(numero ?? "");
  if (!telefoneValido(digitos)) {
    return null;
  }
  return "https://wa.me/" + digitos + "?text=" + encodeURIComponent(mensagem);
}