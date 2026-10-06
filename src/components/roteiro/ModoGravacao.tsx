import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Minus, Pause, Play, Plus, RotateCcw, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TextoDoRoteiro } from "@/lib/roteiro";
import { cn } from "@/lib/utils";

/** Pixels por segundo. O do meio lê em ritmo de fala de vídeo curto. */
const VELOCIDADES = [16, 22, 30, 40, 52, 66, 84];
const TAMANHOS = [24, 28, 32, 38, 44, 52];
const PADRAO = { velocidade: 2, tamanho: 2 };
const CHAVE = "previa-modo-gravacao";

function lerPreferencias() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? "{}");
    return {
      velocidade: Number.isInteger(salvo.velocidade) ? salvo.velocidade : PADRAO.velocidade,
      tamanho: Number.isInteger(salvo.tamanho) ? salvo.tamanho : PADRAO.tamanho,
    };
  } catch {
    return PADRAO;
  }
}

const limitar = (n: number, max: number) => Math.min(max, Math.max(0, n));

/** Abre o modo gravação. Não aparece se o roteiro não tiver fala. */
export function BotaoGravar({
  texto,
  titulo,
  rotulo = "Gravar",
  variant = "outline",
  size = "sm",
  className,
}: {
  texto: TextoDoRoteiro | null;
  titulo: string;
  rotulo?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  if (!texto?.fala) return null;
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setAberto(true)}>
        <Video className="w-4 h-4 mr-1.5" /> {rotulo}
      </Button>
      {aberto && <ModoGravacao texto={texto} titulo={titulo} onFechar={() => setAberto(false)} />}
    </>
  );
}

/**
 * Teleprompter: a fala em letra grande, rolando sozinha, para gravar lendo no
 * celular. A linha de leitura fica no alto da tela, perto da câmera frontal.
 * Nada se move sem a pessoa tocar em "Começar" — inclusive com
 * `prefers-reduced-motion` —, e com o texto parado dá para rolar com o dedo.
 */
