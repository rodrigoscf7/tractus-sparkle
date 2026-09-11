import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Os três estados que faltavam no app.
 *
 * Antes, "carregando" e "vazio" eram indistinguíveis — as telas caíam direto na
 * frase "Nada aqui ainda." enquanto a query ainda rodava — e nenhuma query
 * tratava falha, então erro de rede virava tela em branco. O esqueleto aqui tem
 * a forma do conteúdo que vem, para a página não saltar quando ele chega.
 */

export function EstadoCarregando({
  linhas = 3,
  className,
  rotulo = "Carregando",
}: {
  linhas?: number;
  className?: string;
  rotulo?: string;
}) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">{rotulo}…</span>
      {Array.from({ length: linhas }).map((_, i) => (
        <Card key={i} className="p-4 bg-surface border-border" aria-hidden="true">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </Card>
      ))}
    </div>
  );
}

export function EstadoErro({
  titulo = "Não consegui carregar",
  descricao = "A conexão falhou no meio do caminho. Seus dados estão a salvo.",
  onTentarDeNovo,
  className,
}: {
  titulo?: string;
  descricao?: string;
  onTentarDeNovo?: () => void;
  className?: string;
}) {
  return (
    <Card className={cn("p-6 bg-surface border-destructive/30", className)} role="alert">
      <h3 className="font-display font-semibold text-base">{titulo}</h3>
      <p className="text-sm text-muted-foreground mt-1">{descricao}</p>
      {onTentarDeNovo && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onTentarDeNovo}>
          Tentar de novo
        </Button>
      )}
    </Card>
  );
}

/**
 * Tela vazia é convite para agir, não aviso de ausência. Sempre diz o que vai
 * acontecer ali e, quando existe algo a fazer, oferece a ação.
 */
export function EstadoVazio({
  titulo,
  descricao,
  acao,
  className,
}: {
  titulo: string;
  descricao: string;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("py-10 px-4 text-center", className)}>
      <h3 className="font-display font-semibold text-base">{titulo}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{descricao}</p>
      {acao && <div className="mt-4 flex justify-center">{acao}</div>}
    </div>
  );
}
