import { useEffect, useState } from "react";
import { BellOff, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SininhoNotificacoes } from "@/components/notificacoes/SininhoNotificacoes";
import { ehIOS, suportaPush, temInscricaoAtiva } from "@/lib/push-client";

const AVISOS = [
  "Quando o plano da semana chega",
  "Quando um roteiro fica pronto para você ler",
  "No dia de postar, se já houver um roteiro pronto para gravar",
];

/** As notificações são por aparelho: o estado mostrado vale para este navegador. */
export function PainelNotificacoes() {
  const [ativo, setAtivo] = useState<boolean | null>(null);

  useEffect(() => {
    temInscricaoAtiva().then(setAtivo);
  }, []);

  const semSuporte = !suportaPush() && !ehIOS();

  return (
    <Card className="p-6 bg-surface border-border max-w-2xl">
      <h2 className="font-display font-semibold text-lg mb-1">Notificações</h2>
      <p className="text-sm text-muted-foreground mb-4">A prevIA avisa você:</p>
      <ul className="space-y-1.5 text-sm mb-6">
        {AVISOS.map((a) => (
          <li key={a} className="flex gap-2.5">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            {a}
          </li>
        ))}
      </ul>

      <div className="rounded-lg border border-border bg-background p-4">
        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
          Neste aparelho
        </div>
        {ativo === null ? (
          <p className="text-sm text-muted-foreground">Verificando…</p>
        ) : ativo ? (
          <p className="flex items-center gap-2 text-sm">
            <Check className="w-4 h-4 text-success" /> Notificações ativas.
          </p>
        ) : semSuporte ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <BellOff className="w-4 h-4 mt-0.5 shrink-0" />
            Este navegador não recebe notificações. Abra a prevIA no Chrome, no Edge ou, no iPhone,
            pelo app instalado na tela de início.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ainda não ativadas. Cada aparelho (celular, computador) precisa ser ativado uma vez.
            </p>
            <SininhoNotificacoes variante="botao" onAtivou={() => setAtivo(true)} />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Se você negou a permissão sem querer, libere nas configurações do navegador para o site da
        prevIA.
      </p>
    </Card>
  );
}
