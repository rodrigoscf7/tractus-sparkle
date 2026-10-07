// Imagem da capa: um modelo de texto descreve uma cena (em inglês) a partir do
// tema, do ângulo, do título da capa e do perfil; o modelo de imagem fotografa
// essa cena; a foto vai para o bucket carrossel-imagens. O app chama pelo
// servidor (gerarImagemCapa), que já conferiu que o carrossel é da conta.
import {
  callModelo,
  corsHeaders,
  gerarImagemModelo,
  getServiceClient,
  limiteDisponivel,
  requireAgentAuth,
  setCustoContexto,
} from "../_shared/agent-utils.ts";

const BUCKET = "carrossel-imagens";
const IDEIA_MAX = 300;

type Diretrizes = { area_atuacao?: string; nicho?: string; cliente_ideal?: string };
type SlideCopy = { tipo?: string; titulo?: string; corpo?: string };

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Modelo de texto barato que só descreve a cena. */
const MODELO_CENA = "anthropic/claude-haiku-4.5";

const SISTEMA_CENA = `You write the scene description for a photograph that will be the cover image of an Instagram carousel by a Brazilian lawyer.
You receive the carousel topic, angle and cover headline in Portuguese, the lawyer's practice area and audience, and sometimes a request from the lawyer.
Write ONE paragraph in English (max 70 words) describing only what is visible in the photo: a concrete, everyday scene connected to the topic from the client's point of view (places, objects, hands, posture, light).
Rules:
- Describe only visual elements. Never quote, translate or mention the topic, the headline or any words, titles, captions or signs.
- No readable text anywhere: papers and screens are blurred, turned away or out of focus.
- No identifiable faces in close-up; people from behind, out of focus or partially (hands, silhouettes).
- No gavel, scales of justice, courthouse columns or Lady Justice. No luxury, cash, gold or expensive objects.
- If the lawyer made a request, follow it within these rules.
Reply with the paragraph only.`;

/**
 * Primeiro um modelo de texto transforma tema, ângulo e pedido numa cena em
 * inglês. O modelo de imagem nunca recebe frase em português: quando recebia
 * o título da capa, ele desenhava o título na foto.
 */
async function descreverCena(input: {
  tema: string;
  angulo: string;
  tituloCapa: string;
  diretrizes: Diretrizes;
  ideia: string;
}) {
  const dados = [
    `Topic: ${input.tema || "-"}`,
    `Angle: ${input.angulo || "-"}`,
    `Cover headline: ${input.tituloCapa || "-"}`,
    `Practice area: ${texto(input.diretrizes.area_atuacao) || "-"}`,
    `Niche: ${texto(input.diretrizes.nicho) || "-"}`,
    `Audience: ${texto(input.diretrizes.cliente_ideal) || "-"}`,
    `Lawyer's request: ${input.ideia || "(none)"}`,
  ].join("\n");
  const cena = await callModelo(SISTEMA_CENA, dados, 400, { model: MODELO_CENA });
  return cena.replace(/\s+/g, " ").trim();
}

/**
 * As regras fixas evitam o que estraga uma capa jurídica: texto na imagem,
 * rosto de banco de imagem, martelo e balança, e ostentação (vedada pelo
 * Provimento 205/2021 da OAB). A ausência de texto vem no começo e no fim.
 */
