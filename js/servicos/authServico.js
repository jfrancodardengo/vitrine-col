// Cadastro, login, logout e "quem está logada". Devolve dados ou lança ErroApp com mensagem em português.
import { exigirSupabase, configuracaoDeExemplo } from "../supabaseClient.js";
import { ErroApp } from "../modelos/ErroApp.js";
import { Cliente } from "../modelos/Cliente.js";
import { Lojista } from "../modelos/Lojista.js";
import { paraErroApp, erroDeEmailJaCadastrado } from "./errosSupabase.js";
import { normalizarTelefone, telefoneValido } from "../ui/formatadores.js";
import { tentarRemoverFotos } from "./storageServico.js";

const SENHA_MINIMA = 6;
const FORMATO_DE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- Validação ----------
// As páginas usam estas funções para mostrar o erro ao lado de cada campo, e os serviços
// usam de novo antes de falar com o Supabase. Assim a regra existe num lugar só.
// Devolvem um objeto { campo: "mensagem" }; objeto vazio quer dizer que está tudo certo.

export function validarCadastro({ nome, email, senha, tipo, telefone }) {
  const erros = {};

  if (String(nome ?? "").trim() === "") {
    erros.nome = "Informe o seu nome.";
  }
  if (!FORMATO_DE_EMAIL.test(String(email ?? "").trim())) {
    erros.email = "Informe um e-mail válido, por exemplo nome@email.com.";
  }
  if (String(senha ?? "").length < SENHA_MINIMA) {
    erros.senha = "A senha deve ter pelo menos " + SENHA_MINIMA + " caracteres.";
  }
  if (tipo !== "cliente" && tipo !== "lojista") {
    erros.tipo = "Escolha se você é cliente ou lojista.";
  }

  // O telefone é opcional; se foi preenchido, precisa ter DDD e número (RN-10)
  const textoDoTelefone = String(telefone ?? "").trim();
  if (textoDoTelefone !== "" && !telefoneValido(normalizarTelefone(textoDoTelefone))) {
    erros.telefone = "Telefone inválido. Informe o DDD e o número, por exemplo 27 99999-9999.";
  }

  return erros;
}

export function validarEntrada({ email, senha }) {
  const erros = {};

  if (!FORMATO_DE_EMAIL.test(String(email ?? "").trim())) {
    erros.email = "Informe um e-mail válido, por exemplo nome@email.com.";
  }
  if (String(senha ?? "") === "") {
    erros.senha = "Informe a sua senha.";
  }

  return erros;
}

// RF-24: o e-mail do pedido de redefinição de senha
export function validarEmailDeRecuperacao({ email }) {
  const erros = {};
  if (!FORMATO_DE_EMAIL.test(String(email ?? "").trim())) {
    erros.email = "Informe um e-mail válido, por exemplo nome@email.com.";
  }
  return erros;
}

// RF-24: a nova senha e a confirmação digitada de novo
export function validarNovaSenha({ senha, confirmacao }) {
  const erros = {};
  if (String(senha ?? "").length < SENHA_MINIMA) {
    erros.senha = "A senha deve ter pelo menos " + SENHA_MINIMA + " caracteres.";
  }
  if (String(confirmacao ?? "") !== String(senha ?? "")) {
    erros.confirmacao = "As senhas não são iguais.";
  }
  return erros;
}

// ---------- Cadastro, login e logout ----------

