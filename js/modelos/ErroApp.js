// Erro próprio do sistema. Estende (herda de) Error, então funciona com throw e try/catch normais.
// Ele carrega duas informações:
//   - codigo: uma palavra curta para o programa decidir o que fazer (ex.: "preco_invalido");
//   - mensagemParaUsuaria: o texto em português que pode ser mostrado na tela.
// Assim a página mostra a mensagem certa sem precisar adivinhar o que deu errado.
export class ErroApp extends Error {
  #codigo;
  #mensagemParaUsuaria;

  // "causa" é opcional: guarda o erro original (por exemplo, o do Supabase) para ajudar a depurar.
  constructor(codigo, mensagemParaUsuaria, causa) {
    super(mensagemParaUsuaria, causa ? { cause: causa } : undefined);
    this.name = "ErroApp";
    this.#codigo = codigo;
    this.#mensagemParaUsuaria = mensagemParaUsuaria;
  }

  // Atalho para as validações de formulário: recebe um objeto { campo: "mensagem" }
  // (vazio quando está tudo certo) e, se houver erro, lança um ErroApp com a primeira mensagem.
  static lancarSeHouverErros(erros) {
    const primeiraMensagem = Object.values(erros)[0];
    if (primeiraMensagem) {
      throw new ErroApp("dados_invalidos", primeiraMensagem);
    }
  }

  get codigo() {
    return this.#codigo;
  }

  get mensagemParaUsuaria() {
    return this.#mensagemParaUsuaria;
  }
}