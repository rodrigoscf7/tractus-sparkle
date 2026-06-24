import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutGrid, Activity, Users, LogOut } from "lucide-react";
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-60 border-r border-border bg-surface flex flex-col">
        <div className="px-6 py-6 border-b border-border flex items-center gap-3">
          <img src={tractusIcon.url} alt="Tractus" className="h-9 w-9" />
          <div>
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
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
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