// Cria a conta. O perfil (cliente ou lojista) é gravado pelo gatilho do banco, a partir de "data" (RN-11).
// Devolve { usuaria, precisaConfirmarEmail }:
//  - normalmente a usuária já entra logada e "usuaria" vem preenchida;
//  - se o projeto exigir confirmação de e-mail, "usuaria" é null e "precisaConfirmarEmail" é true.
export async function cadastrar({ nome, email, senha, tipo, telefone = "" }) {
  try {
    ErroApp.lancarSeHouverErros(validarCadastro({ nome, email, senha, tipo, telefone }));
    const supabase = exigirSupabase();

    // O gatilho do banco guarda só os dígitos do telefone; aqui já mandamos com o código 55 (RN-10)
    const dados = { nome: nome.trim(), tipo };
    const telefoneNormalizado = normalizarTelefone(telefone);
    if (telefoneNormalizado !== "") {
      dados.telefone = telefoneNormalizado;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: dados },
    });
    if (error) {
      throw error;
    }

    // Com a confirmação de e-mail ligada, o Supabase não dá erro para um e-mail repetido:
    // devolve um usuário sem "identities". Tratamos esse caso como e-mail já cadastrado.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw erroDeEmailJaCadastrado();
    }

    if (!data.session) {
      return { usuaria: null, precisaConfirmarEmail: true };
    }
    return { usuaria: await usuariaAtual(), precisaConfirmarEmail: false };
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível criar a conta. Tente novamente em instantes.");
  }
}

// Faz o login e devolve a usuária (Cliente ou Lojista).
export async function entrar(email, senha) {
  try {
    ErroApp.lancarSeHouverErros(validarEntrada({ email, senha }));
    const supabase = exigirSupabase();

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) {
      throw error;
    }
    return await usuariaAtual();
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível entrar. Tente novamente em instantes.");
  }
}

export async function sair() {
  try {
    const supabase = exigirSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    usuariaEmCache = null;
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível sair da conta. Tente novamente.");
  }
}

// ---------- Quem está logada ----------

// Guarda a usuária já consultada. Várias partes da mesma página (cabeçalho, proteção) perguntam
// "quem está logada?"; com este cache a tabela perfis é consultada uma vez só por usuária.
let usuariaEmCache = null; // { id, promessa }

// Monta um Cliente ou um Lojista conforme o perfil gravado no banco (polimorfismo).
async function buscarUsuaria(supabase, usuario) {
  const { data, error } = await supabase.from("perfis").select("nome, tipo").eq("id", usuario.id).maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new ErroApp("perfil_nao_encontrado", "Não encontramos o perfil desta conta. Fale com a equipe do projeto.");
  }

  const dadosDaUsuaria = { id: usuario.id, nome: data.nome, email: usuario.email };
  return data.tipo === "lojista" ? new Lojista(dadosDaUsuaria) : new Cliente(dadosDaUsuaria);
}

// Devolve um objeto Cliente ou Lojista, ou null se ninguém estiver logada.
export async function usuariaAtual() {
  try {
    // Sem o Supabase configurado não existe login possível: é como uma visitante
    if (configuracaoDeExemplo) {
      return null;
    }
    const supabase = exigirSupabase();

    // getSession lê a sessão guardada no navegador (não vai à internet)
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }

    const usuario = data.session?.user;
    if (!usuario) {
      usuariaEmCache = null;
      return null;
    }

    if (!usuariaEmCache || usuariaEmCache.id !== usuario.id) {
      usuariaEmCache = { id: usuario.id, promessa: buscarUsuaria(supabase, usuario) };
    }

    try {
      return await usuariaEmCache.promessa;
    } catch (erro) {
      usuariaEmCache = null; // não guarda a falha: da próxima vez tenta de novo
      throw erro;
    }
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível verificar o seu login. Tente novamente em instantes.");
  }
}

// Avisa (chamando "callback") quando a usuária entra ou sai, inclusive em outra aba do navegador.
// O callback recebe a usuária (Cliente ou Lojista) ou null. Devolve uma função para parar de observar.
export function observarSessao(callback) {
  if (configuracaoDeExemplo) {
    return () => { };
  }

  try {
    const supabase = exigirSupabase();

    const { data } = supabase.auth.onAuthStateChange((evento) => {
      // INITIAL_SESSION e TOKEN_REFRESHED não mudam quem está logada
      if (evento === "INITIAL_SESSION" || evento === "TOKEN_REFRESHED") {
        return;
      }

      // setTimeout: o Supabase pede para não chamá-lo de dentro deste callback, senão pode travar
      setTimeout(async () => {
        try {
          callback(await usuariaAtual());
        } catch (erro) {
          callback(null);
        }
      }, 0);
    });

    return () => data.subscription.unsubscribe();
  } catch (erro) {
    return () => { };
  }
}

