// Fala com o Storage do Supabase: envia e apaga as fotos dos produtos (RF-19, RN-12).
// As fotos ficam no bucket público "produtos", em pastas por loja: {loja_id}/{produto_id}/{uuid}.{extensão}
// (o 02_rls.sql só deixa a dona da loja mexer na pasta com o id da própria loja).
import { exigirSupabase } from "../supabaseClient.js";
import { ErroApp } from "../modelos/ErroApp.js";
import { paraErroApp } from "./errosSupabase.js";
import { reduzirFoto } from "../ui/imagem.js";

const BUCKET_DAS_FOTOS = "produtos";
export const TAMANHO_MAXIMO_DA_FOTO_EM_BYTES = 2 * 1024 * 1024; // 2 MB (RN-12)

// A extensão vem do TIPO do arquivo (e não do nome), então um "foto.php" com tipo image/png vira ".png"
const EXTENSOES_ACEITAS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Confere o formato e o tamanho. Devolve o motivo da recusa em texto, ou "" se o arquivo está bom.
// A tela usa isto assim que a lojista escolhe os arquivos; o enviarFoto usa de novo antes de enviar.
export function validarArquivoDeFoto(arquivo) {
  if (!arquivo || !EXTENSOES_ACEITAS[arquivo.type]) {
    return "formato não aceito. Use JPG, PNG ou WebP.";
  }
  if (arquivo.size > TAMANHO_MAXIMO_DA_FOTO_EM_BYTES) {
    return "a foto tem mais de 2 MB.";
  }
  return "";
}

// RNF-03: reduz a foto para cerca de 200 KB. Se o navegador não conseguir (formato que ele não lê, por exemplo),
// a foto original, que já passou na validação de 2 MB, é enviada do jeito que está.
async function prepararFoto(arquivo) {
  try {
    return await reduzirFoto(arquivo);
  } catch (erro) {
    console.warn("Não foi possível reduzir a foto; enviando a original.", erro);
    return arquivo;
  }
}

// Envia uma foto e devolve { url, caminho }. O "caminho" é guardado em produto_fotos para podermos apagar o arquivo depois.
export async function enviarFoto(arquivo, lojaId, produtoId) {
  const nome = arquivo?.name ?? "foto";

  try {
    const motivo = validarArquivoDeFoto(arquivo);
    if (motivo) {
      throw new ErroApp("foto_invalida", 'A foto "' + nome + '": ' + motivo);
    }

    const supabase = exigirSupabase();
    const arquivoFinal = await prepararFoto(arquivo);
    // O nome do arquivo é um uuid novo: nunca se repete e não depende do nome que a lojista deu
    const caminho = lojaId + "/" + produtoId + "/" + crypto.randomUUID() + "." + EXTENSOES_ACEITAS[arquivoFinal.type];

    const { error } = await supabase.storage.from(BUCKET_DAS_FOTOS).upload(caminho, arquivoFinal, {
      contentType: arquivoFinal.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from(BUCKET_DAS_FOTOS).getPublicUrl(caminho);
    return { url: data.publicUrl, caminho };
  } catch (erro) {
    if (erro instanceof ErroApp && erro.codigo === "foto_invalida") {
      throw erro;
    }
    // O código "erro_ao_enviar_foto" avisa a tela de que ela pode oferecer o endereço (URL) da imagem como alternativa
    throw new ErroApp(
      "erro_ao_enviar_foto",
      'Não foi possível enviar a foto "' + nome + '". Tente de novo ou informe o endereço (URL) de uma imagem.',
      erro
    );
  }
}

// Apaga um arquivo do Storage.
export async function removerFoto(caminho) {
  await removerFotos([caminho]);
}

// Apaga vários arquivos de uma vez.
export async function removerFotos(caminhos) {
  if (caminhos.length === 0) {
    return;
  }
  try {
    const supabase = exigirSupabase();
    const { error } = await supabase.storage.from(BUCKET_DAS_FOTOS).remove(caminhos);
    if (error) {
      throw error;
    }
  } catch (erro) {
    throw paraErroApp(erro, "Não foi possível apagar as fotos do armazenamento.");
  }
}

// "Melhor esforço": tenta apagar e, se não der, só avisa no console. Usada na limpeza depois de uma exclusão
// ou de uma falha, quando um arquivo sobrando é só desperdício de espaço e não deve travar a lojista.
export async function tentarRemoverFotos(caminhos) {
  try {
    await removerFotos(caminhos);
    return true;
  } catch (erro) {
    console.warn("Não foi possível apagar fotos do Storage:", caminhos, erro.cause ?? erro);
    return false;
  }
}