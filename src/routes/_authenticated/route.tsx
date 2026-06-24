import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutGrid, Activity, Users, LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import tractusIcon from "@/assets/tractus-icon.png.asset.json";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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
      <div className="px-6 py-6 border-b border-border flex items-center gap-3">
        <img src={tractusIcon.url} alt="Tractus" className="h-9 w-9" />
        <div className="min-w-0">
          <div className="tractus-gradient-text font-display text-xl font-bold leading-none">
            Tractus
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
            Content System
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavLink to="/pipeline" icon={<LayoutGrid className="w-4 h-4" />}>
          Pipeline
        </NavLink>
        <NavLink to="/agentes" icon={<Activity className="w-4 h-4" />}>
          Agentes
        </NavLink>
        <NavLink to="/perfis" icon={<Users className="w-4 h-4" />}>
          Perfis
        </NavLink>
      </nav>

      <div className="border-t border-border p-3">
        {email && (
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">{email}</div>
        )}
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
          <img src={tractusIcon.url} alt="Tractus" className="h-7 w-7" />
          <div className="tractus-gradient-text font-display text-lg font-bold leading-none">
            Tractus
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
