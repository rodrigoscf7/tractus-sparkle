import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  CalendarDays,
  CalendarRange,
  CreditCard,
  Dna,
  FileText,
  LogOut,
  Menu,
  Moon,
  Settings,
  Shield,
  Sun,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "@/hooks/use-theme";
import { useIsPlatformAdmin } from "@/hooks/use-platform-admin";
import { useAvisosMenu } from "@/hooks/use-avisos-menu";
import { ICONE_MARCA, LOGO_FUNDO_CLARO, LOGO_FUNDO_ESCURO, MARCA_ALT } from "@/lib/marca";
import { cn } from "@/lib/utils";
import { SininhoNotificacoes } from "@/components/notificacoes/SininhoNotificacoes";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AssistenteSuporte } from "@/components/suporte/AssistenteSuporte";

/**
 * Onboarding concluído nunca volta a ficar pendente, então basta confirmar uma
 * vez por carregamento da página. Sem isso, o gate faria duas consultas a cada
 * troca de rota. Só o valor positivo é memorizado.
 */
let onboardingLiberado = false;

const FOCO =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Alvo de toque de 44px e foco visível — o padrão que o onboarding já usa. */
const BOTAO_RODAPE = cn(
  "w-full flex items-center gap-3 min-h-11 md:min-h-9 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition",
  FOCO,
);

const ROTULO_GRUPO =
  "px-3 pt-4 md:pt-3 pb-1.5 text-[11px] font-mono uppercase tracking-widest text-muted-foreground";

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
  const { roteirosParaLer, planoParaAprovar } = useAvisosMenu();

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

  const avisoPlano: Aviso | null = planoParaAprovar
    ? { tipo: "ponto", rotulo: "plano esperando aprovação" }
    : null;
  const avisoRoteiros: Aviso | null =
    roteirosParaLer > 0 ? { tipo: "contagem", valor: roteirosParaLer, rotulo: "para ler" } : null;

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

      <nav className="flex-1 px-3 pb-4 space-y-1 overflow-y-auto">
        <div className={ROTULO_GRUPO}>Produção</div>
        <NavLink to="/hoje" icon={<CalendarDays className="w-4 h-4" />}>
          Hoje
        </NavLink>
        <NavLink to="/plano" icon={<CalendarRange className="w-4 h-4" />} aviso={avisoPlano}>
          Plano da semana
        </NavLink>
        <NavLink to="/roteiros" icon={<FileText className="w-4 h-4" />} aviso={avisoRoteiros}>
          Roteiros
        </NavLink>

        <div className={ROTULO_GRUPO}>Marca</div>
        <NavLink to="/dna" icon={<Dna className="w-4 h-4" />}>
          DNA viral
        </NavLink>

        {isAdmin && (
          <>
            <div className={ROTULO_GRUPO}>Equipe prevIA</div>
            <NavLink to="/admin" icon={<Shield className="w-4 h-4" />}>
              Administração
            </NavLink>
            {/* A esteira por dentro: útil para a equipe, não é tarefa do cliente. */}
            <NavLink to="/agentes" icon={<Activity className="w-4 h-4" />}>
              Bastidores
            </NavLink>
          </>
        )}
      </nav>

      <div className="border-t border-border p-3 space-y-0.5">
        {email && <div className="px-3 py-2 text-xs text-muted-foreground truncate">{email}</div>}
        <SininhoNotificacoes />
        <NavLink to="/configuracoes" icon={<Settings className="w-4 h-4" />}>
          Configurações
        </NavLink>
        <NavLink to="/assinatura" icon={<CreditCard className="w-4 h-4" />}>
          Assinatura
        </NavLink>
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
      <aside className="hidden md:flex sticky top-0 h-screen w-60 shrink-0 border-r border-border bg-surface flex-col">
        {sidebar}
      </aside>

      {/*
       * Drawer mobile via Radix: traz foco preso, fechar no Esc e `role="dialog"`,
       * que a versão anterior feita à mão não tinha. Abre pelo "Mais" da barra inferior.
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
        {/* Mobile top bar: só a marca; a navegação fica na barra inferior. */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 border-b border-border bg-background/90 backdrop-blur">
          <img src={ICONE_MARCA} alt="" className="h-6 w-auto rounded-md" />
          <div className="font-display text-base font-semibold leading-none tracking-tight">
            prevIA <span className="text-muted-foreground">- CONTENT</span>
          </div>
        </header>

        {/* No celular, o fim do conteúdo não pode ficar atrás da barra inferior. */}
        <main className="flex-1 min-w-0 overflow-auto pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          <Outlet />
        </main>
      </div>

      <BarraInferior
        avisoPlano={avisoPlano}
        avisoRoteiros={avisoRoteiros}
        onMais={() => setOpen(true)}
      />

      <AssistenteSuporte />
    </div>
  );
}

