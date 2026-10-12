import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOGO_FUNDO_CLARO, MARCA_ALT } from "@/lib/marca";
import { supabase } from "@/integrations/supabase/client";
import { estadoDoConvite, resgatarConvite, type EstadoConvite } from "@/lib/convites.functions";

/**
 * O link de convite: quem recebe (pelo QR do vídeo, por exemplo) cria a
 * própria conta com a cortesia do convite e entra direto no onboarding.
 *
 * O cadastro público continua desligado; quem cria a conta é o servidor, e só
 * para um código válido (convites.functions.ts).
 *
 * `ssr: false` porque a página só faz sentido no navegador e não deve ser indexada.
 */
export const Route = createFileRoute("/convite/$codigo")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Seu convite | prevIA" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Convite,
});

function Convite() {
  const { codigo } = Route.useParams();
  const consultar = useServerFn(estadoDoConvite);
  const [estado, setEstado] = useState<EstadoConvite | null>(null);

  useEffect(() => {
    consultar({ data: { codigo } })
      .then(setEstado)
      .catch(() => setEstado({ estado: "invalido" }));
  }, [consultar, codigo]);

  if (!estado) {
    return (
      <Moldura>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground motion-reduce:animate-none" />
      </Moldura>
    );
  }

  if (estado.estado !== "valido") {
    const texto = {
      invalido: "Confira se o link está completo. Se recebeu de alguém, peça o link de novo.",
      expirado: "O prazo deste convite acabou. Se recebeu de alguém, peça um link novo.",
      esgotado: "As vagas deste convite já foram preenchidas.",
    }[estado.estado];
    return (
      <Moldura>
        <Aviso titulo="Este convite não está disponível" texto={texto} />
      </Moldura>
    );
  }

  return (
    <Moldura>
      <Cadastro codigo={codigo} dias={estado.dias} />
    </Moldura>
  );
}

function Cadastro({ codigo, dias }: { codigo: string; dias: number }) {
  const navigate = useNavigate();
  const resgatar = useServerFn(resgatarConvite);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const r = await resgatar({ data: { codigo, nome, email, whatsapp, senha } });

      const { error } = await supabase.auth.signInWithPassword({ email: r.email, password: senha });
      if (error) {
        // A conta existe mesmo assim; mandar para o login é melhor do que
        // deixar a pessoa numa tela que não aceita mais o mesmo e-mail.
        toast.success("Conta criada. Entre com o seu e-mail e senha.");
        navigate({ to: "/auth" });
        return;
      }
      navigate({ to: "/onboarding" });
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível criar a sua conta.");
      setSalvando(false);
    }
  }

  const campo = "mt-1.5 h-12 text-base";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          Convite
        </p>
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {dias === 30 ? "1 mês grátis" : `${dias} dias grátis`} da prevIA, com tudo liberado.
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Crie sua conta e comece agora. Em seguida você conta sua área e seus perfis de referência,
          e o primeiro plano da semana fica pronto em minutos.
        </p>
      </div>

      <form onSubmit={enviar} className="space-y-4">
        <div>
          <Label htmlFor="convite-nome">Seu nome</Label>
          <Input
            id="convite-nome"
            required
            minLength={2}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="name"
            autoFocus
            className={campo}
          />
        </div>
        <div>
          <Label htmlFor="convite-email">E-mail</Label>
          <Input
            id="convite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={campo}
          />
        </div>
        <div>
          <Label htmlFor="convite-whatsapp">WhatsApp</Label>
          <Input
            id="convite-whatsapp"
            type="tel"
            required
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="(11) 99999-9999"
            autoComplete="tel"
            className={campo}
          />
        </div>
        <div>
          <Label htmlFor="convite-senha">Crie uma senha</Label>
          <Input
            id="convite-senha"
            type="password"
            required
            minLength={8}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Pelo menos 8 caracteres"
            autoComplete="new-password"
            className={campo}
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
          {salvando ? "Criando sua conta…" : "Criar conta e começar"}
          {!salvando && <ArrowRight className="h-4 w-4" />}
        </button>

        <p className="text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/auth" className="font-medium text-foreground underline underline-offset-2">
            Entrar
          </Link>
        </p>
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
