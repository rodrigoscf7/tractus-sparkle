import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, MessageCircle, RotateCcw, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mensagemErro } from "@/lib/mensagem-erro";
import { cn } from "@/lib/utils";
import {
  carregarConversaSuporte,
  enviarMensagemSuporte,
  novaConversaSuporte,
  responderAcaoSuporte,
} from "@/lib/suporte.functions";
import { linkWhatsappSuporte, type AcaoSuporte, type MensagemSuporte } from "@/lib/suporte";

/** Perguntas de partida, pela tela em que a pessoa está. */
const SUGESTOES: Record<string, string[]> = {
  "/plano": ["Por que meu plano ainda não chegou?", "Como troco um vídeo do plano?"],
  "/perfis": ["Como mudo a fonte do carrossel?", "Quantas referências posso ter?"],
  "/hoje": ["O que eu faço primeiro?", "Como mudo meus dias de postar?"],
  "/dna": ["Para que serve o manual de marca?", "Posso gerar o manual de novo?"],
  "/assinatura": ["O que meu plano inclui?", "Quando meu limite renova?"],
};
const SUGESTOES_PADRAO = ["Como funciona o plano da semana?", "Como ativo as notificações?"];

// ---------------------------------------------------------------------------
// Markdown simples: parágrafos, listas, **negrito** e [atalhos](/rota).
// Renderizado como React (nada de HTML cru).
// ---------------------------------------------------------------------------

function Inline({ texto, irPara }: { texto: string; irPara: (rota: string) => void }) {
  const partes: ReactNode[] = [];
  const padrao = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((\/[^)\s]*)\)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = padrao.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    if (m[1]) {
      partes.push(<strong key={k++}>{m[1]}</strong>);
    } else {
      const rota = m[3];
      partes.push(
        <button
          key={k++}
          type="button"
          onClick={() => irPara(rota)}
          className="font-medium underline underline-offset-2 decoration-primary hover:decoration-2"
        >
          {m[2]}
        </button>,
      );
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return <>{partes}</>;
}

function Markdown({ texto, irPara }: { texto: string; irPara: (rota: string) => void }) {
  const blocos: ReactNode[] = [];
  let lista: { ordenada: boolean; itens: string[] } | null = null;
  const fecharLista = () => {
    if (!lista) return;
    const Tag = lista.ordenada ? "ol" : "ul";
    blocos.push(
      <Tag
        key={blocos.length}
        className={cn("pl-5 space-y-1", lista.ordenada ? "list-decimal" : "list-disc")}
      >
        {lista.itens.map((item, i) => (
          <li key={i}>
            <Inline texto={item} irPara={irPara} />
          </li>
        ))}
      </Tag>,
    );
    lista = null;
  };

  for (const linha of texto.split("\n")) {
    const ordenada = linha.match(/^\s*\d+[.)]\s+(.*)$/);
    const solta = linha.match(/^\s*[-•*]\s+(.*)$/);
    if (ordenada || solta) {
      const eOrdenada = Boolean(ordenada);
      if (lista && lista.ordenada !== eOrdenada) fecharLista();
      if (!lista) lista = { ordenada: eOrdenada, itens: [] };
      lista.itens.push((ordenada ?? solta)![1]);
      continue;
    }
    fecharLista();
    if (linha.trim()) {
      blocos.push(
        <p key={blocos.length}>
          <Inline texto={linha} irPara={irPara} />
        </p>,
      );
    }
  }
  fecharLista();
  return <div className="space-y-2">{blocos}</div>;
}

// ---------------------------------------------------------------------------

/**
 * O bloco amarelo com "IA" da logo, no lugar de um ícone genérico de IA.
 * Amarelo com texto grafite é o marcador de IA do manual de marca.
 */
function SeloIA({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md bg-ai text-ai-foreground",
        "font-display font-bold leading-none tracking-tight",
        className,
      )}
    >
      IA
    </span>
  );
}

