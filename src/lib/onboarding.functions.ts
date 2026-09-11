import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  RITMO_SUGERIDO,
  TOTAL_PASSOS,
  diretrizesDeRespostas,
  focoDeObjetivos,
  normalizarHandle,
  tomDeVoz,
  validarPasso,
  type Respostas,
} from "@/lib/onboarding-perguntas";

/**
 * Quantas referências entram na primeira coleta imediata.
 *
 * Cada worker do curador consome uma execução do Apify. Três já garantem
 * conteúdo na tela quando o usuário termina de ler o manual; o resto entra no
 * cron diário sem custo extra agora.
 */
const REFERENCIAS_PRIMEIRA_COLETA = 3;

async function contaDoUsuario(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string> {
  const { data: membro } = await supabase
    .from("conta_membros")
    .select("conta_id")
    .eq("user_id", userId)
    .order("criado_em")
    .limit(1)
    .maybeSingle();
  if (!membro?.conta_id) {
    throw new Error("Seu usuário ainda não está vinculado a uma conta.");
  }
  return membro.conta_id as string;
}

/** Estado do wizard para a conta do usuário logado. */
export const getOnboarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: membro } = await context.supabase
      .from("conta_membros")
      .select("conta_id")
      .eq("user_id", context.userId)
      .order("criado_em")
      .limit(1)
      .maybeSingle();

    if (!membro?.conta_id) {
      return { contaId: null, respostas: {} as Respostas, passoAtual: 1, concluido: false, perfilId: null };
    }

    const { data } = await context.supabase
      .from("onboarding_respostas")
      .select("respostas, passo_atual, concluido_em, perfil_id")
      .eq("conta_id", membro.conta_id)
      .maybeSingle();

    return {
      contaId: membro.conta_id as string,
      respostas: (data?.respostas ?? {}) as Respostas,
      passoAtual: data?.passo_atual ?? 1,
      concluido: Boolean(data?.concluido_em),
      perfilId: (data?.perfil_id ?? null) as string | null,
    };
  });

