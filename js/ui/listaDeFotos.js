// Lista de fotos do formulário do produto (RF-19, RN-12): pré-visualização, "Capa" na primeira,
// botões para mover e remover. A ordem da lista é a ordem das fotos; a primeira é a capa.
// Esta lista só cuida da tela. Enviar para o Storage e gravar no banco é com o produtoServico.
import { MAXIMO_DE_FOTOS } from "../modelos/Produto.js";
import { validarArquivoDeFoto } from "../servicos/storageServico.js";

// Opções:
//   elementoLista: o <ul> onde as fotos aparecem
//   elementoAnuncio: um texto com aria-live, onde avisamos os leitores de tela do que mudou
//   elementoFocoSeVazia: para onde o foco vai quando a última foto é removida
//   aoMudar: função chamada sempre que a lista muda
export function criarListaDeFotos({ elementoLista, elementoAnuncio, elementoFocoSeVazia, aoMudar = () => {} }) {
  // Cada item: { chave, origem, id, url, caminho, arquivo, previa, nome }
  //   origem "salva": já estava no banco (tem id, url e talvez caminho)
  //   origem "arquivo": arquivo escolhido agora, ainda não enviado
  //   origem "endereco": endereço (URL) de imagem informado à mão
  let itens = [];
  // Depois de redesenhar a lista, o foco do teclado volta para o botão que a pessoa acabou de usar
  let focoPendente = null;

  function anunciar(texto) {
    elementoAnuncio.textContent = texto;
  }

  function descreverPosicao(indice) {
    return indice === 0 ? "foto 1, a capa" : "foto " + (indice + 1);
  }

  function criarBotao(texto, complemento, acao, desabilitado, aoClicar) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "botao botao-secundario botao-pequeno";
    botao.dataset.acao = acao;
    botao.disabled = desabilitado;
    if (acao === "remover") {
      botao.classList.remove("botao-secundario");
      botao.classList.add("botao-perigo");
    }
    botao.append(texto);

    // O texto escondido diz de qual foto é o botão: o leitor de tela lê "Mover para cima (foto 2)"
    const oculto = document.createElement("span");
    oculto.className = "visualmente-oculto";
    oculto.textContent = " (" + complemento + ")";
    botao.append(oculto);

    botao.addEventListener("click", aoClicar);
    return botao;
  }

  function descreverOrigem(item) {
    if (item.origem === "salva") {
      return "Foto já salva";
    }
    if (item.origem === "arquivo") {
      return item.nome + " (nova: será enviada ao salvar)";
    }
    return "Endereço informado: " + item.nome;
  }

  function desenhar() {
    const linhas = itens.map((item, indice) => {
      const li = document.createElement("li");
      li.className = "foto-gerenciar";
      li.dataset.chave = item.chave;

      const imagem = document.createElement("img");
      imagem.src = item.previa ?? item.url;
      imagem.alt = "Pré-visualização da " + descreverPosicao(indice);
      imagem.width = 600;
      imagem.height = 750;

      const corpo = document.createElement("div");
      const titulo = document.createElement("p");
      const numero = document.createElement("strong");
      numero.textContent = "Foto " + (indice + 1);
      titulo.append(numero);
      if (indice === 0) {
        const capa = document.createElement("span");
        capa.className = "selo selo-atualizado";
        capa.textContent = "Capa";
        titulo.append(" ", capa);
      }

      // textContent: o nome do arquivo e o endereço vêm de fora, então nunca entram como HTML
      const detalhe = document.createElement("p");
      detalhe.className = "texto-suave";
      detalhe.textContent = descreverOrigem(item);

      const acoes = document.createElement("div");
      acoes.className = "foto-gerenciar-acoes";
      const posicao = "foto " + (indice + 1);
      acoes.append(
        criarBotao("Mover para cima", posicao, "subir", indice === 0, () => mover(item.chave, -1, "subir")),
        criarBotao("Mover para baixo", posicao, "descer", indice === itens.length - 1, () => mover(item.chave, 1, "descer")),
        criarBotao("Remover", posicao, "remover", false, () => remover(item.chave))
      );

      corpo.append(titulo, detalhe, acoes);
      li.append(imagem, corpo);
      return li;
    });

    elementoLista.replaceChildren(...linhas);
    restaurarFoco();
  }

  function restaurarFoco() {
    if (!focoPendente) {
      return;
    }
    const pendente = focoPendente;
    focoPendente = null;

    if (pendente.chave) {
      const li = elementoLista.querySelector('[data-chave="' + pendente.chave + '"]');
      let alvo = li?.querySelector('[data-acao="' + pendente.acao + '"]');
      // Se o botão ficou desabilitado (a foto chegou ao começo ou ao fim), o foco vai para o outro botão de mover
      if (!alvo || alvo.disabled) {
        alvo = li?.querySelector("button:not(:disabled)");
      }
      alvo?.focus();
      return;
    }

    // Depois de remover: foco no "Remover" da foto que ocupou o lugar, ou da última, ou no campo de arquivo
    const botoes = elementoLista.querySelectorAll('[data-acao="remover"]');
    const alvo = botoes[Math.min(pendente.indice, botoes.length - 1)];
    (alvo ?? elementoFocoSeVazia)?.focus();
  }

  function mover(chave, deslocamento, acao) {
    const indice = itens.findIndex((item) => item.chave === chave);
    const destino = indice + deslocamento;
    if (indice < 0 || destino < 0 || destino >= itens.length) {
      return;
    }

    [itens[indice], itens[destino]] = [itens[destino], itens[indice]];
    focoPendente = { chave, acao };
    desenhar();
    anunciar("Foto movida: agora é a " + descreverPosicao(destino) + ".");
    aoMudar();
  }

  function remover(chave) {
    const indice = itens.findIndex((item) => item.chave === chave);
    if (indice < 0) {
      return;
    }

    const [removido] = itens.splice(indice, 1);
    if (removido.previa) {
      URL.revokeObjectURL(removido.previa); // libera a memória da pré-visualização
    }
    focoPendente = { indice };
    desenhar();
    anunciar("Foto removida. Restam " + itens.length + " de " + MAXIMO_DE_FOTOS + " fotos.");
    aoMudar();
  }

  return {
    // Fotos que já estão no banco (ao editar um produto). Devem vir na ordem certa.
    carregarSalvas(fotos) {
      itens = fotos.map((foto) => ({
        chave: crypto.randomUUID(),
        origem: "salva",
        id: foto.id,
        url: foto.url,
        caminho: foto.caminho ?? null,
        nome: foto.url,
      }));
      desenhar();
      aoMudar();
    },

    // Acrescenta arquivos escolhidos. O que for recusado NÃO tira as fotos que já estavam na lista.
    // Devolve a lista de mensagens de problema (vazia quando todos os arquivos foram aceitos).
    adicionarArquivos(arquivos) {
      const problemas = [];
      const semEspaco = [];

      for (const arquivo of Array.from(arquivos)) {
        const motivo = validarArquivoDeFoto(arquivo);
        if (motivo) {
          problemas.push('"' + arquivo.name + '": ' + motivo);
        } else if (itens.length >= MAXIMO_DE_FOTOS) {
          semEspaco.push(arquivo.name);
        } else {
          itens.push({
            chave: crypto.randomUUID(),
            origem: "arquivo",
            arquivo,
            previa: URL.createObjectURL(arquivo),
            nome: arquivo.name,
          });
        }
      }

      // RN-12: a 6ª foto (e as seguintes) são recusadas, mas as 5 primeiras ficam
      if (semEspaco.length > 0) {
        problemas.push(
          "Cada produto pode ter no máximo " + MAXIMO_DE_FOTOS + " fotos. " +
            (semEspaco.length === 1 ? 'A foto "' + semEspaco[0] + '" não foi adicionada.' : semEspaco.length + " fotos não foram adicionadas.")
        );
      }

      desenhar();
      anunciar(problemas.length === 0 ? "Fotos adicionadas. Agora são " + itens.length + "." : "Algumas fotos não foram adicionadas.");
      aoMudar();
      return problemas;
    },

    // Acrescenta uma imagem pelo endereço (URL). Devolve a mensagem de erro, ou "" se deu certo.
    adicionarEndereco(texto) {
      const endereco = String(texto ?? "").trim();
      if (endereco === "") {
        return "Informe o endereço (URL) da imagem.";
      }

      let url;
      try {
        url = new URL(endereco);
      } catch (erro) {
        return "Este endereço não é válido. Ele deve começar com http:// ou https://.";
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "O endereço deve começar com http:// ou https://.";
      }
      if (itens.length >= MAXIMO_DE_FOTOS) {
        return "Cada produto pode ter no máximo " + MAXIMO_DE_FOTOS + " fotos.";
      }

      itens.push({ chave: crypto.randomUUID(), origem: "endereco", url: endereco, nome: url.hostname });
      desenhar();
      anunciar("Foto adicionada pelo endereço. Agora são " + itens.length + ".");
      aoMudar();
      return "";
    },

    // As fotos na ordem final, no formato que o produtoServico espera:
    //   { id, url, caminho } (já salva), { url } (endereço) ou { arquivo } (arquivo novo)
    obterParaSalvar() {
      return itens.map((item) => {
        if (item.origem === "salva") {
          return { id: item.id, url: item.url, caminho: item.caminho };
        }
        return item.origem === "arquivo" ? { arquivo: item.arquivo } : { url: item.url };
      });
    },

    quantidade() {
      return itens.length;
    },
  };
}