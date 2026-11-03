// Lojista também é uma Usuaria (herança), mas a sua página inicial é o painel.
import { Usuaria } from "./Usuaria.js";

export class Lojista extends Usuaria {
  // Mesmo nome de método do Cliente, resposta diferente: isso é polimorfismo.
  rotaInicial() {
    return "painel-loja.html";
  }
}