// Cliente é uma Usuaria (herança): já ganha id, nome, email e os getters, sem repetir código.
import { Usuaria } from "./Usuaria.js";

export class Cliente extends Usuaria {
  // Polimorfismo: sobrescreve o método da classe base com a resposta da cliente.
  rotaInicial() {
    return "index.html";
  }
}