// ---------- Esqueci minha senha (RF-24) ----------

// Pede ao Supabase que envie à pessoa um e-mail com o link para criar uma senha nova.
// O link volta para recuperar-senha.html (o endereço precisa estar liberado em Authentication > URL Configuration).
// Por segurança o Supabase não diz se o e-mail tem conta; por isso a tela mostra sempre a mesma mensagem.
export async function pedirRedefinicaoDeSenha(email) {
  try {
    ErroApp.lancarSeHouverErros(validarEmailDeRecuperacao({ email }));
    const supabase = exigirSupabase();

    // new URL(...) descarta o que houver depois do "?" ou do "#" do endereço atual
    const enderecoDeRetorno = new URL("recuperar-senha.html", location.href).href;
    const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: enderecoDeRetorno });
    if (error) {
      throw error;
    }
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível enviar o e-mail agora. Tente novamente em instantes.");
  }
}

// Quem clica no link do e-mail volta ao site já com uma sessão especial de recuperação, e o Supabase
// avisa com o evento PASSWORD_RECOVERY. Chama "callback" nesse caso. Devolve uma função para parar de observar.
export function aoReceberLinkDeRecuperacao(callback) {
  if (configuracaoDeExemplo) {
    return () => { };
  }
  try {
    const { data } = exigirSupabase().auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") {
        callback();
      }
    });
    return () => data.subscription.unsubscribe();
  } catch (erro) {
    return () => { };
  }
}

// Grava a senha nova da pessoa que chegou pelo link do e-mail.
export async function definirNovaSenha({ senha, confirmacao }) {
  try {
    ErroApp.lancarSeHouverErros(validarNovaSenha({ senha, confirmacao }));
    const { error } = await exigirSupabase().auth.updateUser({ password: senha });
    if (error) {
      throw error;
    }
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível trocar a senha. Peça um novo link e tente de novo.");
  }
}

// ---------- Excluir a própria conta (RF-25) ----------

// Apaga os arquivos de foto da loja da lojista (o banco não alcança o Storage) e depois chama a função
// excluir_minha_conta() do banco (database/04_melhorias.sql), que apaga pedidos, loja, produtos, perfil e a conta.
// Se alguma foto não puder ser apagada, a exclusão da conta continua: foto sobrando é só espaço ocupado.
export async function excluirMinhaConta() {
  try {
    const usuaria = await usuariaAtual();
    if (!usuaria) {
      throw new ErroApp("exige_login", "Entre na sua conta para excluí-la.");
    }
    const supabase = exigirSupabase();

    if (usuaria instanceof Lojista) {
      const { data: fotos, error: erroDasFotos } = await supabase
        .from("produto_fotos")
        .select("caminho, produtos!inner ( loja_id, lojas!inner ( dono_id ) )")
        .eq("produtos.lojas.dono_id", usuaria.id)
        .not("caminho", "is", null);
      if (erroDasFotos) {
        throw erroDasFotos;
      }
      await tentarRemoverFotos(fotos.map((foto) => foto.caminho));
    }

    const { error } = await supabase.rpc("excluir_minha_conta");
    if (error) {
      throw error;
    }

    // A conta já não existe: só falta descartar a sessão guardada no navegador
    usuariaEmCache = null;
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (erroAoSair) {
      console.warn("Conta excluída; a sessão local será descartada.", erroAoSair);
    }
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível excluir a conta. Tente novamente em instantes.");
  }
}