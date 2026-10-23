/**
 * Gasto da conta de anúncios do Meta (API de Marketing, leitura).
 *
 * Ambiente: META_ADS_TOKEN (usuário do sistema com ads_read) e
 * META_AD_ACCOUNT_ID (com ou sem o prefixo act_). Sem os dois, nada é lido e o
 * painel fica só com o investimento lançado à mão.
 *
 * Lê o relatório por anúncio e por dia e grava em meta_anuncios_diario. Não
 * lança: quem chama registra o erro e segue com o que já está no banco.
 */

const VERSAO_GRAPH = "v23.0";
const FUSO = "America/Sao_Paulo";

type AnyClient = any;

export function metaAdsConfigurado(): boolean {
  return !!process.env["META_ADS_TOKEN"]?.trim() && !!process.env["META_AD_ACCOUNT_ID"]?.trim();
}

const diaLocal = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: FUSO });

/**
 * Relê o período na API e regrava. Devolve quantas linhas vieram ou o erro.
 * Também registra a tentativa em meta_ads_sincronizacoes.
 */
export async function sincronizarGastoMeta(
  admin: AnyClient,
  dias: number,
): Promise<{ linhas: number; erro: string | null }> {
  const token = process.env["META_ADS_TOKEN"]?.trim();
  const conta = process.env["META_AD_ACCOUNT_ID"]?.trim().replace(/^act_/, "");
  if (!token || !conta) return { linhas: 0, erro: "Conta de anúncios não configurada." };

  const desde = diaLocal(new Date(Date.now() - (dias - 1) * 86_400_000));
  const ate = diaLocal(new Date());
  const linhas: Record<string, unknown>[] = [];
  let erro: string | null = null;

  try {
    const url = new URL(`https://graph.facebook.com/${VERSAO_GRAPH}/act_${conta}/insights`);
    url.searchParams.set("level", "ad");
    url.searchParams.set("time_increment", "1");
    url.searchParams.set("time_range", JSON.stringify({ since: desde, until: ate }));
    url.searchParams.set(
      "fields",
      "date_start,campaign_id,campaign_name,adset_name,ad_id,ad_name,spend,impressions,inline_link_clicks",
    );
    url.searchParams.set("limit", "500");
    url.searchParams.set("access_token", token);

    let proxima: string | null = url.toString();
    let paginas = 0;
    while (proxima && paginas < 40) {
      paginas++;
      const resp = await fetch(proxima, { signal: AbortSignal.timeout(20_000) });
      const corpo = (await resp.json().catch(() => ({}))) as any;
      if (!resp.ok || corpo.error) {
        throw new Error(corpo.error?.message ?? `Meta respondeu ${resp.status}`);
      }
      for (const r of corpo.data ?? []) {
        if (!r.ad_id || !r.date_start) continue;
        linhas.push({
          dia: r.date_start,
          anuncio_id: String(r.ad_id),
          anuncio: r.ad_name ?? null,
          conjunto: r.adset_name ?? null,
          campanha_id: r.campaign_id ?? null,
          campanha: r.campaign_name ?? null,
          gasto_centavos: Math.round(Number(r.spend ?? 0) * 100),
          impressoes: Number(r.impressions ?? 0) || 0,
          cliques_link: Number(r.inline_link_clicks ?? 0) || 0,
          atualizado_em: new Date().toISOString(),
        });
      }
      proxima = corpo.paging?.next ?? null;
    }

    // O período inteiro é regravado: anúncio que deixou de ter gasto num dia
    // revisado pelo Meta não pode ficar com o número antigo.
    await admin.from("meta_anuncios_diario").delete().gte("dia", desde).lte("dia", ate);
    for (let i = 0; i < linhas.length; i += 500) {
      const { error } = await admin
        .from("meta_anuncios_diario")
        .upsert(linhas.slice(i, i + 500), { onConflict: "dia,anuncio_id" });
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    erro = e instanceof Error ? e.message : String(e);
    console.error("meta-ads: falha ao sincronizar", erro);
  }

  await admin
    .from("meta_ads_sincronizacoes")
    .insert({ desde, ate, linhas: erro ? 0 : linhas.length, erro: erro?.slice(0, 500) ?? null });
  return { linhas: erro ? 0 : linhas.length, erro };
}

/**
 * Sincroniza se a última leitura bem-sucedida que cobre o período tiver mais
 * de uma hora. Devolve o estado para o painel mostrar.
 */
export async function garantirGastoMeta(
  admin: AnyClient,
  dias: number,
  forcar = false,
): Promise<{ configurado: boolean; ultimaEm: string | null; erro: string | null }> {
  if (!metaAdsConfigurado()) return { configurado: false, ultimaEm: null, erro: null };

  const desde = diaLocal(new Date(Date.now() - (dias - 1) * 86_400_000));
  const { data: ultima } = await admin
    .from("meta_ads_sincronizacoes")
    .select("criado_em, erro")
    .is("erro", null)
    .lte("desde", desde)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  const recente = ultima && Date.now() - new Date(ultima.criado_em).getTime() < 60 * 60 * 1000;
  if (recente && !forcar) return { configurado: true, ultimaEm: ultima.criado_em, erro: null };

  const r = await sincronizarGastoMeta(admin, dias);
  return {
    configurado: true,
    ultimaEm: r.erro ? (ultima?.criado_em ?? null) : new Date().toISOString(),
    erro: r.erro,
  };
}
