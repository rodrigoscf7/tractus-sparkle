import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutGrid,
  Activity,
  Users,
  LogOut,
  Menu,
  X,
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
import previaLogo from "@/assets/previa-logo.png.asset.json";
import previaLogoNegative from "@/assets/previa-logo-negative.png.asset.json";
import previaIcon from "@/assets/previa-icon.png.asset.json";

/**
 * Onboarding concluído nunca volta a ficar pendente, então basta confirmar uma
 * vez por carregamento da página. Sem isso, o gate faria duas consultas a cada
 * troca de rota. Só o valor positivo é memorizado.
 */
let onboardingLiberado = false;

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

  // lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  const sidebar = (
    <>
      <div className="px-6 py-6 border-b border-border">
        <img
          src={theme === "dark" ? previaLogoNegative.url : previaLogo.url}
          alt="prevIA"
          className="h-7 w-auto"
        />
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-2">
          Content
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavLink to="/pipeline" icon={<LayoutGrid className="w-4 h-4" />}>
          Pipeline
        </NavLink>
        <NavLink to="/curadoria" icon={<CheckCheck className="w-4 h-4" />}>
          Curadoria
        </NavLink>

        <NavLink to="/agentes" icon={<Activity className="w-4 h-4" />}>
          Agentes
        </NavLink>
        <NavLink to="/perfis" icon={<Users className="w-4 h-4" />}>
          Perfis
        </NavLink>
        <NavLink to="/dna" icon={<BookOpen className="w-4 h-4" />}>
          Manual de marca
        </NavLink>
        <NavLink to="/assinatura" icon={<CreditCard className="w-4 h-4" />}>
          Assinatura
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin" icon={<Shield className="w-4 h-4" />}>
            Administração
          </NavLink>
        )}
      </nav>

      <div className="border-t border-border p-3">
        {email && (
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">{email}</div>
        )}
        <button
          onClick={toggle}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === "dark" ? "Tema claro" : "Tema escuro"}
        </button>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition"
        >
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

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] border-r border-border bg-surface flex flex-col animate-in slide-in-from-left">
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="absolute top-4 right-3 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 border-b border-border bg-background/90 backdrop-blur">
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className="p-2 -ml-2 rounded-md text-foreground hover:bg-surface-elevated"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img src={previaIcon.url} alt="" className="h-6 w-auto rounded-md" />
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

function NavLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeProps={{ className: "bg-primary/10 text-primary" }}
      inactiveProps={{ className: "text-muted-foreground hover:text-foreground hover:bg-surface-elevated" }}
      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition"
    >
      {icon}
      {children}
    </Link>
  );
}
