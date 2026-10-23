import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/billing.functions";

/**
 * Painel de campanhas do admin: do anúncio à compra.
 *
 * A base é o lead do quiz (oferta_leads), que guarda as UTMs da primeira
 * visita. O funil é por coorte: leads que começaram no período e o que eles
 * fizeram depois, inclusive comprar fora do período. Receita é o que a Hubla
 * aprovou em vendas (renovação fica de fora), sem os juros do parcelamento.
 * O investimento é o gasto lido da conta de anúncios do Meta
 * (meta_anuncios_diario, ligado pelo nome da campanha e do anúncio) somado ao
 * que foi lançado à mão em campanha_investimentos (gasto fora do Meta).
 */

type AnyClient = any;

async function admin(): Promise<AnyClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as AnyClient;
}

const FUSO = "America/Sao_Paulo";
const diaLocal = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: FUSO });

const SEM_ORIGEM = "Sem origem";
const META_SEM_UTM = "Meta · sem UTM";

type Origem = Record<string, string | undefined>;

function campanhaDe(origem: Origem): string {
  if (origem.utm_campaign?.trim()) return origem.utm_campaign.trim();
  if (origem.fbclid) return META_SEM_UTM;
  if (origem.utm_source?.trim()) return `${origem.utm_source.trim()} · sem campanha`;
  return SEM_ORIGEM;
}

const criativoDe = (origem: Origem) => origem.utm_content?.trim() || "Sem criativo";

export type LinhaFunil = {
  nome: string;
  leads: number;
  diagnosticos: number;
  checkouts: number;
  compras: number;
  receitaCentavos: number;
  investimentoCentavos: number;
  /** Do relatório do Meta: zero para o que não veio de anúncio. */
  impressoes: number;
  cliquesLink: number;
};

function linhaVazia(nome: string): LinhaFunil {
  return {
    nome,
    leads: 0,
    diagnosticos: 0,
    checkouts: 0,
    compras: 0,
    receitaCentavos: 0,
    investimentoCentavos: 0,
    impressoes: 0,
    cliquesLink: 0,
  };
}

/** Nome de campanha e de anúncio comparados sem caixa nem espaço nas pontas. */
const chave = (nome: string) => nome.trim().toLowerCase();

export type Alerta = { nivel: "atencao" | "info" | "bom"; texto: string };

