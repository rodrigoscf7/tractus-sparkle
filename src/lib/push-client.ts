// Cliente-only: usa window/navigator diretamente, nunca importar em código
// que roda no servidor (server functions, *.server.ts).
import { supabase } from "@/integrations/supabase/client";

export function suportaPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function estaInstalado(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneIOS = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return window.matchMedia("(display-mode: standalone)").matches || standaloneIOS;
}

export function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

type EventoInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let promptInstalacao: EventoInstalacao | null = null;

/** Ouve o beforeinstallprompt do Chrome/Edge. Retorna a função de limpeza. */
export function ouvirPromptInstalacao(cb: (disponivel: boolean) => void): () => void {
  const handler = (e: Event) => {
    e.preventDefault();
    promptInstalacao = e as EventoInstalacao;
    cb(true);
  };
  window.addEventListener("beforeinstallprompt", handler);
  return () => window.removeEventListener("beforeinstallprompt", handler);
}

/** Dispara o prompt nativo de instalação. Retorna false se não houver prompt disponível. */
export async function instalarApp(): Promise<boolean> {
  if (!promptInstalacao) return false;
  await promptInstalacao.prompt();
  const escolha = await promptInstalacao.userChoice;
  promptInstalacao = null;
  return escolha.outcome === "accepted";
}

function urlBase64ParaUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalizado = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalizado);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Pede a permissão de notificação e, se concedida, inscreve o navegador. */
export async function ativarNotificacoes(): Promise<{ ok: boolean; erro?: string }> {
  if (!suportaPush()) {
    return { ok: false, erro: "Este navegador não suporta notificações." };
  }

  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") {
    return { ok: false, erro: "Permissão de notificação não concedida." };
  }

  const chavePublica = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!chavePublica) {
    return { ok: false, erro: "Configuração de notificação ausente (VITE_VAPID_PUBLIC_KEY)." };
  }

  const registro = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const existente = await registro.pushManager.getSubscription();
  const inscricao =
    existente ??
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ParaUint8Array(chavePublica),
    }));

  const chaves = inscricao.toJSON().keys;
  if (!chaves?.p256dh || !chaves?.auth) {
    return { ok: false, erro: "Não foi possível ler as chaves da inscrição." };
  }

  const { data: sessao } = await supabase.auth.getUser();
  if (!sessao.user) return { ok: false, erro: "Sessão expirada." };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: sessao.user.id,
      endpoint: inscricao.endpoint,
      p256dh: chaves.p256dh,
      auth_key: chaves.auth,
      ultimo_uso_em: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, erro: error.message };

  return { ok: true };
}

/**
 * Marca a intenção de receber notificações mesmo antes de existir uma
 * inscrição real — no iOS, o convite acontece antes do app estar instalado.
 */
export async function registrarIntencaoNotificacoes(): Promise<void> {
  const { data: sessao } = await supabase.auth.getUser();
  if (!sessao.user) return;
  await supabase
    .from("conta_membros")
    .update({ quer_notificacoes: true })
    .eq("user_id", sessao.user.id);
}

/** Já existe inscrição ativa neste navegador para o usuário logado? */
export async function temInscricaoAtiva(): Promise<boolean> {
  if (!suportaPush()) return false;
  const registro = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registro) return false;
  const inscricao = await registro.pushManager.getSubscription();
  return !!inscricao;
}
