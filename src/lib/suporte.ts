/**
 * Contrato do assistente de suporte entre o widget e o servidor.
 *
 * A ação é proposta e validada pelo suporte-agent
 * (supabase/functions/suporte-agent) e executada por suporte.server.ts depois
 * que a pessoa confirma.
 */
import type { Json } from "@/integrations/supabase/types";

export type StatusAcao = "proposta" | "executando" | "executada" | "cancelada" | "erro";

export type AcaoSuporte = {
  tipo: string;
  args: { [chave: string]: Json };
  /** O que vai acontecer, em linguagem simples (é o texto do cartão de confirmação). */
  descricao: string;
  status: StatusAcao;
  resultado?: string;
};

export type MensagemSuporte = {
  id: string;
  papel: "usuario" | "assistente";
  conteudo: string;
  acao: AcaoSuporte | null;
  criado_em: string;
};

/** Mensagens da pessoa por 24h: o assistente custa por mensagem. */
export const LIMITE_MENSAGENS_DIA = 40;

/** WhatsApp do suporte humano (só dígitos, com DDI). */
export const WHATSAPP_SUPORTE =
  (import.meta.env.VITE_SUPORTE_WHATSAPP as string | undefined)?.replace(/\D/g, "") ||
  "5522988061426";

export function linkWhatsappSuporte(resumo: string): string {
  const texto = `Olá! Vim do assistente da prevIA. ${resumo}`.slice(0, 900);
  return `https://wa.me/${WHATSAPP_SUPORTE}?text=${encodeURIComponent(texto)}`;
}
