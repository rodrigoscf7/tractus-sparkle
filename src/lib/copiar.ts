import { toast } from "sonner";

/** Copia para a área de transferência e confirma com um aviso. */
export function copiarTexto(texto: string, aviso = "Copiado") {
  navigator.clipboard.writeText(texto).then(
    () => toast.success(aviso),
    () => toast.error("O navegador bloqueou a cópia. Selecione o texto e copie à mão."),
  );
}
