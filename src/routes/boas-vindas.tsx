import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOGO_FUNDO_CLARO, MARCA_ALT } from "@/lib/marca";
import { supabase } from "@/integrations/supabase/client";
import {
  definirSenhaInicial,
  statusDaCompra,
  type EstadoCompra,
} from "@/lib/quiz-oferta.functions";
import { obterLeadId } from "@/lib/oferta-variante";

/**
 * A primeira tela depois da compra. É para cá que a página de obrigado da
 * Kiwify manda o comprador.
 *
 * Ninguém se cadastra sozinho neste app — o cadastro público está desligado.
 * Quem paga tem a conta criada pelo webhook e define a própria senha aqui, sem
 * depender de e-mail chegar. O e-mail existe como reforço, não como caminho.
 *
 * Quem identifica a pessoa é o identificador do lead, que ficou no navegador
 * desde o quiz. Não é credencial forte — ele viaja na query do checkout — e
 * por isso o servidor só aceita definir a senha uma vez e dentro de uma janela
 * curta depois da compra.
 *
 * `ssr: false` porque tudo aqui depende do que está no navegador.
 */
export const Route = createFileRoute("/boas-vindas")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Bem-vindo | prevIA" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: BoasVindas,
});

/** De quanto em quanto tempo perguntar se o aviso da Kiwify já chegou. */
const INTERVALO_ESPERA_MS = 2500;
/** Depois disto, para de perguntar e oferece a saída pelo e-mail. */
const LIMITE_ESPERA_MS = 90_000;

function BoasVindas() {
  const consultar = useServerFn(statusDaCompra);
  const [estado, setEstado] = useState<EstadoCompra | null>(null);
  const [desistiu, setDesistiu] = useState(false);
  const comecou = useRef(Date.now());

  const verificar = useCallback(async () => {
    try {
      return await consultar({ data: { leadId: obterLeadId() } });
    } catch {
      return null;
    }
  }, [consultar]);

  /*
   * A pessoa quase sempre chega aqui antes de o aviso de pagamento ter sido
   * entregue, então a tela espera em vez de dizer que deu errado. Para de
   * perguntar quando o estado deixa de ser "processando" — ou quando esperar
   * mais deixa de fazer sentido.
   */
  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout>;

    async function rodada() {
      const atual = await verificar();
      if (!vivo) return;
      if (atual) setEstado(atual);

      const aguardando = !atual || atual.estado === "processando" || atual.estado === "sem_compra";
      if (!aguardando) return;

      if (Date.now() - comecou.current > LIMITE_ESPERA_MS) {
        setDesistiu(true);
        return;
      }
      timer = setTimeout(rodada, INTERVALO_ESPERA_MS);
    }

    rodada();
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [verificar]);

  if (estado?.estado === "pronto")
    return (
      <Moldura>
        <CriarSenha email={estado.email} />
      </Moldura>
    );

  if (estado?.estado === "ja_configurado") {
    return (
      <Moldura>
        <Aviso
          titulo="Sua senha já está criada"
          texto={`A conta de ${estado.email} já tem senha. Entre com ela para continuar.`}
        />
      </Moldura>
    );
  }

  if (estado?.estado === "expirado") {
    return (
      <Moldura>
        <Aviso
          titulo="O prazo deste link acabou"
          texto={`Sua conta existe e está ativa em ${estado.email}. Use "esqueci minha senha" na tela de entrar para definir uma nova.`}
        />
      </Moldura>
    );
  }

  if (desistiu) {
    return (
      <Moldura>
        <Aviso
          titulo="Ainda não recebemos a confirmação do pagamento"
          texto="Isso às vezes demora alguns minutos, e é normal em pagamento por Pix ou boleto. Sua conta é criada assim que o pagamento for confirmado — quando isso acontecer, use 'esqueci minha senha' na tela de entrar com o e-mail da compra."
        />
      </Moldura>
    );
  }

  return (
    <Moldura>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground motion-reduce:animate-none" />
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Confirmando o seu pagamento
          </h1>
        </div>
        <p className="text-base leading-relaxed text-muted-foreground">
          Leva alguns segundos. Não feche esta página — assim que confirmar, você cria a sua senha e
          entra direto.
        </p>
      </div>
    </Moldura>
  );
}

/**
 * O formulário de senha.
 *
 * Depois de salvar, entra sozinho e vai para o onboarding — que já vai estar
 * preenchido com as respostas do quiz. É o fecho da continuidade: a pessoa
 * atravessa da compra até o app sem digitar nada duas vezes.
 */
function CriarSenha({ email }: { email: string }) {
  const navigate = useNavigate();
  const definir = useServerFn(definirSenhaInicial);
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await definir({ data: { leadId: obterLeadId(), senha } });

      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        // A senha foi salva mesmo assim; mandar para o login é melhor do que
        // deixar a pessoa presa numa tela que não vai mais aceitar a senha.
        toast.success("Senha criada. Entre com ela para continuar.");
        navigate({ to: "/auth" });
        return;
      }
      navigate({ to: "/onboarding" });
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar a senha.");
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 text-sm text-success">
          <Check className="h-4 w-4" /> Pagamento confirmado
        </div>
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          Falta só criar a sua senha.
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Sua conta já existe em <span className="text-foreground">{email}</span>, e o que você
          respondeu no diagnóstico já está lá dentro.
        </p>
      </div>

      <form onSubmit={enviar} className="space-y-4">
        <div>
          <Label htmlFor="senha-inicial">Sua senha</Label>
          <Input
            id="senha-inicial"
            type="password"
            required
            minLength={8}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Pelo menos 8 caracteres"
            autoComplete="new-password"
            autoFocus
            className="mt-1.5 h-12 text-base"
          />
        </div>

        <button
          type="submit"
          disabled={salvando}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary
            px-6 py-3 text-base font-medium text-primary-foreground transition hover:bg-primary/90
            disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {salvando ? "Entrando…" : "Criar senha e entrar"}
          {!salvando && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {titulo}
      </h1>
      <p className="text-base leading-relaxed text-muted-foreground">{texto}</p>
      <Link
        to="/auth"
        className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-6 py-3 text-base
          font-medium text-primary-foreground transition hover:bg-primary/90
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Ir para a tela de entrar <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col justify-center px-5 py-16 sm:px-8">
      <div className="mx-auto w-full max-w-md space-y-8">
        <img src={LOGO_FUNDO_CLARO} alt={MARCA_ALT} className="h-8 w-auto" />
        {children}
      </div>
    </div>
  );
}
