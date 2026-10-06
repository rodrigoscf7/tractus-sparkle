import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mensagemErro } from "@/lib/mensagem-erro";
import { DIAS_SEMANA, RITMO_PADRAO } from "@/lib/ritmo";
import { cn } from "@/lib/utils";

/** A semana do produto começa na segunda: domingo vai para o fim da fileira. */
const ORDEM = [1, 2, 3, 4, 5, 6, 0];

/**
 * Os dias em que a pessoa se comprometeu a postar. Cada dia vira um vídeo no
 * plano da semana; a mudança vale a partir do próximo plano.
 */
export function DiasDePostar({
  perfilId,
  ritmoDias,
  onSaved,
}: {
  perfilId: string;
  ritmoDias: number[] | null | undefined;
  onSaved: () => void;
}) {
  const inicial = ritmoDias?.length ? ritmoDias : RITMO_PADRAO;
  const [dias, setDias] = useState<number[]>(inicial);
  const [salvando, setSalvando] = useState(false);

  const mudou = [...dias].sort().join() !== [...inicial].sort().join();

  function alternar(dow: number) {
    setDias((atual) =>
      atual.includes(dow) ? atual.filter((d) => d !== dow) : [...atual, dow].sort((a, b) => a - b),
    );
  }

  async function salvar() {
    setSalvando(true);
    const { error } = await supabase
      .from("perfis")
      .update({ ritmo_dias: [...dias].sort((a, b) => a - b) })
      .eq("id", perfilId);
    setSalvando(false);
    if (error) {
      toast.error(mensagemErro(error, "Não consegui salvar os dias."));
      return;
    }
    toast.success("Dias salvos. Valem a partir do próximo plano da semana.");
    onSaved();
  }

  return (
    <Card className="p-6 bg-surface border-border max-w-2xl">
      <h2 className="font-display font-semibold text-lg mb-1">Dias de postar</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Cada dia marcado vira um vídeo no seu plano da semana, e é nesses dias que a prevIA lembra
        você de postar. A mudança vale a partir do próximo plano.
      </p>

      <fieldset>
        <legend className="sr-only">Dias da semana</legend>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {ORDEM.map((dow) => {
            const dia = DIAS_SEMANA[dow];
            const marcado = dias.includes(dow);
            return (
              <button
                key={dow}
                type="button"
                role="checkbox"
                aria-checked={marcado}
                aria-label={dia.longo}
                onClick={() => alternar(dow)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border text-sm transition-colors motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  marcado
                    ? "border-foreground bg-foreground text-background font-semibold"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                <span className="capitalize">{dia.curto}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-4 w-4 place-items-center rounded-[3px]",
                    marcado ? "bg-primary text-primary-foreground" : "border border-border",
                  )}
                >
                  {marcado && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={salvar} disabled={salvando || !mudou || dias.length === 0}>
          {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salvar dias
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {dias.length === 0
            ? "Escolha pelo menos um dia."
            : dias.length === 1
              ? "1 vídeo por semana."
              : `${dias.length} vídeos por semana.`}
        </p>
      </div>
    </Card>
  );
}