export const getPainelCampanhas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { dias?: number; atualizar?: boolean }) => ({
    dias: [7, 14, 30, 90].includes(Number(data?.dias)) ? Number(data.dias) : 30,
    atualizar: data?.atualizar === true,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as any, context.userId);
    const db = await admin();
    const { normalizarEventoHubla } = await import("@/lib/hubla.server");
    const { garantirGastoMeta } = await import("@/lib/meta-ads.server");

    const desde = new Date(Date.now() - data.dias * 86_400_000);
    const desdeIso = desde.toISOString();
    const desdeDia = diaLocal(desdeIso);

    // Relê a conta de anúncios se a última leitura tiver mais de uma hora.
    const metaAds = await garantirGastoMeta(db, data.dias + 1, data.atualizar);

    const [
      { data: leads },
      { data: pagamentos },
      { data: estornos },
      { data: investimentos },
      { data: planos },
      { data: materiais },
      { data: gastoMeta },
    ] = await Promise.all([
      db
        .from("oferta_leads")
        .select(
          "id, token, nome, email, whatsapp, origem, criado_em, relatorio_gerado_em, checkout_clicado_em, comprou_em, conta_id, meta_fbp, meta_fbc, meta_lead_enviado_em",
        )
        .gte("criado_em", desdeIso)
        .order("criado_em", { ascending: false })
        .limit(5000),
      db
        .from("hubla_eventos")
        .select("id, fatura_id, lead_id, conta_id, comprador_email, criado_em, payload")
        .eq("evento", "invoice.payment_succeeded")
        .eq("processado", true)
        .gte("criado_em", desdeIso)
        .limit(5000),
      db
        .from("hubla_eventos")
        .select("evento, fatura_id, criado_em, payload")
        .in("evento", ["invoice.refunded", "invoice.status_updated"])
        .gte("criado_em", desdeIso)
        .limit(2000),
      db
        .from("campanha_investimentos")
        .select("id, dia, campanha, valor_centavos")
        .gte("dia", desdeDia)
        .order("dia", { ascending: false }),
      db.from("planos").select("codigo, hubla_oferta_anual_id"),
      db.from("materiais").select("codigo, nome, hubla_produto_id, hubla_oferta_id"),
      db
        .from("meta_anuncios_diario")
        .select("dia, campanha, anuncio, gasto_centavos, impressoes, cliques_link")
        .gte("dia", desdeDia)
        .limit(20000),
    ]);

    const listaLeads = (leads ?? []) as any[];
    const porId = new Map(listaLeads.map((l) => [l.id, l]));
    const porConta = new Map(listaLeads.filter((l) => l.conta_id).map((l) => [l.conta_id, l]));
    const porEmail = new Map(
      listaLeads.filter((l) => l.email).map((l) => [String(l.email).toLowerCase(), l]),
    );
    const ofertasAnuais = new Set(
      (planos ?? []).map((p: any) => p.hubla_oferta_anual_id).filter(Boolean),
    );

    // ---------- vendas aprovadas (sem renovação e sem evento de teste) ----------
    type Venda = {
      leadId: string | null;
      contaId: string | null;
      dia: string;
      centavos: number;
      anual: boolean;
      materiais: string[];
      temPlano: boolean;
    };
    const vendas: Venda[] = [];
    for (const p of (pagamentos ?? []) as any[]) {
      const fatura = p.payload?.event?.invoice ?? {};
      if (String(p.fatura_id ?? "").endsWith("-tester")) continue;
      if (String(fatura.type ?? "sell") === "renewal") continue;
      const n = normalizarEventoHubla(p.payload ?? {}, null);
      const subtotal = Number(fatura.amount?.subtotalCents);
      const desconto = Number(fatura.amount?.discountCents) || 0;
      const total = Number(fatura.amount?.totalCents) || 0;
      const centavos = Number.isFinite(subtotal) && subtotal > 0 ? subtotal - desconto : total;
      const doMaterial = (materiais ?? [])
        .filter(
          (m: any) =>
            n.oferta_ids.includes(m.hubla_oferta_id) || n.produto_ids.includes(m.hubla_produto_id),
        )
        .map((m: any) => String(m.codigo));
      const lead =
        (p.lead_id && porId.get(p.lead_id)) ||
        (p.conta_id && porConta.get(p.conta_id)) ||
        (p.comprador_email && porEmail.get(String(p.comprador_email).toLowerCase())) ||
        null;
      vendas.push({
        leadId: lead?.id ?? null,
        contaId: p.conta_id ?? null,
        dia: diaLocal(p.criado_em),
        centavos: Math.max(0, centavos),
        anual: n.oferta_ids.some((o) => ofertasAnuais.has(o)) || n.ciclo_meses === 12,
        materiais: doMaterial,
        // Fatura só de material (order bump em aviso próprio) não é venda do plano.
        temPlano: doMaterial.length === 0 || n.produto_ids.length > doMaterial.length,
      });
    }

    const receitaPorLead = new Map<string, number>();
    for (const v of vendas)
      if (v.leadId) receitaPorLead.set(v.leadId, (receitaPorLead.get(v.leadId) ?? 0) + v.centavos);
    const comprou = (l: any) => !!l.comprou_em || receitaPorLead.has(l.id);

    // ---------- funil por campanha e criativo ----------
    const campanhas = new Map<string, LinhaFunil & { criativos: Map<string, LinhaFunil> }>();
    const total = linhaVazia("Total");
    for (const l of listaLeads) {
      const origem = (l.origem ?? {}) as Origem;
      const nomeCampanha = campanhaDe(origem);
      const nomeCriativo = criativoDe(origem);
      if (!campanhas.has(nomeCampanha))
        campanhas.set(nomeCampanha, { ...linhaVazia(nomeCampanha), criativos: new Map() });
      const c = campanhas.get(nomeCampanha)!;
      if (!c.criativos.has(nomeCriativo)) c.criativos.set(nomeCriativo, linhaVazia(nomeCriativo));
      const cr = c.criativos.get(nomeCriativo)!;
      for (const alvo of [total, c, cr]) {
        alvo.leads++;
        if (l.relatorio_gerado_em) alvo.diagnosticos++;
        if (l.checkout_clicado_em) alvo.checkouts++;
        if (comprou(l)) alvo.compras++;
        alvo.receitaCentavos += receitaPorLead.get(l.id) ?? 0;
      }
    }

    // A campanha do anúncio é achada pelo nome, como chega na UTM.
    const nomePorChave = new Map([...campanhas.keys()].map((n) => [chave(n), n]));
    const campanhaPorNome = (nome: string) => {
      const existente = nomePorChave.get(chave(nome));
      if (existente) return campanhas.get(existente)!;
      campanhas.set(nome, { ...linhaVazia(nome), criativos: new Map() });
      nomePorChave.set(chave(nome), nome);
      return campanhas.get(nome)!;
    };

    for (const g of (gastoMeta ?? []) as any[]) {
      const c = campanhaPorNome(String(g.campanha ?? "Campanha sem nome"));
      const nomeAnuncio = String(g.anuncio ?? "Anúncio sem nome");
      let cr = [...c.criativos.values()].find((x) => chave(x.nome) === chave(nomeAnuncio));
      if (!cr) {
        cr = linhaVazia(nomeAnuncio);
        c.criativos.set(nomeAnuncio, cr);
      }
      const gasto = Number(g.gasto_centavos) || 0;
      const impressoes = Number(g.impressoes) || 0;
      const cliques = Number(g.cliques_link) || 0;
      for (const alvo of [total, c, cr]) {
        alvo.investimentoCentavos += gasto;
        alvo.impressoes += impressoes;
        alvo.cliquesLink += cliques;
      }
    }

    // Lançado à mão: gasto fora do Meta, por campanha.
    for (const i of (investimentos ?? []) as any[]) {
      const valor = Number(i.valor_centavos) || 0;
      campanhaPorNome(String(i.campanha)).investimentoCentavos += valor;
      total.investimentoCentavos += valor;
    }

    const linhasCampanha = [...campanhas.values()]
      .map((c) => ({
        ...c,
        criativos: [...c.criativos.values()].sort((a, b) => b.diagnosticos - a.diagnosticos),
      }))
      .sort(
        (a, b) =>
          b.investimentoCentavos - a.investimentoCentavos || b.diagnosticos - a.diagnosticos,
      );

    // ---------- por dia ----------
    const dias: { dia: string; diagnosticos: number; compras: number; investimento: number }[] = [];
    for (let i = data.dias - 1; i >= 0; i--) {
      dias.push({
        dia: diaLocal(new Date(Date.now() - i * 86_400_000).toISOString()),
        diagnosticos: 0,
        compras: 0,
        investimento: 0,
      });
    }
    const indiceDia = new Map(dias.map((d, i) => [d.dia, i]));
    for (const l of listaLeads) {
      if (!l.relatorio_gerado_em) continue;
      const i = indiceDia.get(diaLocal(l.relatorio_gerado_em));
      if (i !== undefined) dias[i]!.diagnosticos++;
    }
    for (const v of vendas) {
      if (!v.temPlano) continue;
      const i = indiceDia.get(v.dia);
      if (i !== undefined) dias[i]!.compras++;
    }
    // Em reais, para o gráfico.
    for (const g of [...((gastoMeta ?? []) as any[]), ...((investimentos ?? []) as any[])]) {
      const i = indiceDia.get(String(g.dia));
      if (i !== undefined)
        dias[i]!.investimento += (Number(g.gasto_centavos ?? g.valor_centavos) || 0) / 100;
    }

    // ---------- oferta ----------
    const vendasPlano = vendas.filter((v) => v.temPlano);
    const contasDoPlano = new Set(vendasPlano.map((v) => v.contaId).filter(Boolean));
    const contasAnuais = new Set(
      vendasPlano
        .filter((v) => v.anual)
        .map((v) => v.contaId)
        .filter(Boolean),
    );
    const oferta = {
      vendas: vendasPlano.length,
      receitaCentavos: vendas.reduce((s, v) => s + v.centavos, 0),
      anual: contasAnuais.size,
      compradores: contasDoPlano.size,
      materiais: ((materiais ?? []) as any[]).map(
        (m): { codigo: string; nome: string; contas: number } => ({
          codigo: String(m.codigo),
          nome: String(m.nome),
          contas: new Set(
            vendas
              .filter((v) => v.materiais.includes(m.codigo))
              .map((v) => v.contaId)
              .filter(Boolean),
          ).size,
        }),
      ),
      reembolsos: ((estornos ?? []) as any[]).filter((e) => {
        if (e.evento === "invoice.refunded") return true;
        return String(e.payload?.event?.invoice?.status ?? "").toLowerCase() === "chargeback";
      }).length,
    };

    // ---------- saúde do rastreamento ----------
    const comEmail = listaLeads.filter((l) => l.relatorio_gerado_em && l.email);
    const rastreio = {
      leads: listaLeads.length,
      comCampanha: listaLeads.filter((l) => (l.origem as Origem)?.utm_campaign).length,
      comClique: listaLeads.filter((l) => (l.origem as Origem)?.fbclid || l.meta_fbc).length,
      comPixel: listaLeads.filter((l) => l.meta_fbp).length,
      diagnosticosComEmail: comEmail.length,
      leadsEnviados: comEmail.filter((l) => l.meta_lead_enviado_em).length,
      vendas: vendasPlano.length,
      vendasComOrigem: vendasPlano.filter(
        (v) => v.leadId && campanhaDe((porId.get(v.leadId)?.origem ?? {}) as Origem) !== SEM_ORIGEM,
      ).length,
      pixel: !!(process.env["META_PIXEL_ID"] ?? process.env["VITE_META_PIXEL_ID"])?.trim(),
      capi: !!process.env["META_CAPI_TOKEN"]?.trim(),
      modoTeste: !!process.env["META_CAPI_TEST_CODE"]?.trim(),
    };

    // ---------- recuperação ----------
    // Quem refez o quiz e comprou por outro diagnóstico (ou já assina) não entra.
    const { data: assinantes } = await db
      .from("assinaturas")
      .select("comprador_email")
      .not("comprador_email", "is", null);
    const emailsCompradores = new Set(
      [
        ...listaLeads.filter(comprou).map((l) => l.email),
        ...((pagamentos ?? []) as any[]).map((p) => p.comprador_email),
        ...((assinantes ?? []) as any[]).map((a) => a.comprador_email),
      ]
        .filter(Boolean)
        .map((e) => String(e).toLowerCase()),
    );
    const recuperar = listaLeads
      .filter((l) => l.relatorio_gerado_em && !comprou(l) && (l.whatsapp || l.email))
      .filter((l) => !l.email || !emailsCompradores.has(String(l.email).toLowerCase()))
      .filter((l) => Date.now() - new Date(l.relatorio_gerado_em).getTime() < 14 * 86_400_000)
      .sort((a, b) => {
        const ca = a.checkout_clicado_em ? 1 : 0;
        const cb = b.checkout_clicado_em ? 1 : 0;
        return (
          cb - ca ||
          new Date(b.relatorio_gerado_em).getTime() - new Date(a.relatorio_gerado_em).getTime()
        );
      })
      .slice(0, 60)
      .map((l) => ({
        id: l.id as string,
        nome: (l.nome as string | null) ?? null,
        email: (l.email as string | null) ?? null,
        whatsapp: (l.whatsapp as string | null) ?? null,
        token: l.token as string,
        campanha: campanhaDe((l.origem ?? {}) as Origem),
        diagnosticoEm: l.relatorio_gerado_em as string,
        checkoutEm: (l.checkout_clicado_em as string | null) ?? null,
      }));

    // ---------- alertas ----------
    const alertas: Alerta[] = [];
    if (rastreio.modoTeste) {
      alertas.push({
        nivel: "atencao",
        texto:
          'Modo de teste ligado: os eventos do servidor vão para "Eventos de teste" e não contam nas campanhas. Apague META_CAPI_TEST_CODE no Railway depois de conferir.',
      });
    }
    if (!rastreio.capi)
      alertas.push({
        nivel: "atencao",
        texto: "META_CAPI_TOKEN não está configurado: Lead e compra não saem pelo servidor.",
      });
    if (!rastreio.pixel)
      alertas.push({
        nivel: "atencao",
        texto: "VITE_META_PIXEL_ID não está configurado: o Pixel não carrega no funil.",
      });
    if (metaAds.erro) {
      alertas.push({
        nivel: "atencao",
        texto: `Não consegui ler a conta de anúncios: ${metaAds.erro}. O gasto mostrado é o da última leitura.`,
      });
    }
    if (rastreio.leads >= 5 && rastreio.comCampanha / rastreio.leads < 0.7) {
      alertas.push({
        nivel: "atencao",
        texto: `${Math.round((1 - rastreio.comCampanha / rastreio.leads) * 100)}% dos leads chegaram sem campanha identificada. Configure os parâmetros de URL nos anúncios (abaixo).`,
      });
    }
    const conversaoMedia = total.diagnosticos ? total.compras / total.diagnosticos : 0;
    for (const c of linhasCampanha) {
      if (c.nome === SEM_ORIGEM) continue;
      if (c.investimentoCentavos >= 5_000 && c.leads === 0) {
        alertas.push({
          nivel: "atencao",
          texto: `${c.nome}: gastou ${brl(c.investimentoCentavos)} e nenhum lead chegou com essa campanha. Confira os parâmetros de URL dos anúncios dela.`,
        });
      }
      if (c.diagnosticos >= 20 && c.compras === 0) {
        alertas.push({
          nivel: "atencao",
          texto: `${c.nome}: ${c.diagnosticos} diagnósticos e nenhuma compra no período.`,
        });
      }
      if (c.investimentoCentavos >= 20_000 && c.receitaCentavos < c.investimentoCentavos) {
        const roas = c.receitaCentavos / c.investimentoCentavos;
        alertas.push({
          nivel: "atencao",
          texto: `${c.nome}: investiu ${brl(c.investimentoCentavos)} e vendeu ${brl(c.receitaCentavos)} (ROAS ${roas.toFixed(2).replace(".", ",")}).`,
        });
      }
      for (const cr of c.criativos) {
        if (cr.diagnosticos >= 10 && cr.compras >= 2 && conversaoMedia > 0) {
          const taxa = cr.compras / cr.diagnosticos;
          if (taxa >= conversaoMedia * 1.5) {
            alertas.push({
              nivel: "bom",
              texto: `Criativo "${cr.nome}" (${c.nome}) converte ${pct(taxa)} dos diagnósticos em compra, ${(taxa / conversaoMedia).toFixed(1).replace(".", ",")}x a média. Vale mais verba.`,
            });
          }
        }
      }
    }
    if (total.checkouts >= 10 && total.compras / total.checkouts < 0.15) {
      alertas.push({
        nivel: "atencao",
        texto: `${total.checkouts} pessoas clicaram em comprar e só ${total.compras} pagaram. Confira o checkout e use a lista de recuperação.`,
      });
    }
    const quentes = recuperar.filter(
      (r) => r.checkoutEm && Date.now() - new Date(r.checkoutEm).getTime() < 7 * 86_400_000,
    ).length;
    if (quentes > 0) {
      alertas.push({
        nivel: "info",
        texto: `${quentes} pessoa(s) clicaram em comprar nos últimos 7 dias e não pagaram. Estão no topo da lista de recuperação.`,
      });
    }

    return {
      dias: data.dias,
      total,
      campanhas: linhasCampanha,
      porDia: dias,
      oferta,
      rastreio,
      recuperar,
      alertas,
      metaAds,
      investimentos: ((investimentos ?? []) as any[]).map((i) => ({
        id: i.id as string,
        dia: i.dia as string,
        campanha: i.campanha as string,
        valorCentavos: Number(i.valor_centavos),
      })),
      campanhasConhecidas: [
        ...new Set(
          listaLeads.map((l) => (l.origem as Origem)?.utm_campaign?.trim()).filter(Boolean),
        ),
      ] as string[],
    };
  });

export type PainelCampanhas = Awaited<ReturnType<typeof getPainelCampanhas>>;

function brl(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

export const salvarInvestimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { dia: string; campanha: string; valorCentavos: number }) => ({
    dia: String(data?.dia ?? "").slice(0, 10),
    campanha: String(data?.campanha ?? "")
      .trim()
      .slice(0, 200),
    valorCentavos: Math.round(Number(data?.valorCentavos)),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as any, context.userId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dia)) throw new Error("Data inválida.");
    if (!data.campanha) throw new Error("Informe a campanha.");
    if (!Number.isFinite(data.valorCentavos) || data.valorCentavos < 0)
      throw new Error("Valor inválido.");
    const db = await admin();
    // O mesmo dia e campanha substitui: corrigir é lançar de novo.
    const { error } = await db.from("campanha_investimentos").upsert(
      {
        dia: data.dia,
        campanha: data.campanha,
        valor_centavos: data.valorCentavos,
        criado_por: context.userId,
      },
      { onConflict: "dia,campanha" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerInvestimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: String(data?.id ?? "") }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as any, context.userId);
    const db = await admin();
    const { error } = await db.from("campanha_investimentos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
