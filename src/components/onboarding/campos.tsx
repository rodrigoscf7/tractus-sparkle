/**
 * Primitivas do wizard de onboarding.
 *
 * Densidade oposta à do resto do app: corpo em 16px, rótulos legíveis, um
 * grupo de perguntas por tela. O amarelo aparece só como marcador de escolha,
 * nunca como texto — regra do manual de marca.
 */
import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Estilo, Opcao } from "@/lib/onboarding-perguntas";
import { normalizarHandle } from "@/lib/onboarding-perguntas";

/** Trilho de progresso. Único uso de amarelo na moldura do wizard. */
export function TrilhoProgresso({ atual, total }: { atual: number; total: number }) {
  const pct = Math.round((atual / total) * 100);
  return (
    <div
      className="h-[3px] w-full bg-divider"
      role="progressbar"
      aria-valuenow={atual}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Passo ${atual} de ${total}`}
    >
      <div
        className="h-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Pergunta({
  titulo,
  apoio,
  children,
}: {
  titulo: string;
  apoio?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1.5">
        <h2 className="font-display text-xl sm:text-2xl font-semibold leading-snug tracking-tight">
          {titulo}
        </h2>
        {apoio && <p className="text-base text-muted-foreground leading-relaxed">{apoio}</p>}
      </div>
      {children}
    </section>
  );
}

const cartaoBase =
  "relative text-left rounded-lg border p-4 transition cursor-pointer " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-background motion-reduce:transition-none";

const cartaoAtivo = "border-foreground bg-surface";
const cartaoInativo = "border-border bg-surface hover:border-foreground/30";

/** Marcador de selecionado: quadrado amarelo, nunca texto amarelo. */
function Marcador() {
  return (
    <span
      aria-hidden
      className="absolute top-3 right-3 h-2.5 w-2.5 rounded-[2px] bg-primary"
    />
  );
}

export function EscolhaUnica({
  opcoes,
  valor,
  onChange,
  colunas = 2,
}: {
  opcoes: Opcao[];
  valor?: string;
  onChange: (valor: string) => void;
  colunas?: 1 | 2 | 3;
}) {
  const grid =
    colunas === 1 ? "grid-cols-1" : colunas === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <div role="radiogroup" className={`grid grid-cols-1 gap-3 ${grid}`}>
      {opcoes.map((o) => {
        const ativo = valor === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(o.valor)}
            className={`${cartaoBase} ${ativo ? cartaoAtivo : cartaoInativo}`}
          >
            {ativo && <Marcador />}
            <span className="block pr-6 text-base leading-snug">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function EscolhaMultipla({
  opcoes,
  valores,
  onChange,
  max,
  colunas = 2,
}: {
  opcoes: Opcao[];
  valores: string[];
  onChange: (valores: string[]) => void;
  max: number;
  colunas?: 1 | 2 | 3;
}) {
  const grid =
    colunas === 1 ? "grid-cols-1" : colunas === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";

  function alternar(valor: string) {
    if (valores.includes(valor)) {
      onChange(valores.filter((v) => v !== valor));
      return;
    }
    if (valores.length >= max) return;
    onChange([...valores, valor]);
  }

  return (
    <div className="space-y-3">
      <div className={`grid grid-cols-1 gap-3 ${grid}`}>
        {opcoes.map((o) => {
          const ativo = valores.includes(o.valor);
          const cheio = !ativo && valores.length >= max;
          return (
            <button
              key={o.valor}
              type="button"
              aria-pressed={ativo}
              disabled={cheio}
              onClick={() => alternar(o.valor)}
              className={`${cartaoBase} ${ativo ? cartaoAtivo : cartaoInativo} ${
                cheio ? "opacity-40 cursor-not-allowed" : ""
              }`}
            >
              {ativo && <Marcador />}
              <span className="block pr-6 text-base leading-snug">{o.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        {valores.length} de {max} escolhidas
      </p>
    </div>
  );
}

/**
 * O compromisso de ritmo. É a pergunta mais valiosa do wizard: o produto inteiro
 * — a pauta da semana, a constância, a cobrança — se apoia nela. Por isso vem em
 * botões grandes que somam uma frase legível ("3 vezes por semana"), e não num
 * seletor de número abstrato.
 */
export function EscolhaDias({
  dias,
  valores,
  onChange,
}: {
  dias: { dow: number; curto: string; longo: string }[];
  valores: number[];
  onChange: (valores: number[]) => void;
}) {
  function alternar(dow: number) {
    onChange(
      valores.includes(dow) ? valores.filter((d) => d !== dow) : [...valores, dow].sort(),
    );
  }

  const total = valores.length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {dias.map((d) => {
          const ativo = valores.includes(d.dow);
          return (
            <button
              key={d.dow}
              type="button"
              aria-pressed={ativo}
              aria-label={d.longo}
              onClick={() => alternar(d.dow)}
              className={`${cartaoBase} flex items-center justify-center h-14 p-0 ${
                ativo ? cartaoAtivo : cartaoInativo
              }`}
            >
              {ativo && <Marcador />}
              <span className="text-base font-medium">{d.curto}</span>
            </button>
          );
        })}
      </div>
      <p className="text-base text-muted-foreground" aria-live="polite">
        {total === 0
          ? "Escolha ao menos um dia."
          : total === 1
            ? "1 vez por semana."
            : `${total} vezes por semana.`}
      </p>
    </div>
  );
}

/**
 * Pergunta 7. O exemplo é a pergunta: quase ninguém descreve o próprio tom de
 * voz, mas todo mundo reconhece a própria abertura numa frase pronta. Por isso
 * a frase vem em tipo de leitura e o rótulo fica subordinado a ela.
 */
export function EscolhaEstilo({
  estilos,
  valor,
  onChange,
}: {
  estilos: Estilo[];
  valor?: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div role="radiogroup" className="space-y-3">
      {estilos.map((e) => {
        const ativo = valor === e.valor;
        return (
          <button
            key={e.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            aria-label={`${e.label}: ${e.exemplo}`}
            onClick={() => onChange(e.valor)}
            className={`${cartaoBase} w-full p-5 sm:p-6 ${ativo ? cartaoAtivo : cartaoInativo}`}
          >
            {ativo && <Marcador />}
            <p className="font-display text-lg sm:text-xl leading-snug pr-6">
              <span aria-hidden className="text-muted-foreground">
                “
              </span>
              {e.exemplo}
              <span aria-hidden className="text-muted-foreground">
                ”
              </span>
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="text-foreground font-medium">{e.label}</span> · {e.comoSoa}
            </p>
          </button>
        );
      })}
    </div>
  );
}

/** Pergunta 10. Lista de @handles do Instagram. */
export function ListaHandles({
  valores,
  onChange,
  max,
}: {
  valores: string[];
  onChange: (valores: string[]) => void;
  max: number;
}) {
  const [rascunho, setRascunho] = useState("");
  const cheio = valores.length >= max;

  function adicionar() {
    const handle = normalizarHandle(rascunho);
    if (!handle || cheio || valores.includes(handle)) {
      setRascunho("");
      return;
    }
    onChange([...valores, handle]);
    setRascunho("");
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            @
          </span>
          <Input
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              adicionar();
            }}
            disabled={cheio}
            placeholder="perfil.no.instagram"
            aria-label="Perfil do Instagram"
            autoComplete="off"
            className="pl-7 h-11 text-base"
          />
        </div>
        <button
          type="button"
          onClick={adicionar}
          disabled={cheio || !rascunho.trim()}
          className="h-11 shrink-0 rounded-md border border-border px-4 text-base transition
            hover:border-foreground/30 disabled:opacity-40 disabled:cursor-not-allowed
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Adicionar
        </button>
      </div>

      {valores.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {valores.map((handle) => (
            <li key={handle}>
              <span className="inline-flex items-center gap-2 rounded-md border border-border bg-surface pl-3 pr-1.5 py-1.5">
                <span className="text-base">@{handle}</span>
                <button
                  type="button"
                  onClick={() => onChange(valores.filter((v) => v !== handle))}
                  aria-label={`Remover @${handle}`}
                  className="rounded p-1 text-muted-foreground transition hover:text-destructive
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-muted-foreground">
        {cheio
          ? `Você chegou ao limite de ${max} perfis.`
          : `${valores.length} de ${max}. Pode ser de qualquer segmento.`}
      </p>
    </div>
  );
}