function ModoGravacao({
  texto,
  titulo,
  onFechar,
}: {
  texto: TextoDoRoteiro;
  titulo: string;
  onFechar: () => void;
}) {
  const [{ velocidade, tamanho }, setPreferencias] = useState(lerPreferencias);
  const [rolando, setRolando] = useState(false);
  const [contagem, setContagem] = useState<number | null>(null);
  const [chegouAoFim, setChegouAoFim] = useState(false);
  const [jaComecou, setJaComecou] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const velocidadeAtual = useRef(velocidade);

  useEffect(() => {
    velocidadeAtual.current = velocidade;
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ velocidade, tamanho }));
    } catch {
      // Sem armazenamento (aba anônima): as preferências valem só nesta vez.
    }
  }, [velocidade, tamanho]);

  // 3, 2, 1: tempo de largar o celular no lugar e olhar para a câmera.
  useEffect(() => {
    if (contagem === null) return;
    if (contagem === 0) {
      setContagem(null);
      setRolando(true);
      setJaComecou(true);
      return;
    }
    const t = setTimeout(() => setContagem((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [contagem]);

  useEffect(() => {
    if (!rolando) return;
    let quadro = 0;
    let anterior = performance.now();
    let acumulado = 0;
    const passo = (agora: number) => {
      const el = area.current;
      if (!el) return;
      acumulado += (VELOCIDADES[velocidadeAtual.current] * (agora - anterior)) / 1000;
      anterior = agora;
      const px = Math.floor(acumulado);
      if (px > 0) {
        el.scrollTop += px;
        acumulado -= px;
      }
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        setRolando(false);
        setChegouAoFim(true);
        return;
      }
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [rolando]);

  // Tela acesa enquanto grava. Sem suporte (ou negado), segue funcionando.
  useEffect(() => {
    let trava: { release: () => Promise<void> } | null = null;
    let aberto = true;
    const pedir = async () => {
      try {
        const wakeLock = (
          navigator as Navigator & {
            wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
          }
        ).wakeLock;
        if (wakeLock) trava = await wakeLock.request("screen");
      } catch {
        trava = null;
      }
    };
    // O navegador solta a trava quando a aba some; ao voltar, pede de novo.
    const aoVoltar = () => {
      if (aberto && document.visibilityState === "visible") pedir();
    };
    pedir();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      aberto = false;
      document.removeEventListener("visibilitychange", aoVoltar);
      trava?.release().catch(() => undefined);
    };
  }, []);

  function alternar() {
    if (rolando) {
      setRolando(false);
      return;
    }
    if (contagem !== null) {
      setContagem(null);
      return;
    }
    if (chegouAoFim) {
      area.current?.scrollTo({ top: 0 });
      setChegouAoFim(false);
    }
    setContagem(3);
  }

  function aoTeclar(e: KeyboardEvent) {
    const emBotao = (e.target as HTMLElement).closest("button");
    if (e.key === " " && !emBotao) {
      e.preventDefault();
      alternar();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const delta = e.key === "ArrowUp" ? 1 : -1;
      setPreferencias((p) => ({
        ...p,
        velocidade: limitar(p.velocidade + delta, VELOCIDADES.length - 1),
      }));
    }
  }

  const paragrafos = (texto.desenvolvimento ?? "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const rotuloPrincipal = rolando
    ? "Pausar"
    : contagem !== null
      ? "Cancelar"
      : chegouAoFim
        ? "Do começo"
        : jaComecou
          ? "Continuar"
          : "Começar";

  return (
    <DialogPrimitive.Root open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onKeyDown={aoTeclar}
          className="dark fixed inset-0 z-[70] flex flex-col bg-background text-foreground focus:outline-none"
        >
          <header
            className="flex shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6 min-h-14"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              Modo gravação
            </span>
            <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {titulo}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Fechar o modo gravação">
                <X className="w-5 h-5" />
              </Button>
            </DialogPrimitive.Close>
          </header>

          <div className="relative min-h-0 flex-1">
            {/* A linha de leitura: onde o olho deve estar, perto da câmera. Acompanha a coluna do texto. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-[calc(18vh+0.25rem)] z-10 px-6 sm:px-12"
            >
              <div className="relative mx-auto max-w-3xl">
                <span className="absolute -left-4 sm:-left-6 h-10 w-1 rounded-full bg-primary" />
              </div>
            </div>
            <div
              ref={area}
              onClick={() => rolando && setRolando(false)}
              className="h-full overflow-y-auto overscroll-contain px-6 sm:px-12"
            >
              <div
                className="mx-auto max-w-3xl space-y-[1.1em] pt-[18vh] pb-[75vh]"
                style={{ fontSize: TAMANHOS[tamanho], lineHeight: 1.45 }}
              >
                {texto.gancho && <p className="font-display font-semibold">{texto.gancho}</p>}
                {paragrafos.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                {texto.cta && <p className="font-display font-semibold">{texto.cta}</p>}
                <p className="pt-[1.5em] text-center text-base text-muted-foreground">
                  Fim do roteiro
                </p>
              </div>
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-background to-transparent"
            />

            {contagem !== null && (
              <div className="absolute inset-0 z-20 grid place-items-center bg-background/80">
                <span
                  aria-live="assertive"
                  className="font-display text-[7rem] font-bold leading-none num"
                >
                  {contagem}
                </span>
              </div>
            )}
          </div>

          <footer
            className="flex shrink-0 flex-wrap items-end justify-center gap-x-8 gap-y-3 border-t border-border px-4 py-3"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <Ajuste
              rotulo="Velocidade"
              valor={velocidade + 1}
              menos="Mais devagar"
              mais="Mais rápido"
              onMenos={() =>
                setPreferencias((p) => ({ ...p, velocidade: limitar(p.velocidade - 1, 6) }))
              }
              onMais={() =>
                setPreferencias((p) => ({ ...p, velocidade: limitar(p.velocidade + 1, 6) }))
              }
              noMinimo={velocidade === 0}
              noMaximo={velocidade === VELOCIDADES.length - 1}
            />
            <Button
              size="lg"
              className="order-first w-full sm:order-none sm:w-40"
              onClick={alternar}
            >
              {rolando ? (
                <Pause className="w-5 h-5 mr-2" />
              ) : chegouAoFim ? (
                <RotateCcw className="w-5 h-5 mr-2" />
              ) : contagem === null ? (
                <Play className="w-5 h-5 mr-2" />
              ) : null}
              {rotuloPrincipal}
            </Button>
            <Ajuste
              rotulo="Letra"
              valor={tamanho + 1}
              menos="Letra menor"
              mais="Letra maior"
              onMenos={() => setPreferencias((p) => ({ ...p, tamanho: limitar(p.tamanho - 1, 5) }))}
              onMais={() => setPreferencias((p) => ({ ...p, tamanho: limitar(p.tamanho + 1, 5) }))}
              noMinimo={tamanho === 0}
              noMaximo={tamanho === TAMANHOS.length - 1}
            />
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Ajuste({
  rotulo,
  valor,
  menos,
  mais,
  onMenos,
  onMais,
  noMinimo,
  noMaximo,
}: {
  rotulo: string;
  valor: number;
  menos: string;
  mais: string;
  onMenos: () => void;
  onMais: () => void;
  noMinimo: boolean;
  noMaximo: boolean;
}) {
  const botao =
    "grid h-11 w-11 place-items-center rounded-md border border-border text-foreground transition-colors hover:bg-surface-elevated disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="flex flex-col items-center gap-1" role="group" aria-label={rotulo}>
      <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
        {rotulo}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={botao}
          onClick={onMenos}
          disabled={noMinimo}
          aria-label={menos}
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className={cn("w-5 text-center text-sm num")} aria-live="polite">
          {valor}
        </span>
        <button
          type="button"
          className={botao}
          onClick={onMais}
          disabled={noMaximo}
          aria-label={mais}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