function CartaoAcao({
  acao,
  ocupado,
  onResponder,
  irPara,
}: {
  acao: AcaoSuporte;
  ocupado: boolean;
  onResponder: (confirmar: boolean) => void;
  irPara: (rota: string) => void;
}) {
  const resumo = typeof acao.args?.resumo === "string" ? acao.args.resumo : "";
  return (
    <div className="mt-2 rounded-lg border border-border bg-surface p-3 text-sm">
      <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
        {acao.status === "proposta" ? "Confirmar ação" : "Ação"}
      </div>
      <p className="font-medium">{acao.descricao}</p>

      {acao.status === "proposta" && (
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={() => onResponder(true)} disabled={ocupado}>
            {ocupado ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-1.5" />
            )}
            Confirmar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onResponder(false)} disabled={ocupado}>
            Cancelar
          </Button>
        </div>
      )}
      {acao.status === "executando" && (
        <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Fazendo…
        </p>
      )}
      {acao.resultado && acao.status !== "executando" && (
        <div
          className={cn(
            "mt-2",
            acao.status === "erro" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          <Markdown texto={acao.resultado} irPara={irPara} />
        </div>
      )}
      {acao.tipo === "falar_com_pessoa" &&
        acao.status !== "proposta" &&
        acao.status !== "cancelada" && (
          <Button size="sm" variant="outline" className="mt-3" asChild>
            <a href={linkWhatsappSuporte(resumo)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-4 h-4 mr-1.5" /> Falar no WhatsApp
            </a>
          </Button>
        )}
    </div>
  );
}

/**
 * Assistente de suporte, recolhido no canto da tela.
 *
 * Responde dúvidas com o manual do app e os dados da conta, e propõe ações que
 * só acontecem depois do toque em Confirmar (ver suporte.functions.ts).
 */
export function AssistenteSuporte() {
  const rota = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const carregar = useServerFn(carregarConversaSuporte);
  const enviar = useServerFn(enviarMensagemSuporte);
  const responder = useServerFn(responderAcaoSuporte);
  const nova = useServerFn(novaConversaSuporte);

  const [aberto, setAberto] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemSuporte[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [acaoOcupada, setAcaoOcupada] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);

  // Carrega a conversa em andamento na primeira abertura.
  useEffect(() => {
    if (!aberto || carregado) return;
    carregar()
      .then((r) => {
        setConversaId(r.conversaId);
        setMensagens(r.mensagens);
      })
      .catch(() => undefined)
      .finally(() => setCarregado(true));
  }, [aberto, carregado, carregar]);

  useEffect(() => {
    if (aberto) campoRef.current?.focus();
  }, [aberto]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens, enviando, aberto]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  function irPara(destino: string) {
    navigate({ to: destino as never });
    // No celular o painel cobre a tela: fecha para a pessoa ver para onde foi.
    if (window.matchMedia("(max-width: 767px)").matches) setAberto(false);
  }

  async function perguntar(pergunta: string) {
    const limpo = pergunta.trim();
    if (!limpo || enviando) return;
    setTexto("");
    setEnviando(true);
    const provisoria: MensagemSuporte = {
      id: `local-${Date.now()}`,
      papel: "usuario",
      conteudo: limpo,
      acao: null,
      criado_em: new Date().toISOString(),
    };
    setMensagens((atual) => [...atual, provisoria]);
    try {
      const r = await enviar({ data: { conversaId, texto: limpo, rota } });
      setConversaId(r.conversaId);
      setMensagens((atual) => [...atual.filter((m) => m.id !== provisoria.id), ...r.mensagens]);
    } catch (e) {
      setMensagens((atual) => atual.filter((m) => m.id !== provisoria.id));
      setTexto(limpo);
      toast.error(mensagemErro(e, "Não consegui enviar. Tente de novo."));
    } finally {
      setEnviando(false);
    }
  }

  async function aoResponderAcao(mensagemId: string, confirmar: boolean) {
    setAcaoOcupada(mensagemId);
    try {
      const r = await responder({ data: { mensagemId, confirmar } });
      setMensagens((atual) =>
        atual.map((m) => (m.id === mensagemId ? { ...m, acao: r.acao as AcaoSuporte } : m)),
      );
      // A ação pode ter mudado o plano, o template ou as referências: as telas recarregam.
      if (confirmar) queryClient.invalidateQueries();
    } catch (e) {
      toast.error(mensagemErro(e, "Não consegui fazer isso agora."));
    } finally {
      setAcaoOcupada(null);
    }
  }

  async function recomecar() {
    await nova({ data: { conversaId } }).catch(() => undefined);
    setConversaId(null);
    setMensagens([]);
    campoRef.current?.focus();
  }

  // Na tela do plano há uma barra fixa de aprovar no rodapé: o botão sobe.
  const acimaDaBarra = rota === "/plano";
  const sugestoes = SUGESTOES[rota] ?? SUGESTOES_PADRAO;

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir a ajuda da prevIA"
        className={cn(
          // Superfície de card, não cor cheia: o selo IA já marca o botão sem disputar com a tela.
          "fixed right-4 sm:right-6 z-40 flex items-center gap-2.5 rounded-full border border-border bg-surface text-foreground shadow-md",
          "h-12 p-2 sm:pr-4 font-medium text-sm hover:bg-surface-elevated transition motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          acimaDaBarra ? "bottom-28 sm:bottom-24" : "bottom-4 sm:bottom-6",
        )}
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <SeloIA className="size-8 text-sm" />
        <span className="hidden sm:inline">Suporte prevIA</span>
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-label="Ajuda da prevIA"
      className={cn(
        "fixed z-50 flex flex-col bg-background border-border shadow-2xl",
        // Celular: tela cheia. Desktop: cartão no canto, sem bloquear o app.
        "inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[380px] md:h-[560px] md:max-h-[calc(100dvh-3rem)] md:rounded-xl md:border",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <header className="flex items-center gap-2 px-4 h-14 border-b border-border shrink-0">
        <SeloIA className="size-7 text-xs" />
        <h2 className="font-display font-semibold flex-1">Ajuda da prevIA</h2>
        {mensagens.length > 0 && (
          <Button
            size="icon"
            variant="ghost"
            onClick={recomecar}
            aria-label="Começar uma nova conversa"
            title="Nova conversa"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setAberto(false)}
          aria-label="Fechar a ajuda"
        >
          <X className="w-4 h-4" />
        </Button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 text-sm leading-relaxed">
        {!carregado && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </p>
        )}

        {carregado && mensagens.length === 0 && (
          <div className="space-y-3">
            <p>
              Oi! Eu tiro dúvidas sobre a prevIA, vejo o que está acontecendo na sua conta e posso
              fazer ajustes por você, sempre pedindo sua confirmação antes.
            </p>
            <div className="flex flex-wrap gap-2">
              {sugestoes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => perguntar(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-left hover:border-primary/60 hover:bg-surface"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensagens.map((m) =>
          m.papel === "usuario" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary/25 px-3 py-2 whitespace-pre-wrap">
                {m.conteudo}
              </div>
            </div>
          ) : (
            <div key={m.id} className="max-w-[92%]">
              <div className="rounded-2xl rounded-bl-md bg-muted px-3 py-2">
                <Markdown texto={m.conteudo} irPara={irPara} />
              </div>
              {m.acao && (
                <CartaoAcao
                  acao={m.acao}
                  ocupado={acaoOcupada === m.id}
                  onResponder={(confirmar) => aoResponderAcao(m.id, confirmar)}
                  irPara={irPara}
                />
              )}
            </div>
          ),
        )}

        {enviando && (
          <div
            className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-3 py-2.5"
            aria-label="Digitando"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce motion-reduce:animate-none"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        )}
        <div ref={fimRef} />
      </div>

      <form
        className="border-t border-border p-3 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          perguntar(texto);
        }}
      >
        <div className="flex items-end gap-2">
          <label htmlFor="suporte-pergunta" className="sr-only">
            Sua pergunta
          </label>
          <textarea
            id="suporte-pergunta"
            ref={campoRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                perguntar(texto);
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="Escreva sua dúvida…"
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm max-h-32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="submit"
            size="icon"
            disabled={enviando || !texto.trim()}
            aria-label="Enviar"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <a
          href={linkWhatsappSuporte("Preciso de ajuda com a prevIA.")}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="w-3.5 h-3.5" /> Prefere uma pessoa? Fale pelo WhatsApp
        </a>
      </form>
    </section>
  );
}
