import { supabase } from "@/integrations/supabase/client";
import { FONTE_PADRAO, fonteDoId } from "@/lib/carrossel-fontes";

export const FOTO_BUCKET = "perfil-fotos";

export type TemplateCarrossel = {
  arroba: string;
  nome_exibicao: string;
  foto_path: string;
  verificado: boolean;
  cor_fundo: string;
  cor_texto: string;
  /** Id de FONTES_CARROSSEL usado nos títulos. */
  fonte_titulo: string;
  /** Id de FONTES_CARROSSEL usado no corpo dos slides. */
  fonte_texto: string;
};

export const TEMPLATE_DEFAULT: TemplateCarrossel = {
  arroba: "",
  nome_exibicao: "",
  foto_path: "",
  verificado: true,
  cor_fundo: "#0F172A",
  cor_texto: "#FFFFFF",
  fonte_titulo: FONTE_PADRAO,
  fonte_texto: FONTE_PADRAO,
};

export function parseTemplate(raw: unknown): TemplateCarrossel {
  const t = (raw ?? {}) as Partial<TemplateCarrossel> & { foto_url?: string };
  return {
    arroba: (t.arroba ?? "").replace(/^@/, ""),
    nome_exibicao: t.nome_exibicao ?? "",
    foto_path: t.foto_path ?? "",
    verificado: t.verificado ?? true,
    cor_fundo: t.cor_fundo || TEMPLATE_DEFAULT.cor_fundo,
    cor_texto: t.cor_texto || TEMPLATE_DEFAULT.cor_texto,
    // Id desconhecido (fonte removida da lista) cai na padrão.
    fonte_titulo: fonteDoId(t.fonte_titulo).id,
    fonte_texto: fonteDoId(t.fonte_texto).id,
  };
}

/** Baixa a foto do bucket privado e devolve um data URL (evita CORS na exportação). */
export async function fotoAsDataUrl(path: string): Promise<string> {
  if (!path) return "";
  const { data, error } = await supabase.storage.from(FOTO_BUCKET).download(path);
  if (error || !data) return "";
  return await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(data);
  });
}

export type CarrosselSlideData = {
  tipo?: string;
  titulo?: string;
  corpo?: string;
  destaque?: string;
};

type SlideCopy = {
  tipo?: string;
  titulo?: string;
  corpo?: string;
  destaque?: string;
  /** Formato antigo: um texto só por slide. */
  texto?: string;
};

export type CarrosselRow = {
  id: string;
  status: string;
  erro: string | null;
  copy: {
    formato?: string;
    estrategia?: string;
    slides?: SlideCopy[];
    legenda_sugerida?: string;
  } | null;
  visual: {
    slides?: Array<{ destaque?: string; ritmo?: string }>;
    observacao_geral?: string;
  } | null;
};

/** Capa e hook são títulos; no formato antigo, o resto era corpo. */
const TIPOS_TITULO = new Set(["capa", "hook"]);

export function mergeSlides(carrossel: CarrosselRow | null | undefined): CarrosselSlideData[] {
  const copySlides = carrossel?.copy?.slides ?? [];
  const visualSlides = carrossel?.visual?.slides ?? [];
  return copySlides
    .map((s, i): CarrosselSlideData => {
      const antigo = !s.titulo && !s.corpo && s.texto;
      return {
        tipo: s.tipo,
        titulo: antigo ? (TIPOS_TITULO.has(s.tipo ?? "") ? s.texto : undefined) : s.titulo,
        corpo: antigo ? (TIPOS_TITULO.has(s.tipo ?? "") ? undefined : s.texto) : s.corpo,
        // Carrosséis novos trazem o destaque na copy; os antigos, no passo visual.
        destaque: s.destaque ?? visualSlides[i]?.destaque ?? "",
      };
    })
    .filter((s) => s.titulo || s.corpo);
}