/** Grava o progresso parcial. Chamado ao avançar cada passo. */
export const salvarPasso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { passo: number; respostas: Respostas }) => data)
  .handler(async ({ data, context }) => {
    const contaId = await contaDoUsuario(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const erros = validarPasso(data.passo, data.respostas);
    if (erros.length) throw new Error(erros[0]);

    const { data: existente } = await admin
      .from("onboarding_respostas")
      .select("id, passo_atual, concluido_em")
      .eq("conta_id", contaId)
      .maybeSingle();

    if (existente?.concluido_em) return { concluido: true };

    const proximo = Math.min(TOTAL_PASSOS, Math.max(existente?.passo_atual ?? 1, data.passo + 1));

    if (existente) {
      const { error } = await admin
        .from("onboarding_respostas")
        .update({
          respostas: data.respostas,
          passo_atual: proximo,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", existente.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("onboarding_respostas").insert({
        conta_id: contaId,
        respostas: data.respostas,
        passo_atual: proximo,
      });
      if (error) throw new Error(error.message);
    }

    return { concluido: false, passoAtual: proximo };
  });

/**
 * Fecha o onboarding: grava o perfil, cria as referências, marca como
 * concluído, gera o manual de marca e dispara a primeira coleta.
 *
 * O manual é aguardado (a tela de processamento depende dele). A coleta não é:
 * roda em segundo plano enquanto o usuário lê o relatório.
 */
export const concluirOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { respostas: Respostas }) => data)
  .handler(async ({ data, context }) => {
    const contaId = await contaDoUsuario(context.supabase as any, context.userId);
    const respostas = data.respostas;

    for (let passo = 1; passo <= TOTAL_PASSOS; passo++) {
      const erros = validarPasso(passo, respostas);
      if (erros.length) throw new Error(erros[0]);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { invocarAgente, dispararCuradoria } = await import("@/lib/agentes.server");
    const admin = supabaseAdmin as any;

    const { data: registro } = await admin
      .from("onboarding_respostas")
      .select("id, perfil_id, concluido_em")
      .eq("conta_id", contaId)
      .maybeSingle();

    // Já concluído: devolve o manual existente em vez de duplicar perfil.
    if (registro?.concluido_em) {
      const { data: relatorio } = await admin
        .from("dna_relatorios")
        .select("id")
        .eq("conta_id", contaId)
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();
      return {
        perfilId: registro.perfil_id as string | null,
        relatorioId: (relatorio?.id ?? null) as string | null,
        erroRelatorio: null as string | null,
      };
    }

    // ---- Perfil ----
    // O ritmo é o compromisso do passo 5. Dias fora de 0–6 ou lista vazia caem no
    // padrão: a restrição do banco recusaria, e o wizard não pode travar por isso.
    const diasEscolhidos = [...new Set(respostas.ritmo_dias ?? [])]
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      .sort((a, b) => a - b);

    const camposPerfil = {
      nome: respostas.nome!.trim(),
      tom_de_voz: tomDeVoz(respostas) || null,
      foco_curadoria: focoDeObjetivos(respostas.objetivos),
      diretrizes: diretrizesDeRespostas(respostas),
      ritmo_dias: diasEscolhidos.length ? diasEscolhidos : RITMO_SUGERIDO,
      conta_id: contaId,
    };

    let perfilId = registro?.perfil_id as string | null;
    if (perfilId) {
      const { error } = await admin.from("perfis").update(camposPerfil).eq("id", perfilId);
      if (error) throw new Error(error.message);
    } else {
      const { data: criado, error } = await admin
        .from("perfis")
        .insert({ ...camposPerfil, tipo: "cliente", ativo: true })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      perfilId = criado.id as string;
    }

    // ---- Referências: as informadas mais o catálogo da área ----
    const { data: conta } = await admin
      .from("contas")
      .select("plano_codigo, planos:planos(limite_referencias)")
      .eq("id", contaId)
      .maybeSingle();
    const limiteRefs = Number(conta?.planos?.limite_referencias ?? 3);

    const informados = Array.from(
      new Set((respostas.referencias ?? []).map(normalizarHandle).filter(Boolean)),
    );

    const { data: sugeridas } = await admin
      .from("referencias_sugeridas")
      .select("handle")
      .eq("area_atuacao", respostas.area_atuacao ?? "")
      .eq("ativo", true)
      .order("ordem");

    const complementares = (sugeridas ?? [])
      .map((s: { handle: string }) => normalizarHandle(s.handle))
      .filter((h: string) => h && !informados.includes(h));

    const { data: jaExistem } = await admin
      .from("perfis_referencia")
      .select("handle")
      .eq("conta_id", contaId);
    const existentes = new Set(
      (jaExistem ?? []).map((r: { handle: string }) => normalizarHandle(r.handle)),
    );

    const aInserir = [...informados, ...complementares]
      .filter((h) => !existentes.has(h))
      .slice(0, Math.max(0, limiteRefs - existentes.size));

    let idsParaColeta: string[] = [];
    if (aInserir.length) {
      const { data: inseridas, error } = await admin
        .from("perfis_referencia")
        .insert(
          aInserir.map((handle) => ({
            handle,
            perfil_id_relacionado: perfilId,
            conta_id: contaId,
            ativo: true,
          })),
        )
        .select("id, handle");
      if (error) throw new Error(error.message);

      // Prioriza os perfis que o próprio usuário indicou na primeira coleta.
      const ordenadas = (inseridas ?? []).sort(
        (a: { handle: string }, b: { handle: string }) =>
          informados.indexOf(a.handle) - informados.indexOf(b.handle),
      );
      idsParaColeta = ordenadas
        .slice(0, REFERENCIAS_PRIMEIRA_COLETA)
        .map((r: { id: string }) => r.id);
    }

    // ---- Fecha o wizard antes de gerar o manual ----
    // Se o dna-agent falhar, o usuário não volta a ficar preso no onboarding.
    const marcar = {
      respostas,
      perfil_id: perfilId,
      passo_atual: TOTAL_PASSOS,
      concluido_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    if (registro) {
      await admin.from("onboarding_respostas").update(marcar).eq("id", registro.id);
    } else {
      await admin.from("onboarding_respostas").insert({ conta_id: contaId, ...marcar });
    }

    // ---- Primeira coleta, em segundo plano ----
    // Sai antes do manual para as duas coisas correrem em paralelo: quando o
    // usuário terminar de ler o relatório, a curadoria já tem conteúdo.
    if (idsParaColeta.length) dispararCuradoria(idsParaColeta);

    // ---- Manual de marca ----
    const resposta = await invocarAgente<{ relatorio_id?: string }>(
      "dna-agent",
      { conta_id: contaId, perfil_id: perfilId },
      { timeoutMs: 150_000 },
    );

    return {
      perfilId,
      relatorioId: (resposta.data?.relatorio_id ?? null) as string | null,
      erroRelatorio: resposta.ok ? null : resposta.erro,
    };
  });

/** Regera o manual a partir das respostas já gravadas. */
export const regerarDna = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const contaId = await contaDoUsuario(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { invocarAgente } = await import("@/lib/agentes.server");
    const admin = supabaseAdmin as any;

    const { data: registro } = await admin
      .from("onboarding_respostas")
      .select("perfil_id")
      .eq("conta_id", contaId)
      .maybeSingle();

    const resposta = await invocarAgente<{ relatorio_id?: string }>(
      "dna-agent",
      { conta_id: contaId, perfil_id: registro?.perfil_id ?? null },
      { timeoutMs: 150_000 },
    );
    if (!resposta.ok) throw new Error(resposta.erro ?? "Não foi possível gerar o manual.");
    return { relatorioId: (resposta.data?.relatorio_id ?? null) as string | null };
  });

/** Última versão do manual de marca da conta. */
export const getDna = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: membro } = await context.supabase
      .from("conta_membros")
      .select("conta_id")
      .eq("user_id", context.userId)
      .order("criado_em")
      .limit(1)
      .maybeSingle();
    if (!membro?.conta_id) return { relatorio: null, perfil: null };

    const { data: relatorio } = await context.supabase
      .from("dna_relatorios")
      .select("id, conteudo, versao, gerado_em, perfil_id")
      .eq("conta_id", membro.conta_id)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!relatorio) return { relatorio: null, perfil: null };

    const { data: perfil } = relatorio.perfil_id
      ? await context.supabase
          .from("perfis")
          .select("nome, tom_de_voz, diretrizes")
          .eq("id", relatorio.perfil_id)
          .maybeSingle()
      : { data: null };

    return { relatorio, perfil };
  });
