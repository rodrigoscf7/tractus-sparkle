import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutGrid,
  Activity,
  CalendarDays,
  Users,
  LogOut,
  Menu,
  CheckCheck,
  Moon,
  Sun,
  CreditCard,
  Shield,
  BookOpen,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import { useIsPlatformAdmin } from "@/hooks/use-platform-admin";
import { ICONE_MARCA, LOGO_FUNDO_CLARO, LOGO_FUNDO_ESCURO, MARCA_ALT } from "@/lib/marca";
import { SininhoNotificacoes } from "@/components/notificacoes/SininhoNotificacoes";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

/**
 * Onboarding concluído nunca volta a ficar pendente, então basta confirmar uma
 * vez por carregamento da página. Sem isso, o gate faria duas consultas a cada
 * troca de rota. Só o valor positivo é memorizado.
 */
let onboardingLiberado = false;

/** Alvo de toque de 44px e foco visível — o padrão que o onboarding já usa. */
const BOTAO_RODAPE =
  "w-full flex items-center gap-2 min-h-11 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    if (onboardingLiberado) return { user: data.user };

    // Sem conta ou com onboarding em aberto, o app não tem o que mostrar:
    // o perfil, as diretrizes e as referências nascem no wizard.
    // O espelho deste gate está em `routes/onboarding.tsx`.
    const { data: membro } = await supabase
      .from("conta_membros")
      .select("conta_id")
      .eq("user_id", data.user.id)
      .order("criado_em")
      .limit(1)
      .maybeSingle();

    if (!membro?.conta_id) throw redirect({ to: "/onboarding" });

    const { data: onboarding } = await supabase
      .from("onboarding_respostas")
      .select("concluido_em")
      .eq("conta_id", membro.conta_id)
      .maybeSingle();

    if (!onboarding?.concluido_em) throw redirect({ to: "/onboarding" });

    onboardingLiberado = true;
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const { data: isAdmin } = useIsPlatformAdmin();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  // close drawer on route change
  useEffect(() => {
    const unsub = router.subscribe("onResolved", () => setOpen(false));
    return unsub;
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  const sidebar = (
    <>
      <div className="px-6 py-6 border-b border-border">
        <img
          src={theme === "dark" ? LOGO_FUNDO_ESCURO : LOGO_FUNDO_CLARO}
          alt={MARCA_ALT}
          className="h-7 w-auto"
        />
        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mt-2">
          Content
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavLink to="/hoje" icon={<CalendarDays className="w-4 h-4" />}>
          Hoje
        </NavLink>
        <NavLink to="/curadoria" icon={<CheckCheck className="w-4 h-4" />}>
          Curadoria
        </NavLink>
        <NavLink to="/pipeline" icon={<LayoutGrid className="w-4 h-4" />}>
          Acompanhar
        </NavLink>

        <NavLink to="/perfis" icon={<Users className="w-4 h-4" />}>
          Minha marca
        </NavLink>
        <NavLink to="/dna" icon={<BookOpen className="w-4 h-4" />}>
          Manual de marca
        </NavLink>
        <NavLink to="/assinatura" icon={<CreditCard className="w-4 h-4" />}>
          Assinatura
        </NavLink>
        {/* Bastidores da operação: útil como prova de que a esteira roda, não é
            tarefa do usuário. Fica depois do que ele realmente usa. */}
        <NavLink to="/agentes" icon={<Activity className="w-4 h-4" />}>
          Bastidores
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin" icon={<Shield className="w-4 h-4" />}>
            Administração
          </NavLink>
        )}
      </nav>

      <div className="border-t border-border p-3">
        {email && <div className="px-3 py-2 text-xs text-muted-foreground truncate">{email}</div>}
        <SininhoNotificacoes />
        <button onClick={toggle} className={BOTAO_RODAPE}>
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === "dark" ? "Tema claro" : "Tema escuro"}
        </button>
        <button onClick={signOut} className={BOTAO_RODAPE}>
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-border bg-surface flex-col">
        {sidebar}
      </aside>

      {/*
       * Drawer mobile via Radix: traz foco preso, fechar no Esc e `role="dialog"`,
       * que a versão anterior feita à mão não tinha.
       */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-64 max-w-[80vw] bg-surface border-border p-0 flex flex-col md:hidden"
        >
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 border-b border-border bg-background/90 backdrop-blur">
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className="grid place-items-center w-11 h-11 -ml-2 rounded-md text-foreground hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img src={ICONE_MARCA} alt="" className="h-6 w-auto rounded-md" />
          <div className="font-display text-base font-semibold leading-none tracking-tight">
            prevIA <span className="text-muted-foreground">- CONTENT</span>
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/**
 * O item ativo usa o amarelo como fundo e marcador lateral, nunca como cor do
 * texto: sobre o fundo claro o #F4DB0B fica em ~1,4:1 e o rótulo do lugar onde
 * o usuário está era o menos legível do menu. Ver a regra no topo de styles.css.
 */
function NavLink({
  to,
  icon,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      activeProps={{
        className:
          "bg-primary/20 text-foreground font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-primary",
      }}
      inactiveProps={{
        className: "text-muted-foreground hover:text-foreground hover:bg-surface-elevated",
      }}
      className="relative flex items-center gap-3 min-h-11 px-3 py-2 rounded-md text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {icon}
      {children}
    </Link>
  );
}
