import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { LOGO_FUNDO_CLARO, MARCA_ALT } from "@/lib/marca";
import { mensagemErro } from "@/lib/mensagem-erro";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar | prevIA - CONTENT" },
      {
        name: "description",
        content: "Acesse sua conta para operar o pipeline de conteúdo prevIA - CONTENT.",
      },
      { property: "og:title", content: "Entrar | prevIA - CONTENT" },
      { property: "og:description", content: "Acesso à plataforma prevIA - CONTENT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Modo = "signin" | "signup" | "recuperar";

const ROTULO: Record<Modo, { acao: string; carregando: string }> = {
  signin: { acao: "Entrar", carregando: "Entrando…" },
  signup: { acao: "Criar conta", carregando: "Criando conta…" },
  recuperar: { acao: "Enviar link de recuperação", carregando: "Enviando…" },
};

function AuthPage() {
  const [mode, setMode] = useState<Modo>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "recuperar") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        if (error) throw error;
        // Não confirmamos se o e-mail existe: isso revelaria quem tem conta.
        toast.success("Se existir uma conta com esse e-mail, o link de recuperação chegou nele.");
        setMode("signin");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/hoje` },
        });
        if (error) throw error;
        toast.success("Conta criada. Verifique seu e-mail se a confirmação estiver ativa.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/hoje" });
      }
    } catch (err) {
      toast.error(mensagemErro(err, "Não consegui completar o acesso. Tente de novo."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-md p-6 sm:p-8 bg-surface border-border">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={LOGO_FUNDO_CLARO} alt={MARCA_ALT} className="h-11 w-auto max-w-full sm:h-14" />
          <p className="text-[11px] text-muted-foreground mt-3 font-mono uppercase tracking-widest">
            Content
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          {mode !== "recuperar" && (
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground">Pelo menos 6 caracteres.</p>
              )}
            </div>
          )}

          {mode === "recuperar" && (
            <p className="text-sm text-muted-foreground">
              Enviamos um link para você escolher uma senha nova.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? ROTULO[mode].carregando : ROTULO[mode].acao}
          </Button>
        </form>

        <div className="mt-6 space-y-2 text-center">
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="w-full min-h-11 rounded-md text-sm text-muted-foreground hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {mode === "signup" ? "Já tem conta? Entrar" : "Criar nova conta"}
          </button>

          {mode !== "recuperar" ? (
            <button
              type="button"
              onClick={() => setMode("recuperar")}
              className="w-full min-h-11 rounded-md text-sm text-muted-foreground hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Esqueci minha senha
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="w-full min-h-11 rounded-md text-sm text-muted-foreground hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Voltar para o acesso
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