function montarPedido(cena: string) {
  return [
    "A realistic editorial photograph with absolutely no text, letters, numbers, captions, titles, banners, logos or watermarks anywhere in the image.",
    "",
    `Scene: ${cena}`,
    "",
    "Style: natural light, shallow depth of field, documentary editorial photography, muted natural colors. Vertical 4:5 framing; main subject in the upper two thirds; the bottom third is a calm, continuous part of the same scene (table surface, floor, wall), never a color band or empty panel.",
    "Avoid: readable papers or screens (keep them blurred or turned away), brand names on devices, identifiable faces in close-up, gavel, scales of justice, courthouse columns, Lady Justice, luxury items, cash.",
    "",
    "Reminder: the image must contain no text of any kind.",
  ].join("\n");
}

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = await requireAgentAuth(req);
  if (authError) return authError;

  const supabase = getServiceClient();

  try {
    const { carrossel_id, ideia } = await req.json();
    if (!carrossel_id) throw new Error("carrossel_id obrigatório");

    const { data: carrossel, error } = await supabase
      .from("carrosseis")
      .select(
        "id, conta_id, perfil_id, status, copy, imagem_capa_path, pautas_geradas:pautas_geradas(tema, angulo), perfis:perfis(diretrizes)",
      )
      .eq("id", carrossel_id)
      .single();
    if (error || !carrossel) throw new Error("Carrossel não encontrado");
    if (carrossel.status !== "pronto") {
      throw new Error("O carrossel ainda não está pronto. Gere o carrossel antes da imagem.");
    }
    const contaId = carrossel.conta_id as string | null;
    if (!contaId) throw new Error("Carrossel sem conta");

    const cota = await limiteDisponivel(contaId, "imagem");
    if (!cota.permitido) {
      return json(
        {
          ok: false,
          error: cota.motivo === "limite_atingido"
            ? "Você usou todas as imagens geradas do mês. Renova no dia 1; enviar uma imagem sua continua liberado."
            : `Não dá para gerar imagem agora (${cota.motivo}).`,
        },
        402,
      );
    }

    const pauta = (carrossel as unknown as { pautas_geradas: { tema?: string; angulo?: string } | null })
      .pautas_geradas;
    const perfil = (carrossel as unknown as { perfis: { diretrizes?: Diretrizes } | null }).perfis;
    const slides = ((carrossel.copy as { slides?: SlideCopy[] } | null)?.slides ?? []);
    const capa = slides.find((s) => s.tipo === "capa" || s.tipo === "hook") ?? slides[0];

    setCustoContexto({
      contaId,
      perfilId: carrossel.perfil_id as string | null,
      agente: "imagem",
      tipo: "imagem",
    });

    const cena = await descreverCena({
      tema: texto(pauta?.tema),
      angulo: texto(pauta?.angulo),
      tituloCapa: texto(capa?.titulo),
      diretrizes: perfil?.diretrizes ?? {},
      ideia: texto(ideia).slice(0, IDEIA_MAX),
    });
    const pedido = montarPedido(cena);

    const { bytes, mimeType } = await gerarImagemModelo(pedido, { proporcao: "4:5" });
    const extensao = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
    const caminho = `${contaId}/${carrossel.id}/${Date.now()}-ia.${extensao}`;

    const { error: erroEnvio } = await supabase.storage
      .from(BUCKET)
      .upload(caminho, bytes, { contentType: mimeType });
    if (erroEnvio) throw new Error(`Falha ao guardar a imagem: ${erroEnvio.message}`);

    const { error: erroAtualiza } = await supabase
      .from("carrosseis")
      .update({ imagem_capa_path: caminho, imagem_capa_foco: 50, imagem_capa_origem: "ia" })
      .eq("id", carrossel.id);
    if (erroAtualiza) {
      await supabase.storage.from(BUCKET).remove([caminho]);
      throw new Error(`Falha ao salvar a imagem no carrossel: ${erroAtualiza.message}`);
    }

    // Só conta na cota o que chegou à capa.
    await supabase.rpc("registrar_uso", { _conta_id: contaId, _tipo: "imagem", _qtd: 1 });

    const anterior = carrossel.imagem_capa_path as string | null;
    if (anterior && anterior !== caminho) {
      await supabase.storage.from(BUCKET).remove([anterior]);
    }

    return json({ ok: true, caminho, cena });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("imagem-agent", msg);
    return json({ ok: false, error: msg }, 500);
  } finally {
    setCustoContexto(null);
  }
});
