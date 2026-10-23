import { Card } from "@/components/ui/card";

/**
 * Cards de métrica dos painéis internos (/admin e /equipe). Ficam juntos para
 * os dois painéis mostrarem os mesmos números do mesmo jeito.
 */

export function Kpi({
  label,
  valor,
  detalhe,
  alerta,
}: {
  label: string;
  valor: string;
  detalhe?: string;
  alerta?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`num font-display text-2xl mt-1 ${alerta ? "text-destructive" : ""}`}>
        {valor}
      </div>
      {detalhe && <div className="num text-xs text-muted-foreground mt-1">{detalhe}</div>}
    </Card>
  );
}

/** Distribuição de respostas: quantidade e porcentagem sobre `total`. */
export function Distribuicao({
  titulo,
  itens,
  total,
}: {
  titulo: string;
  itens: { label: string; quantidade: number }[];
  total: number;
}) {
  const maior = itens[0]?.quantidade ?? 0;
  return (
    <Card className="p-5">
      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        {titulo}
      </div>
      <div className="mt-4 space-y-3">
        {itens.map((item) => (
          <div key={item.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm">{item.label}</span>
              <span className="num text-sm text-muted-foreground">
                {item.quantidade}
                {total > 0 && ` · ${Math.round((item.quantidade / total) * 100)}%`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-md bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${maior > 0 ? (item.quantidade / maior) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
        {itens.length === 0 && (
          <p className="text-sm text-muted-foreground">Sem respostas ainda.</p>
        )}
      </div>
    </Card>
  );
}

/** Uso contra o limite do plano. */
export function Metrica({
  label,
  usado,
  limite,
}: {
  label: string;
  usado: number;
  limite: number;
}) {
  const estourou = limite > 0 && usado >= limite;
  return (
    <div>
      <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`num mt-1 text-sm ${estourou ? "text-destructive" : ""}`}>
        {usado} / {limite}
      </div>
      <div className="mt-2 h-1.5 w-full rounded-md bg-secondary overflow-hidden">
        <div
          className={estourou ? "h-full bg-destructive" : "h-full bg-primary"}
          style={{ width: `${limite > 0 ? Math.min(100, (usado / limite) * 100) : 0}%` }}
        />
      </div>
    </div>
  );
}
