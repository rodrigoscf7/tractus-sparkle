import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { LOGO_FUNDO_CLARO, MARCA_ALT } from "@/lib/marca";
import { mensagemErro } from "@/lib/mensagem-erro";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Escolher nova senha | prevIA - CONTENT" },
      { name: "description", content: "Defina uma senha nova para sua conta prevIA - CONTENT." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RedefinirSenhaPage,
});

/**
 * Destino do link enviado por `resetPasswordForEmail`. O Supabase troca o token
 * da URL por uma sessão de recuperação antes desta tela montar, então aqui basta
 * gravar a senha nova — mas a sessão pode não existir (link velho ou já usado),
 * e esse caso precisa ter saída.
 */
function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [temSessao, setTemSessao] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setTemSessao(Boolean(data.session)));
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha !== confirmacao) {
      toast.error("As duas senhas não são iguais.");
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      toast.success("Senha alterada. Bem-vindo de volta.");
      navigate({ to: "/hoje" });
    } catch (err) {
      toast.error(mensagemErro(err, "Não consegui alterar a senha."));
    } finally {
      setSalvando(false);
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

        {temSessao === false ? (
          <div className="text-center">
            <h1 className="font-display font-semibold text-lg">Este link expirou</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Links de recuperação valem por pouco tempo e só podem ser usados uma vez. Peça um
              novo.
            </p>
            <Button className="mt-5 w-full" onClick={() => navigate({ to: "/auth" })}>
              Pedir novo link
            </Button>
          </div>
        ) : (
          <>
            <h1 className="font-display font-semibold text-lg mb-1">Escolha uma senha nova</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Depois de salvar, você entra direto.
            </p>

            <form onSubmit={salvar} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="senha">Nova senha</Label>
                <Input
                  id="senha"
                  type="password"
                  required
                  minLength={6}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">Pelo menos 6 caracteres.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmacao">Repita a senha</Label>
                <Input
                  id="confirmacao"
                  type="password"
                  required
                  minLength={6}
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={salvando || temSessao === null}>
                {salvando ? "Salvando…" : "Salvar e entrar"}
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