type Aviso =
  { tipo: "contagem"; valor: number; rotulo: string } | { tipo: "ponto"; rotulo: string };

/**
 * Contagem em amarelo com número grafite (amarelo é ação, nunca texto). O
 * rótulo vai junto para leitor de tela: a cor sozinha não diz nada.
 */
function MarcaAviso({ aviso, className }: { aviso: Aviso; className?: string }) {
  if (aviso.tipo === "ponto") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary ring-2 ring-surface" />
        <span className="sr-only">({aviso.rotulo})</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-grid place-items-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground",
        "text-[11px] font-mono font-medium leading-none num",
        className,
      )}
    >
      {aviso.valor > 99 ? "99+" : aviso.valor}
      <span className="sr-only"> {aviso.rotulo}</span>
    </span>
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
  aviso = null,
  children,
}: {
  to: string;
  icon: ReactNode;
  aviso?: Aviso | null;
  children: ReactNode;
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
      className={cn(
        "relative flex items-center gap-3 min-h-11 md:min-h-9 px-3 py-2 rounded-md text-sm font-medium transition",
        FOCO,
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {aviso && <MarcaAviso aviso={aviso} />}
    </Link>
  );
}

/**
 * Navegação do celular: as telas de todo dia a um toque, sem abrir menu.
 * Ícone sempre com rótulo; o item ativo ganha a barra amarela no topo.
 */
function BarraInferior({
  avisoPlano,
  avisoRoteiros,
  onMais,
}: {
  avisoPlano: Aviso | null;
  avisoRoteiros: Aviso | null;
  onMais: () => void;
}) {
  const item = cn(
    "relative flex flex-1 flex-col items-center justify-center gap-1 min-h-14 px-1 text-[11px] font-medium transition-colors",
    FOCO,
  );
  const ativo =
    "text-foreground font-semibold before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:h-[3px] before:w-8 before:rounded-b-full before:bg-primary";
  const inativo = "text-muted-foreground hover:text-foreground";

  const itens: { to: string; rotulo: string; icone: ReactNode; aviso: Aviso | null }[] = [
    { to: "/hoje", rotulo: "Hoje", icone: <CalendarDays className="w-5 h-5" />, aviso: null },
    {
      to: "/plano",
      rotulo: "Plano",
      icone: <CalendarRange className="w-5 h-5" />,
      aviso: avisoPlano,
    },
    {
      to: "/roteiros",
      rotulo: "Roteiros",
      icone: <FileText className="w-5 h-5" />,
      aviso: avisoRoteiros,
    },
  ];

  return (
    <nav
      aria-label="Navegação principal"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {itens.map((i) => (
        <Link
          key={i.to}
          to={i.to}
          activeProps={{ className: ativo }}
          inactiveProps={{ className: inativo }}
          className={item}
        >
          <span className="relative">
            {i.icone}
            {i.aviso && (
              <MarcaAviso
                aviso={i.aviso}
                className={cn(
                  "absolute",
                  i.aviso.tipo === "ponto" ? "-top-0.5 -right-0.5" : "-top-1.5 -right-3.5",
                )}
              />
            )}
          </span>
          {i.rotulo}
        </Link>
      ))}
      <button type="button" onClick={onMais} className={cn(item, inativo)}>
        <Menu className="w-5 h-5" />
        Mais
      </button>
    </nav>
  );
}
