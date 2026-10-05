import { useEffect, useState } from "react";
import { prepararFontes } from "@/lib/carrossel-fontes";

/**
 * Carrega as fontes do template e devolve o CSS embutido para a exportação.
 * `pronto` vira true quando as fontes estão na página (ou falharam e a
 * reserva do sistema assumiu).
 */
export function useFontesCarrossel(fonteTitulo: string, fonteTexto: string) {
  const [css, setCss] = useState("");
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let ativo = true;
    setPronto(false);
    prepararFontes([fonteTitulo, fonteTexto]).then((resultado) => {
      if (!ativo) return;
      setCss(resultado);
      setPronto(true);
    });
    return () => {
      ativo = false;
    };
  }, [fonteTitulo, fonteTexto]);

  return { css, pronto };
}
