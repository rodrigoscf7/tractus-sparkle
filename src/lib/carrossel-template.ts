import { supabase } from "@/integrations/supabase/client";
import { FONTE_PADRAO, fonteDoId } from "@/lib/carrossel-fontes";

export const FOTO_BUCKET = "perfil-fotos";

export type ModeloCarrosselId = "tweet" | "editorial" | "marca-texto";

export type ModeloCarrossel = {
  id: ModeloCarrosselId;
  nome: string;
  descricao: string;
  /** Campos do template que aparecem no slide deste modelo; o editor esconde os outros. */
  usa: { nome: boolean; foto: boolean; verificado: boolean; cor_destaque: boolean };
};

export const MODELOS_CARROSSEL: ModeloCarrossel[] = [
  {
    id: "tweet",
    nome: "Tweet",
    descricao: "post de rede social, com foto e selo",
    usa: { nome: true, foto: true, verificado: true, cor_destaque: false },
  },
  {
    id: "editorial",
    nome: "Editorial",
    descricao: "página de revista, título grande e fios",
    usa: { nome: true, foto: false, verificado: false, cor_destaque: true },
  },
  {
    id: "marca-texto",
    nome: "Marca-texto",
    descricao: "o trecho-chave grifado com cor",
    usa: { nome: false, foto: true, verificado: false, cor_destaque: true },
  },
];

export function modeloDoId(id: string | undefined | null): ModeloCarrossel {
  return MODELOS_CARROSSEL.find((m) => m.id === id) ?? MODELOS_CARROSSEL[0];
}

export type TemplateCarrossel = {
  /** Id de MODELOS_CARROSSEL: o layout dos slides. */
  modelo: ModeloCarrosselId;
  arroba: string;
  nome_exibicao: string;
  foto_path: string;
  verificado: boolean;
  cor_fundo: string;
  cor_texto: string;
  /** Cor de acento dos modelos editorial e marca-texto. */
  cor_destaque: string;
  /** Id de FONTES_CARROSSEL usado nos títulos. */
  fonte_titulo: string;
  /** Id de FONTES_CARROSSEL usado no corpo dos slides. */
  fonte_texto: string;
};

export const TEMPLATE_DEFAULT: TemplateCarrossel = {
  modelo: "tweet",
  arroba: "",
  nome_exibicao: "",
  foto_path: "",
  verificado: true,
  cor_fundo: "#0F172A",
  cor_texto: "#FFFFFF",
  cor_destaque: "#FACC15",
  fonte_titulo: FONTE_PADRAO,
  fonte_texto: FONTE_PADRAO,
};

export function parseTemplate(raw: unknown): TemplateCarrossel {
  const t = (raw ?? {}) as Partial<TemplateCarrossel> & { foto_url?: string };
  return {
    // Perfis de antes dos modelos não têm o campo e seguem no tweet.
    modelo: modeloDoId(t.modelo).id,
    arroba: (t.arroba ?? "").replace(/^@/, ""),
    nome_exibicao: t.nome_exibicao ?? "",
    foto_path: t.foto_path ?? "",
    verificado: t.verificado ?? true,
    cor_fundo: t.cor_fundo || TEMPLATE_DEFAULT.cor_fundo,
    cor_texto: t.cor_texto || TEMPLATE_DEFAULT.cor_texto,
    cor_destaque: t.cor_destaque || TEMPLATE_DEFAULT.cor_destaque,
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
