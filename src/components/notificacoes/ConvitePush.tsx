import { useEffect, useState } from "react";
import { Bell, Check, Share } from "lucide-react";
import {
  ativarNotificacoes,
  ehIOS,
  estaInstalado,
  instalarApp,
  ouvirPromptInstalacao,
  registrarIntencaoNotificacoes,
  suportaPush,
  temInscricaoAtiva,
} from "@/lib/push-client";

type Estado =
  | "carregando"
  | "ja_ativo"
  | "nao_suportado"
  | "ios_instalar"
  | "pedir_permissao"
  | "dispensado";

/**
 * Convite para instalar/permitir notificações, mostrado uma vez, no pico de
 * interesse do onboarding (fim do relatório de DNA). Some quando dispensado
 * ou já resolvido — quem quiser ativar depois usa o sininho no cabeçalho.
 */
export function ConvitePush() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [podeInstalarNativo, setPodeInstalarNativo] = useState(false);
  const [carregandoAcao, setCarregandoAcao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!suportaPush() && !ehIOS()) {
      setEstado("nao_suportado");
      return;
    }

    temInscricaoAtiva().then((ativo) => {
      if (ativo) {
        setEstado("ja_ativo");
        return;
      }
      if (ehIOS() && !estaInstalado()) {
        setEstado("ios_instalar");
        return;
      }
      setEstado("pedir_permissao");
    });

    return ouvirPromptInstalacao(setPodeInstalarNativo);
  }, []);

  async function aoClicarInstalarOuPermitir() {
    setCarregandoAcao(true);
    setErro(null);
    try {
      if (podeInstalarNativo && !estaInstalado()) {
        await instalarApp();
      }
      const resultado = await ativarNotificacoes();
      if (!resultado.ok) {
        setErro(resultado.erro ?? "Não foi possível ativar as notificações.");
        return;
      }
      setEstado("ja_ativo");
    } finally {
      setCarregandoAcao(false);
    }
  }

  async function aoConfirmarIntencaoIOS() {
    await registrarIntencaoNotificacoes();
    setEstado("dispensado");
  }

  if (estado === "carregando" || estado === "nao_suportado" || estado === "ja_ativo" || estado === "dispensado") {
    return null;
  }

  return (
    <div data-print-hide className="mb-10 rounded-lg border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <Bell className="h-4 w-4 text-foreground" />
        <span className="text-sm text-muted-foreground">Quer ser avisado quando algo estiver pronto?</span>
      </div>

      {estado === "pedir_permissao" && (
        <>
          <p className="mt-3 text-base leading-relaxed">
            Avisamos quando a curadoria e as pautas estiverem prontas pra você aprovar — sem precisar
            ficar checando o app.
          </p>
          <button
            type="button"
            onClick={aoClicarInstalarOuPermitir}
            disabled={carregandoAcao}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-base
              font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
              focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Check className="h-4 w-4" /> Ativar notificações
          </button>
        </>
      )}

      {estado === "ios_instalar" && (
        <>
          <p className="mt-3 text-base leading-relaxed">
            No iPhone, para receber notificações, primeiro adicione a prevIA à tela de início:
          </p>
          <ol className="mt-3 space-y-1.5 text-base leading-relaxed">
            <li className="flex gap-2.5">
              <Share className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> Toque em Compartilhar,
              na barra do Safari
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Depois, toque em "Adicionar à Tela de Início"
            </li>
          </ol>
          <button
            type="button"
            onClick={aoConfirmarIntencaoIOS}
            className="mt-5 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm
              transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Já instalei, entendi
          </button>
        </>
      )}

      {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
    </div>
  );
}
