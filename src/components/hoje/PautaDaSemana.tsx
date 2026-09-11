import { Check, Circle, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  DIAS_SEMANA,
  descreverRitmo,
  rotuloSemana,
  type DiaDoRitmo,
  type EstadoDia,
} from "@/lib/ritmo";

/**
 * A pauta da semana.
 *
 * "Pauta" já é palavra do mundo do usuário nos dois sentidos — pauta de conteúdo
 * e pauta de julgamento — e o advogado já lê uma toda semana. Por isso a tela
 * tem forma de pauta, não de quadro Kanban: uma linha por dia com que ele se
 * comprometeu, em ordem, com a data alinhada em coluna.
 *
 * O amarelo aparece uma vez só, na linha de hoje — a única acionável. É a regra
 * do manual de marca (amarelo = ação, nunca texto) aplicada como hierarquia.
 */

const ESTADO: Record<
  EstadoDia,
  { rotulo: string; icone: typeof Check; cor: string; vazio: string }
> = {
  postado: {
    rotulo: "postado",
    icone: Check,
    cor: "text-success",
    vazio: "Publicado",
  },
  hoje: {
    rotulo: "hoje",
    icone: Circle,
    cor: "text-foreground",
    vazio: "Sem roteiro pronto ainda",
  },
  previsto: {
    rotulo: "previsto",
    icone: Circle,
    cor: "text-muted-foreground",
    vazio: "—",
  },
  perdido: {
    rotulo: "não postou",
    icone: Minus,
    cor: "text-muted-foreground",
    vazio: "—",
  },
};

export function PautaDaSemana({
  dias,
  ritmoDias,
  semanasSeguidas,
}: {
  dias: DiaDoRitmo[];
  ritmoDias: number[];
  semanasSeguidas: number;
}) {
  return (
    <Card className="bg-surface border-border overflow-hidden">
      <div className="px-4 sm:px-6 pt-5 pb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          {rotuloSemana()}
        </h2>
        <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          {descreverRitmo(ritmoDias)}
        </span>
      </div>

      <ol className="border-t border-divider">
        {dias.map((dia) => {
          const meta = ESTADO[dia.estado];
          const Icone = meta.icone;
          const nome = DIAS_SEMANA.find((d) => d.dow === dia.dow);
          const ehHoje = dia.estado === "hoje";

          return (
            <li
              key={dia.dow}
              className={`relative grid grid-cols-[4.5rem_1.25rem_1fr] items-baseline gap-x-3 px-4 sm:px-6 py-3 border-b border-divider last:border-b-0 ${
                ehHoje ? "bg-primary/15" : ""
              }`}
            >
              {ehHoje && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary"
                />
              )}

              <span className="num font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {nome?.curto} {dia.data.getDate()}
              </span>

              <Icone
                aria-hidden="true"
                className={`w-3.5 h-3.5 self-center shrink-0 ${meta.cor}`}
                strokeWidth={dia.estado === "postado" ? 3 : 2}
              />

              <span className="min-w-0">
                {/* O estado também vai em texto: cor e ícone sozinhos não bastam. */}
                <span className="sr-only">
                  {nome?.longo}, {meta.rotulo}.{" "}
                </span>
                {dia.tema ? (
                  <span
                    className={`text-sm leading-snug line-clamp-2 ${ehHoje ? "font-medium" : ""}`}
                  >
                    {dia.tema}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">{meta.vazio}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="px-4 sm:px-6 py-3 border-t border-border bg-surface-elevated">
        <p className="text-sm text-muted-foreground">
          {semanasSeguidas > 0 ? (
            <>
              <strong className="num font-semibold text-foreground">{semanasSeguidas}</strong>{" "}
              {semanasSeguidas === 1 ? "semana seguida" : "semanas seguidas"} no ritmo
            </>
          ) : (
            "Cumpra a semana inteira para começar sua sequência."
          )}
        </p>
      </div>
    </Card>
  );
}
