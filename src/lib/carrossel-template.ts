import { supabase } from "@/integrations/supabase/client";

export const FOTO_BUCKET = "perfil-fotos";

export type TemplateCarrossel = {
  arroba: string;
  nome_exibicao: string;
  foto_path: string;
  verificado: boolean;
  cor_fundo: string;
  cor_texto: string;
};

export const TEMPLATE_DEFAULT: TemplateCarrossel = {
  arroba: "",
  nome_exibicao: "",
  foto_path: "",
  verificado: true,
  cor_fundo: "#0F172A",
  cor_texto: "#FFFFFF",
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
  texto: string;
  destaque?: string;
  ritmo?: string;
};

export type CarrosselRow = {
  id: string;
  status: string;
  erro: string | null;
  copy: { slides?: Array<{ tipo?: string; texto?: string }>; legenda_sugerida?: string } | null;
  visual: { slides?: Array<{ destaque?: string; ritmo?: string }>; observacao_geral?: string } | null;
};

export function mergeSlides(carrossel: CarrosselRow | null | undefined): CarrosselSlideData[] {
  const copySlides = carrossel?.copy?.slides ?? [];
  const visualSlides = carrossel?.visual?.slides ?? [];
  return copySlides
    .filter((s) => s?.texto)
    .map((s, i) => ({
      tipo: s.tipo,
      texto: String(s.texto),
      destaque: visualSlides[i]?.destaque ?? "",
      ritmo: visualSlides[i]?.ritmo ?? "",
    }));
}
