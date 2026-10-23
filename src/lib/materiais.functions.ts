import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Materiais avulsos (order bumps da Hubla) dentro do app.
 *
 * O catálogo e a liberação ficam em tabelas só de service role; o conteúdo,
 * em materiais.server.ts. A conta vem sempre da sessão. Admin abre todos,
 * para conferir o que o cliente vê.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function contextoDoUsuario(supabase: any, userId: string, claims?: { email?: unknown }) {
  const [{ data: membro }, { data: ehAdmin }] = await Promise.all([
    supabase
      .from("conta_membros")
      .select("conta_id")
      .eq("user_id", userId)
      .order("criado_em")
      .limit(1)
      .maybeSingle(),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);
  return {
    contaId: (membro?.conta_id as string | undefined) ?? null,
    admin: ehAdmin === true,
    email: typeof claims?.email === "string" ? claims.email : null,
  };
}

async function liberados(db: any, contaId: string | null): Promise<Set<string>> {
  if (!contaId) return new Set();
  const { data } = await db
    .from("conta_materiais")
    .select("material_codigo")
    .eq("conta_id", contaId)
    .is("revogado_em", null);
  return new Set((data ?? []).map((m: any) => String(m.material_codigo)));
}

export type MaterialResumo = {
  codigo: string;
  nome: string;
  precoCentavos: number | null;
  liberado: boolean;
  /** Checkout avulso, para quem não levou no order bump. */
  checkoutUrl: string | null;
};

export const listarMateriais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MaterialResumo[]> => {
    const {
      contaId,
      admin: ehAdmin,
      email,
    } = await contextoDoUsuario(
      context.supabase,
      context.userId,
      context.claims as { email?: unknown },
    );
    const db = await admin();
    const [{ data: catalogo }, meus] = await Promise.all([
      db
        .from("materiais")
        .select("codigo, nome, preco_centavos, hubla_oferta_id")
        .eq("ativo", true)
        .order("preco_centavos", { ascending: false }),
      liberados(db, contaId),
    ]);

    return (catalogo ?? []).map((m: any) => {
      let checkoutUrl: string | null = null;
      if (m.hubla_oferta_id && contaId) {
        const url = new URL(`https://pay.hub.la/${m.hubla_oferta_id}`);
        if (email) url.searchParams.set("email", email);
        // c-<conta>: o webhook libera nesta conta mesmo com outro e-mail no pagamento.
        url.searchParams.set("sck", `c-${contaId}`);
        checkoutUrl = url.toString();
      }
      return {
        codigo: String(m.codigo),
        nome: String(m.nome),
        precoCentavos: m.preco_centavos ?? null,
        liberado: ehAdmin || meus.has(String(m.codigo)),
        checkoutUrl,
      };
    });
  });

export const getMaterial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { codigo: string }) => ({
    codigo: String(data?.codigo ?? "").slice(0, 60),
  }))
  .handler(async ({ data, context }) => {
    const { contaId, admin: ehAdmin } = await contextoDoUsuario(context.supabase, context.userId);
    const db = await admin();
    const meus = await liberados(db, contaId);
    if (!ehAdmin && !meus.has(data.codigo)) {
      throw new Error("Este material não está liberado na sua conta.");
    }
    const { conteudoDoMaterial } = await import("./materiais.server");
    const conteudo = conteudoDoMaterial(data.codigo);
    if (!conteudo) throw new Error("Material não encontrado.");
    return conteudo;
  });
