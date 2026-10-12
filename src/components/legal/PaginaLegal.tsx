import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LOGO_FUNDO_CLARO, MARCA_ALT } from "@/lib/marca";
import { ATUALIZADO_EM } from "@/lib/legal";

/** Moldura das páginas de Política de Privacidade e Termos de Uso. */
export function PaginaLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-10 sm:py-14">
      <Link to="/" aria-label="Início">
        <img src={LOGO_FUNDO_CLARO} alt={MARCA_ALT} className="mb-8 h-7 w-auto" />
      </Link>
      <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">{titulo}</h1>
      <p className="num mt-2 text-sm text-muted-foreground">Última atualização: {ATUALIZADO_EM}</p>
      <div className="mt-10 space-y-10">{children}</div>
      <footer className="mt-16 border-t border-border pt-6">
        <LinksLegais />
      </footer>
    </div>
  );
}

export function SecaoLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3 text-base leading-relaxed text-muted-foreground">
      <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/** Links de rodapé para as páginas do funil e o login. */
export function LinksLegais({ className = "" }: { className?: string }) {
  return (
    <nav className={`flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground ${className}`}>
      <Link to="/privacidade" className="underline-offset-4 hover:text-foreground hover:underline">
        Política de Privacidade
      </Link>
      <Link to="/termos" className="underline-offset-4 hover:text-foreground hover:underline">
        Termos de Uso
      </Link>
    </nav>
  );
}
