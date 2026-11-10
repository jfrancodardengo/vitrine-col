// Reduz uma foto no próprio navegador antes do envio (RNF-03: fotos leves, em torno de 200 KB).
// Usa um <canvas> para redesenhar a imagem menor e salvá-la como JPEG. Fica em ui/ porque mexe com o DOM.

export const TAMANHO_ALVO_DA_FOTO_EM_BYTES = 200 * 1024; // 200 KB
const LADO_MAXIMO_EM_PIXELS = 1280; // maior lado da foto: mais que isso só pesa, a tela do celular não mostra
const QUALIDADES_DO_JPEG = [0.85, 0.75, 0.65, 0.55, 0.45];
const FATOR_DE_REDUCAO = 0.75; // se a foto ainda estiver pesada na pior qualidade, diminui o tamanho e tenta de novo
const MAXIMO_DE_REDUCOES = 4;

function carregarImagem(arquivo) {
  return new Promise((resolver, rejeitar) => {
    const endereco = URL.createObjectURL(arquivo);
    const imagem = new Image();
    imagem.onload = () => {
      URL.revokeObjectURL(endereco);
      resolver(imagem);
    };
    imagem.onerror = () => {
      URL.revokeObjectURL(endereco);
      rejeitar(new Error("Não foi possível ler a imagem."));
    };
    imagem.src = endereco;
  });
}

function canvasParaBlob(canvas, qualidade) {
  return new Promise((resolver, rejeitar) => {
    canvas.toBlob(
      (blob) => (blob ? resolver(blob) : rejeitar(new Error("Não foi possível gerar a imagem."))),
      "image/jpeg",
      qualidade
    );
  });
}

// Desenha a imagem no tamanho pedido. O fundo é branco porque JPEG não tem transparência
// (um PNG com fundo transparente ficaria preto sem isso).
function desenhar(imagem, largura, altura) {
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, largura, altura);
  contexto.drawImage(imagem, 0, 0, largura, altura);
  return canvas;
}

// Devolve um File JPEG de até ~200 KB. Se a foto já é pequena, devolve o próprio arquivo, sem recomprimir.
// Se não conseguir reduzir (formato que o navegador não lê, por exemplo), lança um erro: quem chama decide se envia o original.
export async function reduzirFoto(arquivo) {
  const imagem = await carregarImagem(arquivo);
  const ladoMaior = Math.max(imagem.naturalWidth, imagem.naturalHeight);

  if (arquivo.size <= TAMANHO_ALVO_DA_FOTO_EM_BYTES && ladoMaior <= LADO_MAXIMO_EM_PIXELS) {
    return arquivo;
  }

  let escala = Math.min(1, LADO_MAXIMO_EM_PIXELS / ladoMaior);
  let melhor = null;

  for (let tentativa = 0; tentativa <= MAXIMO_DE_REDUCOES; tentativa += 1) {
    const largura = Math.max(1, Math.round(imagem.naturalWidth * escala));
    const altura = Math.max(1, Math.round(imagem.naturalHeight * escala));
    const canvas = desenhar(imagem, largura, altura);

    for (const qualidade of QUALIDADES_DO_JPEG) {
      melhor = await canvasParaBlob(canvas, qualidade);
      if (melhor.size <= TAMANHO_ALVO_DA_FOTO_EM_BYTES) {
        return criarArquivo(melhor, arquivo.name);
      }
    }
    escala *= FATOR_DE_REDUCAO;
  }

  // Não chegou a 200 KB, mas é a menor versão que conseguimos: ainda assim vale mais que o original, se for menor
  return melhor.size < arquivo.size ? criarArquivo(melhor, arquivo.name) : arquivo;
}

function criarArquivo(blob, nomeOriginal) {
  const nomeSemExtensao = String(nomeOriginal ?? "foto").replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], nomeSemExtensao + ".jpg", { type: "image/jpeg" });
}