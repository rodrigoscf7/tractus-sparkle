/**
 * Dados do controlador para a Política de Privacidade e os Termos de Uso.
 *
 * PREENCHER ANTES DE LIGAR O TRÁFEGO. Enquanto algum campo estiver com
 * colchetes, as páginas /privacidade e /termos mostram o marcador como está —
 * de propósito, para ninguém publicar um documento com dado inventado.
 */
export const EMPRESA = {
  razaoSocial: "[RAZÃO SOCIAL]",
  cnpj: "[CNPJ]",
  endereco: "[ENDEREÇO COMPLETO]",
  emailContato: "[E-MAIL DE CONTATO]",
  /** Encarregado pelo tratamento de dados (DPO), art. 41 da LGPD. */
  encarregado: "[NOME DO ENCARREGADO]",
  emailEncarregado: "[E-MAIL DO ENCARREGADO]",
  foro: "[CIDADE/UF]",
} as const;

/** Data da última revisão dos documentos. Atualizar a cada mudança de texto. */
export const ATUALIZADO_EM = "12 de outubro de 2026";
