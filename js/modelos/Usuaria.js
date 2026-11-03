// Classe base de quem usa o sistema. Cliente e Lojista herdam dela (herança).
import { ErroApp } from "./ErroApp.js";

export class Usuaria {
  // Campos privados (#): só o código desta classe enxerga. Quem está de fora lê pelos getters.
  #id;
  #nome;
  #email;

  constructor({ id, nome, email }) {
    if (typeof nome !== "string" || nome.trim() === "") {
      throw new ErroApp("nome_invalido", "Informe o nome.");
    }

    this.#id = id;
    this.#nome = nome.trim();
    this.#email = email;
  }

  get id() {
    return this.#id;
  }

  get nome() {
    return this.#nome;
  }

  get email() {
    return this.#email;
  }

  // Polimorfismo: toda usuária tem uma página inicial, mas cada perfil escolhe a sua.
  // Aqui na base não existe resposta certa, então as filhas precisam sobrescrever este método.
  rotaInicial() {
    throw new ErroApp(
      "metodo_nao_implementado",
      "Este perfil ainda não definiu a sua página inicial."
    );
  }
}