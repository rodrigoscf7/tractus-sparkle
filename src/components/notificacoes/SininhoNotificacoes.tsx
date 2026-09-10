import { useEffect, useState } from "react";
import { Bell, Check, Share } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ativarNotificacoes,
  ehIOS,
  estaInstalado,
  registrarIntencaoNotificacoes,
  suportaPush,
  temInscricaoAtiva,
} from "@/lib/push-client";

/** Ponto de entrada permanente para quem não ativou notificações no onboarding. */
export function SininhoNotificacoes() {
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmadoIOS, setConfirmadoIOS] = useState(false);

  useEffect(() => {
    temInscricaoAtiva().then(setAtivo);
  }, []);

  if (!suportaPush() && !ehIOS()) return null;
  if (ativo) return null;

  async function aoAtivar() {
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await ativarNotificacoes();
      if (!resultado.ok) {
        setErro(resultado.erro ?? "Não foi possível ativar as notificações.");
        return;
      }
      setAtivo(true);
      setAberto(false);
    } finally {
      setCarregando(false);
    }
  }

  async function aoConfirmarIOS() {
    await registrarIntencaoNotificacoes();
    setConfirmadoIOS(true);
  }

  const precisaInstalarNoIOS = ehIOS() && !estaInstalado();

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground
          hover:text-foreground hover:bg-surface-elevated transition"
      >
        <Bell className="w-4 h-4" />
        Ativar notificações
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notificações</DialogTitle>
          </DialogHeader>

          {precisaInstalarNoIOS ? (
            confirmadoIOS ? (
              <p className="text-sm text-muted-foreground">
                Perfeito — na próxima vez que abrir o app pela tela de início, vamos pedir a permissão.
              </p>
            ) : (
              <>
                <p className="text-sm leading-relaxed">
                  No iPhone, para receber notificações, primeiro adicione a prevIA à tela de início:
                </p>
                <ol className="mt-2 space-y-1.5 text-sm leading-relaxed">
                  <li className="flex gap-2.5">
                    <Share className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> Toque em
                    Compartilhar, na barra do Safari
                  </li>
                  <li className="flex gap-2.5">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    Depois, toque em "Adicionar à Tela de Início"
                  </li>
                </ol>
                <button
                  type="button"
                  onClick={aoConfirmarIOS}
                  className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2
                    text-sm transition hover:border-foreground/30"
                >
                  Já instalei, entendi
                </button>
              </>
            )
          ) : (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Avisamos quando a curadoria e as pautas estiverem prontas pra você aprovar.
              </p>
              <button
                type="button"
                onClick={aoAtivar}
                disabled={carregando}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm
                  font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                <Check className="h-4 w-4" /> Ativar notificações
              </button>
            </>
          )}

          {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
